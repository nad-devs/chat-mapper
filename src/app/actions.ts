
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
  console.log('[Action] processConversation started.'); // Log start

  const validatedFields = processConversationInputSchema.safeParse({
    conversationText: formData.get('conversationText'),
  });

  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input.';
    console.error('[Action] Validation failed:', errorMsg); // Log validation error
    return {
        topicsSummary: '',
        keyTopics: [],
        conceptsMap: null,
        codeAnalysis: null, // Initialize codeAnalysis
        error: errorMsg,
    };
  }

  const { conversationText } = validatedFields.data;
  console.log('[Action] Validation successful. Conversation text length:', conversationText.length); // Log success

  try {
    console.log('[Action] Starting AI flows...'); // Log AI start
    // Run flows concurrently where possible
    const [summaryResult, codeAnalysisResult] = await Promise.allSettled([
      summarizeTopics({ conversation: conversationText }),
      analyzeCodeExamples({ conversationText: conversationText })
    ]);
    console.log('[Action] Summary and Code Analysis results settled:', { summaryResult, codeAnalysisResult }); // Log settlement

    // Handle Summary Result
    if (summaryResult.status === 'rejected' || !summaryResult.value?.summary || !summaryResult.value?.keyTopics) {
      const reason = summaryResult.status === 'rejected' ? summaryResult.reason : 'Missing data';
      console.error("[Action] Error summarizing topics:", reason); // Log summary error
      return { topicsSummary: '', keyTopics: [], conceptsMap: null, codeAnalysis: null, error: 'Could not summarize topics.' };
    }
    const { summary: topicsSummary, keyTopics } = summaryResult.value;
    console.log('[Action] Topics summarized successfully.'); // Log summary success

    // Handle Code Analysis Result (allow it to fail gracefully)
    let codeAnalysis: AnalyzeCodeOutput | null = null;
    if (codeAnalysisResult.status === 'fulfilled' && codeAnalysisResult.value) {
       codeAnalysis = codeAnalysisResult.value;
       console.log('[Action] Code analyzed successfully.'); // Log code analysis success
    } else if (codeAnalysisResult.status === 'rejected') {
       console.error("[Action] Error analyzing code:", codeAnalysisResult.reason); // Log code analysis error
       codeAnalysis = { codeExamples: [] }; // Or null, depending on desired behavior
    }


    // Step 3: Map Concepts (depends on summary)
    console.log('[Action] Starting Concept Mapping...'); // Log concept map start
    const mapInput: MapConceptsInput = {
      mainTopic: topicsSummary, // Use the generated summary paragraph
      conversationText: conversationText,
    };
    // Concept mapping can also run, but might fail - handle gracefully
    let conceptsMap: MapConceptsOutput | null = null;
    try {
        conceptsMap = await mapConcepts(mapInput);
        console.log('[Action] Concepts mapped successfully.'); // Log concept map success
    } catch (mapError) {
        console.error("[Action] Error mapping concepts:", mapError); // Log concept map error
        // Don't block if concept mapping fails
        conceptsMap = null; // Or initialize with empty arrays if preferred
    }


    console.log('[Action] processConversation finished successfully.'); // Log overall success
    return {
      topicsSummary,
      keyTopics,
      conceptsMap,
      codeAnalysis, // Include code analysis results
      error: null,
    };
  } catch (error) {
    // Catch any unexpected errors during Promise.all or other steps
    console.error('[Action] Unexpected error processing conversation:', error); // Log unexpected error
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

