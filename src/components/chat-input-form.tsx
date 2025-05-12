
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
  const isLocallyPending = useFormStatus().pending;
  const isDisabled = isProcessing || isLocallyPending;

  React.useEffect(() => {
    if (!isActionPending && (state !== initialState || state?.error)) {
        console.log('[Form Effect] Action state received:', state);
        onProcessingComplete(state);
    }
  }, [state, isActionPending, onProcessingComplete]);


  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      console.log('[Form Submit] Form submitting. Triggering onProcessingStart.');
      onProcessingStart();
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Input Conversation</CardTitle>
        {/* Updated description */}
        <CardDescription>Paste your full ChatGPT conversation below. Generated study notes will be saved automatically if successful.</CardDescription>
      </CardHeader>
      <form
        ref={formRef}
        action={formAction}
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
                defaultValue={state?.originalConversationText || ''}
                />
                 <p id="conversation-error-hint" className="sr-only">
                    If there is an error, it will be displayed below this form after processing.
                 </p>
            </div>
            </CardContent>
            <CardFooter>
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