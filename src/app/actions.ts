
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
  timestamp?: any; // For Firestore timestamp
  originalConversationText?: string; // Keep original text for quiz generation
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

  const validatedFields = processConversationInputSchema.safeParse({
    conversationText: formData.get('conversationText'),
  });

  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input.';
    console.error('[Action] Validation failed:', errorMsg);
    return {
        topicsSummary: '',
        keyTopics: [],
        category: null,
        conceptsMap: null,
        codeAnalysis: null,
        studyNotes: null,
        error: errorMsg,
    };
  }

  const { conversationText } = validatedFields.data;
  console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

  let summaryData: SummarizeTopicsOutput | null = null;
  let codeAnalysisData: AnalyzeCodeOutput | null = null;
  let studyNotesData: GenerateStudyNotesOutput | null = null;
  let conceptsMap: MapConceptsOutput | null = null;

  try {
    console.log('[Action] Starting AI flows...');
    // Run summary, code analysis, and study notes flow concurrently
    const [summaryResult, codeAnalysisResult, studyNotesResult] = await Promise.allSettled([
      summarizeTopics({ conversation: conversationText }),
      analyzeCodeConceptAndFinalExample({ conversationText: conversationText }),
      generateStudyNotes({ conversationText: conversationText })
    ]);
    console.log('[Action] Summary, Code Analysis, and Study Notes results settled:', { summaryResult, codeAnalysisResult, studyNotesResult });

     // --- Helper function to extract result or null ---
    const getResultOrNull = <T>(settledResult: PromiseSettledResult<T | null>, flowName: string): T | null => {
      if (settledResult.status === 'fulfilled') {
          console.log(`[Action] ${flowName} flow fulfilled.`);
          return settledResult.value;
      } else {
          console.error(`[Action] Error in ${flowName} flow:`, settledResult.reason);
          return null; // Indicate error
      }
    };

    // --- Process Results ---
    summaryData = getResultOrNull(summaryResult, 'Summarize Topics');
    codeAnalysisData = getResultOrNull(codeAnalysisResult, 'Analyze Code');
    studyNotesData = getResultOrNull(studyNotesResult, 'Generate Study Notes');

    // Check for critical failure (e.g., summary failed)
    if (!summaryData?.summary || !summaryData?.keyTopics) {
      console.error("[Action] Critical failure: Could not summarize topics.");
      return {
        topicsSummary: '',
        keyTopics: [],
        category: summaryData?.category ?? null,
        conceptsMap: null,
        codeAnalysis: codeAnalysisData,
        studyNotes: studyNotesData?.studyNotes ?? null,
        error: 'Could not summarize topics. Analysis incomplete.'
      };
    }

    const { summary: topicsSummary, keyTopics, category } = summaryData;
    console.log('[Action] Topics summarized successfully. Category:', category);

    const codeAnalysis: AnalyzeCodeOutput | null = codeAnalysisData;
    const studyNotes: string | null = studyNotesData?.studyNotes ?? null;
    console.log('[Action] Code analysis and study notes processed (may be null/empty).');

    // Step 3: Map Concepts (depends on summary)
    console.log('[Action] Starting Concept Mapping...');
    if (topicsSummary) {
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

    // --- Prepare data for saving ---
    const analysisResultToSave: Omit<ProcessedConversationResult, 'id' | 'error' | 'timestamp'> = {
      originalConversationText: conversationText, // Save original text
      topicsSummary,
      keyTopics,
      category,
      conceptsMap, // This might be large, consider if needed
      codeAnalysis,
      studyNotes,
    };

    // --- Save to Firestore ---
    try {
        console.log('[Action] Saving analysis to Firestore...');
        const docRef = await addDoc(collection(db, "analyses"), {
            ...analysisResultToSave,
            timestamp: serverTimestamp() // Add server timestamp
        });
        console.log("[Action] Document written with ID: ", docRef.id);

        // Return successful result including saved data (without timestamp initially)
         return {
            ...analysisResultToSave,
            id: docRef.id, // Include the new document ID
            error: null,
        };

    } catch (dbError) {
        console.error("[Action] Error adding document to Firestore: ", dbError);
         // Return the processed data but indicate DB save error
         return {
            ...analysisResultToSave,
            error: 'AI processing succeeded, but failed to save results to database.',
        };
    }


  } catch (error) {
    console.error('[Action] Unexpected error processing conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return {
        topicsSummary: '',
        keyTopics: [],
        category: null,
        conceptsMap: null,
        codeAnalysis: null,
        studyNotes: null,
        error: `AI processing failed: ${errorMessage}`,
    };
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
