
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
import { useToast } from "@/hooks/use-toast";


interface ChatInputFormProps {
  onProcessingStart: () => void;
  onProcessingComplete: (results: ProcessedConversationResult | null) => void;
  isProcessing: boolean; // Add prop to know if parent component is busy
}

// Initial state matches the ProcessedConversationResult type
const initialState: ProcessedConversationResult = {
    topicsSummary: null, // Allow null
    keyTopics: null, // Allow null
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
    error: null,
    originalConversationText: '', // Keep original text for retries if needed
};


export function ChatInputForm({ onProcessingStart, onProcessingComplete, isProcessing }: ChatInputFormProps) {
  const [state, formAction, isActionPending] = useActionState(processConversation, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const isDisabled = isProcessing || isActionPending; // Use isActionPending directly

  React.useEffect(() => {
    // Check if the action is NOT pending AND if the state has changed from initial OR there's an error
    if (!isActionPending && (state !== initialState || (state && state.error))) {
        console.log('[Form Effect] Action state received:', state);
        onProcessingComplete(state); // Pass the entire state object (which includes errors)
    }
  }, [state, isActionPending, onProcessingComplete]);


  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      // Prevent default only if not using formAction prop
      // event.preventDefault(); // Not needed when using `action` prop
      console.log('[Form Submit] Form submitting via action prop. Triggering onProcessingStart.');
      onProcessingStart();
      // formAction(); // Call the action bound by useActionState via the form's `action` prop
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Input Conversation</CardTitle>
        {/* Updated description */}
        <CardDescription>Paste your full ChatGPT conversation below. After analysis, you can save the generated notes.</CardDescription>
      </CardHeader>
      <form
        ref={formRef}
        action={formAction} // Use the action returned by useActionState
        onSubmit={handleFormSubmit}
      >
        <fieldset disabled={isDisabled} className="group">
            <CardContent>
            <div className="grid w-full gap-1.5">
                <Label htmlFor="conversationText">Conversation Text</Label>
                <Textarea
                placeholder="Paste your conversation here..."
                id="conversationText"
                name="conversationText"
                rows={15}
                required
                aria-invalid={!!state?.error && !isActionPending}
                aria-describedby="conversation-error-hint"
                className="group-disabled:opacity-50"
                // Use defaultValue to allow form reset or initial population if needed
                // Or manage value via state if more control is required
                defaultValue={state?.originalConversationText || ''}
                />
                 <p id="conversation-error-hint" className="sr-only">
                    If there is an error, it will be displayed below this form after processing.
                 </p>
            </div>
            </CardContent>
            <CardFooter>
                 {/* Use SubmitButton component to access form status */}
                 <SubmitButton isDisabled={isDisabled} />
            </CardFooter>
        </fieldset>
      </form>
    </Card>
  );
}

// Separate SubmitButton component to use useFormStatus
function SubmitButton({ isDisabled }: { isDisabled: boolean }) {
    const { pending } = useFormStatus();
    const actualDisabled = isDisabled || pending;

    return (
         <Button type="submit" disabled={actualDisabled}>
            {actualDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {actualDisabled ? 'Processing...' : 'Analyze Conversation'}
        </Button>
    )
}

    