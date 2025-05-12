
'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
import { analyzeCodeConceptAndFinalExample, AnalyzeCodeOutput } from '@/ai/flows/analyze-code';
import { generateStudyNotes, GenerateStudyNotesOutput } from '@/ai/flows/generate-study-notes';
import { generateQuizTopics, GenerateQuizTopicsOutput, QuizTopic } from '@/ai/flows/generate-quiz-topics';
// Removed Firestore imports: import { db } from '@/lib/firebase';
// Removed Firestore imports: import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// Update the result type to remove Firestore-specific fields (id, timestamp)
export type ProcessedConversationResult = {
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

   // Define a default error state structure (without id/timestamp)
  const defaultErrorState = (message: string): ProcessedConversationResult => ({
    topicsSummary: '',
    keyTopics: [],
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
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
      return defaultErrorState(errorMsg);
    }

    const { conversationText } = validatedFields.data;
    console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

    let summaryData: SummarizeTopicsOutput | null = null;
    let codeAnalysisData: AnalyzeCodeOutput | null = null;
    let studyNotesData: GenerateStudyNotesOutput | null = null;
    let conceptsMap: MapConceptsOutput | null = null;

    console.log('[Action] Starting AI flows...');
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
            return settledResult.value !== undefined ? settledResult.value : null;
        } else {
            console.error(`[Action] Error in ${flowName} flow:`, settledResult.reason);
            return null;
        }
    };

    // --- Process Results ---
    summaryData = getResultOrNull(summaryResult, 'Summarize Topics');
    codeAnalysisData = getResultOrNull(codeAnalysisResult, 'Analyze Code');
    studyNotesData = getResultOrNull(studyNotesResult, 'Generate Study Notes');

    if (!summaryData || typeof summaryData.summary !== 'string' || !Array.isArray(summaryData.keyTopics)) {
        console.error("[Action] Critical failure: Could not summarize topics or summary data is incomplete/invalid.");
        let errorMsg = 'Could not summarize topics. Analysis incomplete.';
        if (!summaryData) errorMsg = 'Summarize Topics flow failed.';
        else if (typeof summaryData.summary !== 'string') errorMsg = 'Summarize Topics flow returned invalid summary.';
        else if (!Array.isArray(summaryData.keyTopics)) errorMsg = 'Summarize Topics flow returned invalid key topics.';

         return {
            ...defaultErrorState(errorMsg),
            codeAnalysis: codeAnalysisData,
            studyNotes: studyNotesData?.studyNotes ?? null,
            conceptsMap: conceptsMap,
            originalConversationText: conversationText,
         };
    }

    const { summary: topicsSummary, keyTopics, category } = summaryData;
    console.log('[Action] Topics summarized successfully. Category:', category);

    const codeAnalysis: AnalyzeCodeOutput | null = codeAnalysisData;
    const studyNotes: string | null = studyNotesData?.studyNotes ?? null;
    console.log('[Action] Code analysis and study notes processed (may be null/empty).');

    // Step 3: Map Concepts (depends on summary)
    console.log('[Action] Starting Concept Mapping...');
    if (topicsSummary && typeof topicsSummary === 'string' && topicsSummary.trim().length > 0) {
        const mapInput: MapConceptsInput = {
            mainTopic: topicsSummary,
            conversationText: conversationText,
        };
        try {
            const mapResult = await mapConcepts(mapInput);
            conceptsMap = mapResult;
            console.log('[Action] Concepts mapped successfully.');
        } catch (mapError: any) {
            console.error("[Action] Error mapping concepts:", mapError);
            conceptsMap = null;
        }
    } else {
        console.log('[Action] Skipping Concept Mapping due to missing or empty summary.');
        conceptsMap = null;
    }


    // --- Prepare final result ---
    // This object matches the updated ProcessedConversationResult type
    const analysisResult: ProcessedConversationResult = {
      originalConversationText: conversationText,
      topicsSummary: topicsSummary || "",
      keyTopics: keyTopics || [],
      category: category ?? null,
      conceptsMap: conceptsMap,
      codeAnalysis: codeAnalysis,
      studyNotes: studyNotes ?? null,
      error: null, // Set error to null for success
    };

    console.log("[Action] AI processing complete. Returning results.");
    return analysisResult; // Return the result directly

    // --- Removed Save to Firestore section ---
    /*
    try {
        console.log('[Action] Saving analysis to Firestore...');
        const docRef = await addDoc(collection(db, "analyses"), {
            ...analysisResultToSave,
            timestamp: serverTimestamp()
        });
        console.log("[Action] Document written with ID: ", docRef.id);
         return {
            ...analysisResultToSave,
            id: docRef.id,
            error: null,
        };
    } catch (dbError: any) {
        console.error("[Action] Error adding document to Firestore: ", dbError);
         return {
            ...analysisResultToSave,
            id: undefined,
            error: 'AI processing succeeded, but failed to save results to database. Error: ' + (dbError.message || 'Unknown DB error'),
        };
    }
    */

  } catch (error: any) {
    console.error('[Action] Unexpected top-level error processing conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
    console.error(error.stack);
    return defaultErrorState(`AI processing failed: ${errorMessage}`);
  }
}


// --- Existing Action for Generating Quiz Topics (No DB interaction) ---

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

    if (!result || !result.quizTopics) {
        const errorMsg = !result ? "Failed to generate quiz topics from AI." : "AI returned invalid quiz topics structure.";
        console.error(`[Action] ${errorMsg}`);
        return { quizTopics: null, error: errorMsg };
    }

     return { quizTopics: result.quizTopics, error: null };

   } catch(error: any) {
     console.error('[Action] Unexpected error generating quiz topics:', error);
     const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during quiz generation.';
     console.error(error.stack);
     return { quizTopics: null, error: `Quiz generation failed: ${errorMessage}` };
   }

}

