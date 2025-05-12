
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
  isProcessing: boolean; // Add prop to know if processing is happening
}

// Updated initial state type to match ProcessedConversationResult without DB fields
const initialState: ProcessedConversationResult = {
    topicsSummary: '',
    keyTopics: [],
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
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

export function ChatInputForm({ onProcessingStart, onProcessingComplete, isProcessing }: ChatInputFormProps) {
  const [state, formAction, isActionPending] = useActionState(processConversation, initialState);
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const isPending = useFormStatus().pending; // Get pending state for the button
  const isDisabled = isProcessing || isPending; // Disable if parent says processing OR form is pending

  React.useEffect(() => {
    if (!isActionPending && state !== initialState) {
        console.log('[Form Effect] Action state received:', state);

        // Show only critical errors via toast here
        if (state.error) {
          console.error('[Form Effect] Action returned an error:', state.error);
          toast({
            title: "Error",
            description: state.error,
            variant: "destructive",
          });
        }
        // Let the parent handle success/warning toasts based on the full result
        onProcessingComplete(state);
    }
  }, [state, isActionPending, onProcessingComplete, toast]);


  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      console.log('[Form Submit] Form submitting via action prop. Triggering onProcessingStart.');
      onProcessingStart();
      // No need to preventDefault or call formAction manually
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Input Conversation</CardTitle>
        {/* Update description as results are no longer saved automatically */}
        <CardDescription>Paste your full ChatGPT conversation below to analyze it.</CardDescription>
      </CardHeader>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleFormSubmit}
      >
        <fieldset disabled={isDisabled} className="group"> {/* Disable fieldset */}
            <CardContent>
            <div className="grid w-full gap-1.5">
                <Label htmlFor="conversationText">Conversation Text</Label>
                <Textarea
                placeholder="Paste your conversation here..."
                id="conversationText"
                name="conversationText"
                rows={15}
                required
                aria-describedby="conversation-error"
                className="group-disabled:opacity-50" // Style when disabled
                />
                {/* Display error state from action if available */}
                {state?.error && !isActionPending && <p id="conversation-error" className="text-sm font-medium text-destructive pt-1">{state.error}</p>}
            </div>
            </CardContent>
            <CardFooter>
                 <Button type="submit" disabled={isDisabled}>
                    {isDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isDisabled ? 'Processing...' : 'Analyze Conversation'}
                </Button>
            </CardFooter>
        </fieldset>
      </form>
    </Card>
  );
}

