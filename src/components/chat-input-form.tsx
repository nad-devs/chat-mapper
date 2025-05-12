
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
// Removed useToast import as it's not used here anymore

interface ChatInputFormProps {
  onProcessingStart: () => void;
  onProcessingComplete: (results: ProcessedConversationResult | null) => void;
  isProcessing: boolean;
  initialText?: string; // Optional prop for initial text
}

// Initial state matches the ProcessedConversationResult type
const initialState: ProcessedConversationResult = {
    topicsSummary: null,
    keyTopics: null,
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
    error: null,
    originalConversationText: '',
};


export function ChatInputForm({ onProcessingStart, onProcessingComplete, isProcessing, initialText = '' }: ChatInputFormProps) {
  // If initialText is provided, use it to set the initial state's conversation text
  const actualInitialState = React.useMemo(() => ({
    ...initialState,
    originalConversationText: initialText || initialState.originalConversationText,
  }), [initialText]);

  const [state, formAction, isActionPending] = useActionState(processConversation, actualInitialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const isDisabled = isProcessing || isActionPending;

  React.useEffect(() => {
    // Check if the action is NOT pending AND if the state has actually changed from the one used to initialize the hook
    // Or if the state contains an error (indicating completion, even if failed)
    if (!isActionPending && (state !== actualInitialState || (state && state.error))) {
        console.log('[Form Effect] Action state received:', state);
        onProcessingComplete(state); // Pass the entire state object
    }
    // Intentionally limit deps to avoid loop if actualInitialState changes unnecessarily
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isActionPending, onProcessingComplete]);


  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      // event.preventDefault(); // Not needed when using `action` prop
      console.log('[Form Submit] Form submitting via action prop. Triggering onProcessingStart.');
      onProcessingStart();
      // No need to call formAction() manually, the form's `action` prop handles it.
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Input Conversation</CardTitle>
        <CardDescription>Paste your full ChatGPT conversation below. After analysis, you can review insights and save the generated notes.</CardDescription>
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
                // Use defaultValue from the *current* state to reflect retries/initial text
                // Use key={initialText} hack to force re-render if initialText changes, clearing manual edits
                key={initialText}
                defaultValue={state?.originalConversationText || ''}
                aria-invalid={!!state?.error && !isActionPending && !isProcessing} // Show invalid only if error exists and not pending/processing
                aria-describedby="conversation-error-hint"
                className="group-disabled:opacity-50"
                />
                 <p id="conversation-error-hint" className="sr-only">
                    If there is an error, it will be displayed below this form after processing.
                 </p>
            </div>
            </CardContent>
            <CardFooter>
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
