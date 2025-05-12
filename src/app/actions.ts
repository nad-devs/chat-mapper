'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
import { analyzeCodeConceptAndFinalExample, AnalyzeCodeOutput } from '@/ai/flows/analyze-code';
import { generateStudyNotes, GenerateStudyNotesOutput } from '@/ai/flows/generate-study-notes'; // Updated import
// Import the new quiz flow and its types
import { generateQuizTopics, GenerateQuizTopicsOutput, QuizTopic } from '@/ai/flows/generate-quiz-topics';


const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// Update the result type to include studyNotes
export type ProcessedConversationResult = {
  originalConversationText?: string; // Keep original text for quiz generation
  topicsSummary: string;
  keyTopics: string[];
  conceptsMap: MapConceptsOutput | null;
  codeAnalysis: AnalyzeCodeOutput | null;
  studyNotes: string | null; // Updated field name
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
        studyNotes: null, // Initialize studyNotes
        error: errorMsg,
    };
  }

  const { conversationText } = validatedFields.data;
  console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

  try {
    console.log('[Action] Starting AI flows...');
    // Run summary, code analysis, and study notes flow concurrently
    const [summaryResult, codeAnalysisResult, studyNotesResult] = await Promise.allSettled([
      summarizeTopics({ conversation: conversationText }),
      analyzeCodeConceptAndFinalExample({ conversationText: conversationText }),
      generateStudyNotes({ conversationText: conversationText }) // Call the updated flow
    ]);
    console.log('[Action] Summary, Code Analysis, and Study Notes results settled:', { summaryResult, codeAnalysisResult, studyNotesResult });

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
    const studyNotesData = getResultOrNull(studyNotesResult, 'Generate Study Notes'); // Updated flow name

    // Check for critical failure (e.g., summary failed)
    if (!summaryData?.summary || !summaryData?.keyTopics) {
      console.error("[Action] Critical failure: Could not summarize topics.");
      return {
        topicsSummary: '',
        keyTopics: [],
        conceptsMap: null,
        codeAnalysis: codeAnalysisData, // Return whatever was successful
        studyNotes: studyNotesData?.studyNotes ?? null, // Return notes if available (updated field)
        error: 'Could not summarize topics. Analysis incomplete.'
      };
    }

    const { summary: topicsSummary, keyTopics } = summaryData;
    console.log('[Action] Topics summarized successfully.');

    // Use extracted data or null
    const codeAnalysis: AnalyzeCodeOutput | null = codeAnalysisData;
    const studyNotes: string | null = studyNotesData?.studyNotes ?? null; // Extract notes string (updated field)
    console.log('[Action] Code analysis and study notes processed (may be null/empty).');


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
      originalConversationText: conversationText, // Store original text
      topicsSummary,
      keyTopics,
      conceptsMap,
      codeAnalysis,
      studyNotes, // Include the study notes (updated field)
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
        studyNotes: null, // Ensure initialized on error
        error: `AI processing failed: ${errorMessage}`,
    };
  }
}


// --- New Action for Generating Quiz Topics ---

const generateQuizInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
  count: z.number().optional(),
});

export type GenerateQuizResult = {
  quizTopics: QuizTopic[] | null;
  error?: string | null;
}

export async function generateQuizTopicsAction(
  prevState: GenerateQuizResult | null,
  formData: FormData
): Promise<GenerateQuizResult> {
   console.log('[Action] generateQuizTopicsAction started.');

  const validatedFields = generateQuizInputSchema.safeParse({
    conversationText: formData.get('conversationText'),
    count: formData.get('count') ? parseInt(formData.get('count') as string, 10) : undefined,
  });

   if (!validatedFields.success) {
    const errorMsg = validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input for quiz generation.';
    console.error('[Action] Quiz Validation failed:', errorMsg);
    return { quizTopics: null, error: errorMsg };
  }

  const { conversationText, count } = validatedFields.data;

   try {
    console.log('[Action] Calling generateQuizTopics flow...');
    const result = await generateQuizTopics({ conversationText, count });
    console.log('[Action] generateQuizTopics flow completed. Result:', result);

    if (!result) {
        return { quizTopics: null, error: "Failed to generate quiz topics from AI." };
    }

     return { quizTopics: result.quizTopics, error: null };

   } catch(error) {
     console.error('[Action] Unexpected error generating quiz topics:', error);
     const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during quiz generation.';
     return { quizTopics: null, error: `Quiz generation failed: ${errorMessage}` };
   }

}
