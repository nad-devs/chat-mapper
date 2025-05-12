
'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';

const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

export type ProcessedConversationResult = {
  topicsSummary: string; // Keep this as the main paragraph summary
  keyTopics: string[]; // Add the list of key topics
  conceptsMap: MapConceptsOutput | null;
  error?: string | null;
};

export async function processConversation(
  prevState: ProcessedConversationResult | null,
  formData: FormData
): Promise<ProcessedConversationResult> {
  const validatedFields = processConversationInputSchema.safeParse({
    conversationText: formData.get('conversationText'),
  });

  if (!validatedFields.success) {
    return {
        topicsSummary: '',
        keyTopics: [],
        conceptsMap: null,
        error: validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input.',
    };
  }

  const { conversationText } = validatedFields.data;

  try {
    // Step 1: Summarize Topics
    const summaryOutput: SummarizeTopicsOutput = await summarizeTopics({ conversation: conversationText });
    const topicsSummary = summaryOutput.summary; // Use the paragraph summary
    const keyTopics = summaryOutput.keyTopics; // Get the key topics list

    if (!topicsSummary || !keyTopics) {
        return { topicsSummary: '', keyTopics: [], conceptsMap: null, error: 'Could not summarize topics.' };
    }

    // Step 2: Map Concepts using the summary paragraph as the main topic context
    const mapInput: MapConceptsInput = {
      mainTopic: topicsSummary, // Use the generated summary paragraph as the main topic for concept mapping
      conversationText: conversationText,
    };
    const conceptsMap: MapConceptsOutput = await mapConcepts(mapInput);

    return {
      topicsSummary,
      keyTopics,
      conceptsMap,
      error: null,
    };
  } catch (error) {
    console.error('Error processing conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return {
        topicsSummary: '',
        keyTopics: [],
        conceptsMap: null,
        error: `AI processing failed: ${errorMessage}`,
    };
  }
}
