
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
    // Only proceed if state is not null (meaning the action has returned)
    if (!state) return;

    console.log('[Form Effect] Action state received:', state); // Log state received

    if (state.error) {
      console.error('[Form Effect] Action returned an error:', state.error); // Log error
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      });
      onProcessingComplete(state); // Pass error state
    } else {
      // Check if *any* data was successfully processed
      const hasData = state.topicsSummary ||
                      (state.keyTopics && state.keyTopics.length > 0) ||
                      state.conceptsMap ||
                      (state.codeAnalysis && state.codeAnalysis.codeExamples.length > 0);

      if (hasData) {
          console.log('[Form Effect] Action successful with data.'); // Log success with data
      } else {
          console.log('[Form Effect] Action successful, but no data found.'); // Log success no data
          // Optionally show a different toast or message here if desired
          // toast({ title: "Analysis Complete", description: "No specific topics, concepts, or code found." });
      }
      onProcessingComplete(state); // Pass the result state (even if empty)
      // Optionally reset form after successful submission
      // formRef.current?.reset();
    }
  }, [state, onProcessingComplete, toast]); // Dependencies remain the same


  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault(); // Prevent default form submission
      console.log('[Form Submit] Form submitted.'); // Log form submission
      onProcessingStart();
      // Manually call the form action with the form data
      const formData = new FormData(event.currentTarget);
      console.log('[Form Submit] Calling formAction with formData:', formData.get('conversationText')?.substring(0, 100) + '...'); // Log action call
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

