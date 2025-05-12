'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
import { analyzeCodeConceptAndFinalExample, AnalyzeCodeOutput } from '@/ai/flows/analyze-code';
// Import the new flow and its output type
import { generateStruggleNotes, GenerateStruggleNotesOutput } from '@/ai/flows/generate-struggle-notes';

const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// Update the result type to include struggle notes
export type ProcessedConversationResult = {
  topicsSummary: string;
  keyTopics: string[];
  conceptsMap: MapConceptsOutput | null;
  codeAnalysis: AnalyzeCodeOutput | null;
  struggleNotes: string | null; // Add the new field for struggle notes
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
        codeAnalysis: null,
        struggleNotes: null, // Initialize struggleNotes
        error: errorMsg,
    };
  }

  const { conversationText } = validatedFields.data;
  console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

  try {
    console.log('[Action] Starting AI flows...');
    // Run summary, code analysis, and struggle notes flow concurrently
    const [summaryResult, codeAnalysisResult, struggleNotesResult] = await Promise.allSettled([
      summarizeTopics({ conversation: conversationText }),
      analyzeCodeConceptAndFinalExample({ conversationText: conversationText }),
      generateStruggleNotes({ conversationText: conversationText }) // Call the new flow
    ]);
    console.log('[Action] Summary, Code Analysis, and Struggle Notes results settled:', { summaryResult, codeAnalysisResult, struggleNotesResult });

     // --- Helper function to extract result or null ---
    const getResultOrNull = <T>(settledResult: PromiseSettledResult<T | null>, flowName: string): T | null => {
      if (settledResult.status === 'fulfilled') {
          // Return the value even if it's null or partially empty, let caller decide validity
          console.log(`[Action] ${flowName} flow fulfilled.`);
          return settledResult.value;
      } else {
          console.error(`[Action] Error in ${flowName} flow:`, settledResult.reason);
          return null; // Indicate error
      }
    };

    // --- Process Results ---
    const summaryData = getResultOrNull(summaryResult, 'Summarize Topics');
    const codeAnalysisData = getResultOrNull(codeAnalysisResult, 'Analyze Code');
    const struggleNotesData = getResultOrNull(struggleNotesResult, 'Generate Struggle Notes');

    // Check for critical failure (e.g., summary failed)
    if (!summaryData?.summary || !summaryData?.keyTopics) {
      console.error("[Action] Critical failure: Could not summarize topics.");
      return {
        topicsSummary: '',
        keyTopics: [],
        conceptsMap: null,
        codeAnalysis: codeAnalysisData, // Return whatever was successful
        struggleNotes: struggleNotesData?.notes ?? null, // Return notes if available
        error: 'Could not summarize topics. Analysis incomplete.'
      };
    }

    const { summary: topicsSummary, keyTopics } = summaryData;
    console.log('[Action] Topics summarized successfully.');

    // Use extracted data or null
    const codeAnalysis: AnalyzeCodeOutput | null = codeAnalysisData;
    const struggleNotes: string | null = struggleNotesData?.notes ?? null; // Extract notes string
    console.log('[Action] Code analysis and struggle notes processed (may be null/empty).');


    // Step 3: Map Concepts (depends on summary) - Can still fail gracefully
    console.log('[Action] Starting Concept Mapping...');
    let conceptsMap: MapConceptsOutput | null = null;
    if (topicsSummary) { // Only attempt if summary exists
        const mapInput: MapConceptsInput = {
        mainTopic: topicsSummary,
        conversationText: conversationText,
        };
        try {
            conceptsMap = await mapConcepts(mapInput);
            console.log('[Action] Concepts mapped successfully.');
        } catch (mapError) {
            console.error("[Action] Error mapping concepts:", mapError);
            conceptsMap = null;
        }
    } else {
        console.log('[Action] Skipping Concept Mapping due to missing summary.');
    }


    console.log('[Action] processConversation finished successfully.');
    return {
      topicsSummary,
      keyTopics,
      conceptsMap,
      codeAnalysis,
      struggleNotes, // Include the struggle notes
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
        struggleNotes: null, // Ensure initialized on error
        error: `AI processing failed: ${errorMessage}`,
    };
  }
}
