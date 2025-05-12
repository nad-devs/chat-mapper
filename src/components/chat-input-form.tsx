
'use client';

import * as React from 'react';
import { useActionState } from 'react'; // Changed from react-dom to react and useFormState to useActionState
import { useFormStatus } from 'react-dom'; // Import useFormStatus from react-dom
import { processConversation, type ProcessedConversationResult } from '@/app/actions';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"

interface ChatInputFormProps {
  onProcessingStart: () => void;
  onProcessingComplete: (results: ProcessedConversationResult | null) => void;
}

const initialState: ProcessedConversationResult = {
    topicsSummary: '',
    keyTopics: [], // Initialize keyTopics
    conceptsMap: null,
    codeAnalysis: null, // Initialize codeAnalysis
    error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {pending ? 'Processing...' : 'Analyze Conversation'}
    </Button>
  );
}

export function ChatInputForm({ onProcessingStart, onProcessingComplete }: ChatInputFormProps) {
  const [state, formAction] = useActionState(processConversation, initialState); // Renamed to useActionState
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.error) {
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      })
      onProcessingComplete(null); // Clear previous results on error
    } else if (state?.topicsSummary || state?.conceptsMap || (state?.keyTopics && state.keyTopics.length > 0) || state?.codeAnalysis?.codeExamples?.length > 0) { // Check for any valid data
       onProcessingComplete(state);
       // Optionally reset form after successful submission
       // formRef.current?.reset();
    } else if (state) {
        // Handle cases where processing finished but no meaningful data was extracted (e.g., empty summary, no concepts, no code)
        onProcessingComplete(state); // Still pass the state so UI can potentially show "Nothing found" messages
    }
  }, [state, onProcessingComplete, toast]);

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault(); // Prevent default form submission
      onProcessingStart();
      // Manually call the form action with the form data
      const formData = new FormData(event.currentTarget);
      formAction(formData);
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Input Conversation</CardTitle>
        <CardDescription>Paste your full ChatGPT conversation below.</CardDescription>
      </CardHeader>
      {/* Removed form action prop, handle submission manually */}
      <form ref={formRef} onSubmit={handleFormSubmit}>
        <CardContent>
          <div className="grid w-full gap-1.5">
            <Label htmlFor="conversationText">Conversation Text</Label>
            <Textarea
              placeholder="Paste your conversation here..."
              id="conversationText"
              name="conversationText" // Ensure name matches formData key
              rows={15}
              required
              aria-describedby="conversation-error"
            />
            {/* Display error from state if present */}
            {state?.error && <p id="conversation-error" className="text-sm font-medium text-destructive">{state.error}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
