
'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { processConversation, type ProcessedConversationResult } from '@/app/actions';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label'; // Import Label
import { Loader2, Send } from 'lucide-react'; // Import Send icon

interface ChatInputFormProps {
  onProcessingStart: () => void;
  onProcessingComplete: (results: ProcessedConversationResult | null) => void;
  isProcessing: boolean;
  initialText?: string; // Optional prop for initial text
}

// Initial state matches the ProcessedConversationResult type
const initialState: ProcessedConversationResult = {
    learningSummary: null, // Changed from topicsSummary
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
         // Ensure state is serializable before passing to handler
        try {
            const serializableState = JSON.parse(JSON.stringify(state));
            onProcessingComplete(serializableState); // Pass the entire state object
        } catch (stringifyError) {
            console.error('[Form Effect] Error serializing action state:', stringifyError);
            // Handle the error appropriately, e.g., show a generic error message
             onProcessingComplete({ ...initialState, error: "Failed to process results." });
        }
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
    // Use the structure from the user's example code
    <form
      ref={formRef}
      action={formAction} // Use the action returned by useActionState
      onSubmit={handleFormSubmit}
      className="space-y-4"
    >
      <fieldset disabled={isDisabled} className="group space-y-4">
        <div className="space-y-2">
          <Label htmlFor="conversationText" className="block text-sm font-medium text-foreground">
            Paste your ChatGPT conversation
          </Label>
          <Textarea
            placeholder="Paste your ChatGPT conversation here..."
            id="conversationText"
            name="conversationText"
            rows={15}
            required
            key={initialText}
            defaultValue={state?.originalConversationText || ''}
            aria-invalid={!!state?.error && !isActionPending && !isProcessing}
            aria-describedby="conversation-error-hint"
            className="min-h-[200px] resize-y group-disabled:opacity-50"
          />
          <p id="conversation-error-hint" className="sr-only">
            If there is an error, it will be displayed below this form after processing.
          </p>
        </div>
        <div className="flex justify-end">
          <SubmitButton isDisabled={isDisabled} />
        </div>
      </fieldset>
    </form>
  );
}

// Separate SubmitButton component to use useFormStatus
function SubmitButton({ isDisabled }: { isDisabled: boolean }) {
    const { pending } = useFormStatus();
    const actualDisabled = isDisabled || pending;

    return (
         <Button type="submit" disabled={actualDisabled}>
            {actualDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" /> }
            {actualDisabled ? 'Analyzing...' : 'Analyze Conversation'}
        </Button>
    )
}
