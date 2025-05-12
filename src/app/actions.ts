
'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
import { analyzeCodeConceptAndFinalExample, AnalyzeCodeOutput } from '@/ai/flows/analyze-code';
import { generateStudyNotes, GenerateStudyNotesOutput } from '@/ai/flows/generate-study-notes';
import { generateQuizTopics, GenerateQuizTopicsOutput, QuizTopic } from '@/ai/flows/generate-quiz-topics';
import { db } from '@/lib/firebase'; // Import Firestore instance
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions

const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// Update the result type to include studyNotes and category
export type ProcessedConversationResult = {
  id?: string; // Add ID for Firestore documents
  timestamp?: any; // For Firestore timestamp (used only for saving)
  originalConversationText?: string; // Keep original text for quiz generation etc.
  topicsSummary: string;
  keyTopics: string[];
  category: string | null;
  conceptsMap: MapConceptsOutput | null;
  codeAnalysis: AnalyzeCodeOutput | null;
  studyNotes: string | null;
  error?: string | null;
};


export async function processConversation(
  prevState: ProcessedConversationResult | null,
  formData: FormData
): Promise<ProcessedConversationResult> {
  console.log('[Action] processConversation started.');

   // Define a default error state structure
  const defaultErrorState = (message: string): ProcessedConversationResult => ({
    topicsSummary: '',
    keyTopics: [],
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
    // Try to keep original text if available in form data, otherwise empty string
    originalConversationText: formData.get('conversationText') as string ?? prevState?.originalConversationText ?? '',
    error: message,
  });


  try {
    const validatedFields = processConversationInputSchema.safeParse({
      conversationText: formData.get('conversationText'),
    });

    if (!validatedFields.success) {
      const errorMsg = validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input.';
      console.error('[Action] Validation failed:', errorMsg);
      // Use defaultErrorState to ensure structure
      return defaultErrorState(errorMsg);
    }

    const { conversationText } = validatedFields.data;
    console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

    let summaryData: SummarizeTopicsOutput | null = null;
    let codeAnalysisData: AnalyzeCodeOutput | null = null;
    let studyNotesData: GenerateStudyNotesOutput | null = null;
    let conceptsMap: MapConceptsOutput | null = null;

    console.log('[Action] Starting AI flows...');
    // Run summary, code analysis, and study notes flow concurrently
    const [summaryResult, codeAnalysisResult, studyNotesResult] = await Promise.allSettled([
      summarizeTopics({ conversation: conversationText }),
      analyzeCodeConceptAndFinalExample({ conversationText: conversationText }),
      generateStudyNotes({ conversationText: conversationText })
    ]);
    console.log('[Action] Summary, Code Analysis, and Study Notes results settled:', { summaryResult, codeAnalysisResult, studyNotesResult });

     // --- Helper function to extract result or null, logging errors ---
    const getResultOrNull = <T>(settledResult: PromiseSettledResult<T | null>, flowName: string): T | null => {
        if (settledResult.status === 'fulfilled') {
            console.log(`[Action] ${flowName} flow fulfilled.`);
            // Handle potential undefined/null return from fulfilled promise
            return settledResult.value !== undefined ? settledResult.value : null;
        } else {
            console.error(`[Action] Error in ${flowName} flow:`, settledResult.reason);
            // Log the reason, but still return null to indicate failure for this part
            return null;
        }
    };

    // --- Process Results ---
    summaryData = getResultOrNull(summaryResult, 'Summarize Topics');
    codeAnalysisData = getResultOrNull(codeAnalysisResult, 'Analyze Code');
    studyNotesData = getResultOrNull(studyNotesResult, 'Generate Study Notes');

    // Check for critical failure (e.g., summary failed or returned invalid data)
    // Ensure summaryData and its essential fields are present
    if (!summaryData || typeof summaryData.summary !== 'string' || !Array.isArray(summaryData.keyTopics)) {
        console.error("[Action] Critical failure: Could not summarize topics or summary data is incomplete/invalid.");
        let errorMsg = 'Could not summarize topics. Analysis incomplete.';
        if (!summaryData) errorMsg = 'Summarize Topics flow failed.';
        else if (typeof summaryData.summary !== 'string') errorMsg = 'Summarize Topics flow returned invalid summary.';
        else if (!Array.isArray(summaryData.keyTopics)) errorMsg = 'Summarize Topics flow returned invalid key topics.';

        // Return default error state, potentially preserving other results if needed for debugging/partial display
         return {
            ...defaultErrorState(errorMsg),
            // Preserve other results if they succeeded, useful for partial display/debugging
            codeAnalysis: codeAnalysisData,
            studyNotes: studyNotesData?.studyNotes ?? null,
            conceptsMap: conceptsMap, // conceptsMap is likely null here anyway
            originalConversationText: conversationText, // Keep the original text
         };
    }

    // Destructure only after validation
    const { summary: topicsSummary, keyTopics, category } = summaryData;
    console.log('[Action] Topics summarized successfully. Category:', category);

    const codeAnalysis: AnalyzeCodeOutput | null = codeAnalysisData; // Null if failed
    const studyNotes: string | null = studyNotesData?.studyNotes ?? null; // Null if failed or empty
    console.log('[Action] Code analysis and study notes processed (may be null/empty).');

    // Step 3: Map Concepts (depends on summary)
    console.log('[Action] Starting Concept Mapping...');
    // Ensure topicsSummary is a non-empty string before proceeding
    if (topicsSummary && typeof topicsSummary === 'string' && topicsSummary.trim().length > 0) {
        const mapInput: MapConceptsInput = {
            mainTopic: topicsSummary, // Use the generated summary
            conversationText: conversationText,
        };
        try {
            // Add specific try/catch for mapConcepts as it runs sequentially after others
            const mapResult = await mapConcepts(mapInput);
            conceptsMap = mapResult; // Assign result if successful
            console.log('[Action] Concepts mapped successfully.');
        } catch (mapError: any) {
            console.error("[Action] Error mapping concepts:", mapError);
            // Don't make this a fatal error, just log and set conceptsMap to null
            conceptsMap = null;
        }
    } else {
        console.log('[Action] Skipping Concept Mapping due to missing or empty summary.');
        conceptsMap = null; // Ensure it's null if skipped
    }


    // --- Prepare data for saving ---
    // Ensure all parts conform to the expected types before saving/returning
    const analysisResultToSave: Omit<ProcessedConversationResult, 'id' | 'error' | 'timestamp'> = {
      originalConversationText: conversationText,
      topicsSummary: topicsSummary || "", // Ensure string
      keyTopics: keyTopics || [], // Ensure array
      category: category ?? null, // Ensure null if undefined/null
      conceptsMap: conceptsMap, // Already handled null case
      codeAnalysis: codeAnalysis, // Already handled null case
      studyNotes: studyNotes ?? null, // Ensure null if undefined/null
    };

    // --- Save to Firestore ---
    try {
        console.log('[Action] Saving analysis to Firestore...');
        const docRef = await addDoc(collection(db, "analyses"), {
            ...analysisResultToSave,
            timestamp: serverTimestamp() // Add server timestamp
        });
        console.log("[Action] Document written with ID: ", docRef.id);

        // Return successful result including saved data and ID
         return {
            ...analysisResultToSave,
            id: docRef.id, // Include the new document ID
            error: null, // Explicitly set error to null on success
        };

    } catch (dbError: any) {
        console.error("[Action] Error adding document to Firestore: ", dbError);
         // Return the processed data but indicate DB save error
         return {
            ...analysisResultToSave,
            id: undefined, // Indicate no ID was assigned
            error: 'AI processing succeeded, but failed to save results to database. Error: ' + (dbError.message || 'Unknown DB error'),
        };
    }


  } catch (error: any) {
    // Catch any unexpected errors during the entire process
    console.error('[Action] Unexpected top-level error processing conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
    // Log stack for debugging on the server
    console.error(error.stack);
    // Return a structured error response
    return defaultErrorState(`AI processing failed: ${errorMessage}`);
  }
}


// --- Existing Action for Generating Quiz Topics (No DB interaction needed here yet) ---

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

    // Check if result is null (flow failed) or topics array is missing/null
    if (!result || !result.quizTopics) {
        const errorMsg = !result ? "Failed to generate quiz topics from AI." : "AI returned invalid quiz topics structure.";
        console.error(`[Action] ${errorMsg}`);
        return { quizTopics: null, error: errorMsg };
    }

     // Success case (even if quizTopics array is empty)
     return { quizTopics: result.quizTopics, error: null };

   } catch(error: any) {
     console.error('[Action] Unexpected error generating quiz topics:', error);
     const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during quiz generation.';
     console.error(error.stack); // Log stack trace
     return { quizTopics: null, error: `Quiz generation failed: ${errorMessage}` };
   }

}
