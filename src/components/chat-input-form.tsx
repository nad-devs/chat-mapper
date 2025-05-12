
'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
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
    conceptsMap: null,
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
  const [state, formAction] = useFormState(processConversation, initialState);
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
    } else if (state?.topicsSummary || state?.conceptsMap) {
       onProcessingComplete(state);
       // Optionally reset form after successful submission
       // formRef.current?.reset();
    }
  }, [state, onProcessingComplete, toast]);

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      onProcessingStart();
      // The formAction will be called automatically by form submission
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Input Conversation</CardTitle>
        <CardDescription>Paste your full ChatGPT conversation below.</CardDescription>
      </CardHeader>
      <form ref={formRef} action={formAction} onSubmit={handleFormSubmit}>
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
