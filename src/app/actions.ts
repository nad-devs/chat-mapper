
'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
import { analyzeCodeExamples, AnalyzeCodeOutput, CodeExample } from '@/ai/flows/analyze-code'; // Import new flow

const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

export type ProcessedConversationResult = {
  topicsSummary: string;
  keyTopics: string[];
  conceptsMap: MapConceptsOutput | null;
  codeAnalysis: AnalyzeCodeOutput | null; // Add code analysis results
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
        codeAnalysis: null, // Initialize codeAnalysis
        error: validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input.',
    };
  }

  const { conversationText } = validatedFields.data;

  try {
    // Run flows concurrently where possible
    const [summaryResult, codeAnalysisResult] = await Promise.allSettled([
      summarizeTopics({ conversation: conversationText }),
      analyzeCodeExamples({ conversationText: conversationText })
    ]);

    // Handle Summary Result
    if (summaryResult.status === 'rejected' || !summaryResult.value?.summary || !summaryResult.value?.keyTopics) {
      console.error("Error summarizing topics:", summaryResult.status === 'rejected' ? summaryResult.reason : 'Missing data');
      return { topicsSummary: '', keyTopics: [], conceptsMap: null, codeAnalysis: null, error: 'Could not summarize topics.' };
    }
    const { summary: topicsSummary, keyTopics } = summaryResult.value;

    // Handle Code Analysis Result (allow it to fail gracefully)
    let codeAnalysis: AnalyzeCodeOutput | null = null;
    if (codeAnalysisResult.status === 'fulfilled' && codeAnalysisResult.value) {
       codeAnalysis = codeAnalysisResult.value;
    } else if (codeAnalysisResult.status === 'rejected') {
       console.error("Error analyzing code:", codeAnalysisResult.reason);
       // Don't block the entire result if code analysis fails, just set it to null
       codeAnalysis = { codeExamples: [] }; // Or null, depending on desired behavior
    }


    // Step 3: Map Concepts (depends on summary)
    const mapInput: MapConceptsInput = {
      mainTopic: topicsSummary, // Use the generated summary paragraph
      conversationText: conversationText,
    };
    // Concept mapping can also run, but might fail - handle gracefully
    let conceptsMap: MapConceptsOutput | null = null;
    try {
        conceptsMap = await mapConcepts(mapInput);
    } catch (mapError) {
        console.error("Error mapping concepts:", mapError);
        // Don't block if concept mapping fails
        conceptsMap = null; // Or initialize with empty arrays if preferred
    }


    return {
      topicsSummary,
      keyTopics,
      conceptsMap,
      codeAnalysis, // Include code analysis results
      error: null,
    };
  } catch (error) {
    // Catch any unexpected errors during Promise.all or other steps
    console.error('Error processing conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return {
        topicsSummary: '',
        keyTopics: [],
        conceptsMap: null,
        codeAnalysis: null,
        error: `AI processing failed: ${errorMessage}`,
    };
  }
}
