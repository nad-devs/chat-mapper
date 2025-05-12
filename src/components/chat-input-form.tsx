
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
  isProcessing: boolean; // Add prop to know if parent component is busy
}

// Initial state matches the ProcessedConversationResult type
const initialState: ProcessedConversationResult = {
    topicsSummary: '',
    keyTopics: [],
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
    error: null,
    originalConversationText: '', // Keep original text for retries if needed
};


export function ChatInputForm({ onProcessingStart, onProcessingComplete, isProcessing }: ChatInputFormProps) {
  const [state, formAction, isActionPending] = useActionState(processConversation, initialState);
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  // isPending from useFormStatus reflects the form's *own* pending state
  const isLocallyPending = useFormStatus().pending;
  // Disable if the parent component is processing OR the form action is pending
  const isDisabled = isProcessing || isLocallyPending;

  React.useEffect(() => {
    // Check if the action is NOT pending AND the state has changed from the initial state
    if (!isActionPending && state !== initialState) {
        console.log('[Form Effect] Action state received:', state);

        // Let the parent page component handle displaying success/error toasts based on the state.error field.
        // This form component doesn't need to show toasts itself anymore.
        // Example: If state.error has a DB error, the parent will show it.
        // if (state.error) {
        //   console.error('[Form Effect] Action returned an error:', state.error);
        //   toast({
        //     title: "Error",
        //     description: state.error, // This could be AI error or DB save error
        //     variant: "destructive",
        //   });
        // }

        // Always call the completion callback to update the parent component's state
        onProcessingComplete(state);
    }
     // We only want this effect to run when the action completes (isActionPending becomes false)
     // and the state object itself has potentially changed. Adding state to dependencies.
  }, [state, isActionPending, onProcessingComplete]);


  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      // Prevent default form submission if needed, though using formAction should handle it.
      // event.preventDefault(); // Usually not needed with formAction prop

      console.log('[Form Submit] Form submitting. Triggering onProcessingStart.');
      onProcessingStart(); // Notify parent that processing is starting

      // The formAction prop handles the actual submission and state update
      // No need to call formAction(new FormData(formRef.current!)) manually here
      // when using the action prop on the form.
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Input Conversation</CardTitle>
        <CardDescription>Paste your full ChatGPT conversation below. Analysis results will be saved.</CardDescription>
      </CardHeader>
      {/* Use the formAction prop directly */}
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleFormSubmit} // Keep onSubmit for onProcessingStart trigger
      >
        {/* Disable the entire fieldset when processing */}
        <fieldset disabled={isDisabled} className="group">
            <CardContent>
            <div className="grid w-full gap-1.5">
                <Label htmlFor="conversationText">Conversation Text</Label>
                <Textarea
                placeholder="Paste your conversation here..."
                id="conversationText"
                name="conversationText" // Ensure name matches action input
                rows={15}
                required
                // Use aria-invalid based on error state for accessibility
                aria-invalid={!!state?.error && !isActionPending}
                aria-describedby="conversation-error"
                className="group-disabled:opacity-50" // Style when disabled
                // Optionally clear text on successful submission (or keep it)
                // defaultValue={initialState.originalConversationText} // Or manage via state if needed
                />
                {/* Display error state from action if available and not pending */}
                {state?.error && !isActionPending && (
                    <p id="conversation-error" className="text-sm font-medium text-destructive pt-1">
                        {state.error}
                    </p>
                 )}
            </div>
            </CardContent>
            <CardFooter>
                 {/* Submit button uses isDisabled which considers parent state and form pending state */}
                 <Button type="submit" disabled={isDisabled}>
                    {isDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isDisabled ? 'Processing...' : 'Analyze & Save'}
                </Button>
            </CardFooter>
        </fieldset>
      </form>
    </Card>
  );
}
