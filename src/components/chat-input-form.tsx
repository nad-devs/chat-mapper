
'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
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
    keyTopics: [],
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null, // Updated field name
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
  const [state, formAction, isActionPending] = useActionState(processConversation, initialState);
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    // Only react when the action is done (not pending) and the state is not the initial one
    if (!isActionPending && state !== initialState) {
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
                          (state.codeAnalysis && (state.codeAnalysis.learnedConcept || state.codeAnalysis.finalCodeSnippet)) ||
                          state.studyNotes; // Updated check for any data including studyNotes

          if (hasData) {
              console.log('[Form Effect] Action successful with data.'); // Log success with data
          } else {
              console.log('[Form Effect] Action successful, but no significant data found.'); // Log success no data
              toast({ title: "Analysis Complete", description: "No specific topics, concepts, code insights, or study notes found." });
          }
          onProcessingComplete(state); // Pass the result state (even if empty)
          // Optionally reset form after successful submission
          // formRef.current?.reset();
        }
    }
  }, [state, isActionPending, onProcessingComplete, toast]);


  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      // DO NOT prevent default. Let the form submit naturally via the `action` prop.
      // event.preventDefault(); // Removed preventDefault
      console.log('[Form Submit] Form submitting via action prop. Triggering onProcessingStart.'); // Log form submission
      onProcessingStart();
      // The `action` prop on the form element handles calling `formAction`.
      // No need to call it manually here.
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Input Conversation</CardTitle>
        <CardDescription>Paste your full ChatGPT conversation below.</CardDescription>
      </CardHeader>
      {/* Use the `action` prop for the form */}
      <form
        ref={formRef}
        action={formAction} // Pass the action function here
        onSubmit={handleFormSubmit} // Call onProcessingStart here
      >
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
            {/* Display error from state if present and not the initial state error */}
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

