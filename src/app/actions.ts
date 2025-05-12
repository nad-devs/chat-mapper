'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
// Import the updated flow and its output type
import { analyzeCodeConceptAndFinalExample, AnalyzeCodeOutput } from '@/ai/flows/analyze-code';

const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// Update the result type to reflect the simplified code analysis output
export type ProcessedConversationResult = {
  topicsSummary: string;
  keyTopics: string[];
  conceptsMap: MapConceptsOutput | null;
  codeAnalysis: AnalyzeCodeOutput | null; // Uses the updated AnalyzeCodeOutput type
  error?: string | null;
};

export async function processConversation(
  prevState: ProcessedConversationResult | null,
  formData: FormData
): Promise<ProcessedConversationResult> {
  console.log('[Action] processConversation started.');

  const validatedFields = processConversationInputSchema.safeParse({
    conversationText: formData.get('conversationText'),
  });

  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input.';
    console.error('[Action] Validation failed:', errorMsg);
    return {
        topicsSummary: '',
        keyTopics: [],
        conceptsMap: null,
        codeAnalysis: null, // Initialize codeAnalysis
        error: errorMsg,
    };
  }

  const { conversationText } = validatedFields.data;
  console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

  try {
    console.log('[Action] Starting AI flows...');
    // Run summary and the *new* code analysis flow concurrently
    const [summaryResult, codeAnalysisResult] = await Promise.allSettled([
      summarizeTopics({ conversation: conversationText }),
      // Call the updated code analysis flow
      analyzeCodeConceptAndFinalExample({ conversationText: conversationText })
    ]);
    console.log('[Action] Summary and Code Analysis results settled:', { summaryResult, codeAnalysisResult });

    // Handle Summary Result
    if (summaryResult.status === 'rejected' || !summaryResult.value?.summary || !summaryResult.value?.keyTopics) {
      const reason = summaryResult.status === 'rejected' ? summaryResult.reason : 'Missing data';
      console.error("[Action] Error summarizing topics:", reason);
      // Ensure codeAnalysis is initialized even if summary fails early
      let codeAnalysis: AnalyzeCodeOutput | null = null;
      if (codeAnalysisResult.status === 'fulfilled') {
           codeAnalysis = codeAnalysisResult.value; // Keep the result even if empty
      } else if (codeAnalysisResult.status === 'rejected') {
           console.error("[Action] Error analyzing code (during summary error):", codeAnalysisResult.reason);
           codeAnalysis = null;
      }
      return { topicsSummary: '', keyTopics: [], conceptsMap: null, codeAnalysis: codeAnalysis, error: 'Could not summarize topics.' };
    }
    const { summary: topicsSummary, keyTopics } = summaryResult.value;
    console.log('[Action] Topics summarized successfully.');

    // Handle Code Analysis Result
    let codeAnalysis: AnalyzeCodeOutput | null = null;
    if (codeAnalysisResult.status === 'fulfilled' && codeAnalysisResult.value) {
       // Pass the result directly, even if concept/snippet are empty.
       // The frontend will decide whether to display based on content.
       codeAnalysis = codeAnalysisResult.value;
       console.log('[Action] Code analyzed successfully (result may be empty).');
    } else if (codeAnalysisResult.status === 'rejected') {
       console.error("[Action] Error analyzing code:", codeAnalysisResult.reason);
       codeAnalysis = null; // Set to null on error
    }


    // Step 3: Map Concepts (depends on summary)
    console.log('[Action] Starting Concept Mapping...');
    const mapInput: MapConceptsInput = {
      mainTopic: topicsSummary, // Use the generated summary paragraph
      conversationText: conversationText,
    };
    // Concept mapping can also run, but might fail - handle gracefully
    let conceptsMap: MapConceptsOutput | null = null;
    try {
        conceptsMap = await mapConcepts(mapInput);
        console.log('[Action] Concepts mapped successfully.');
    } catch (mapError) {
        console.error("[Action] Error mapping concepts:", mapError);
        conceptsMap = null;
    }


    console.log('[Action] processConversation finished successfully.');
    return {
      topicsSummary,
      keyTopics,
      conceptsMap,
      codeAnalysis, // Include the potentially null or empty code analysis results
      error: null,
    };
  } catch (error) {
    console.error('[Action] Unexpected error processing conversation:', error);
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
