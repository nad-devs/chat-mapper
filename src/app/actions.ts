
'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
import { analyzeCodeConceptAndFinalExample, AnalyzeCodeOutput } from '@/ai/flows/analyze-code';
import { generateStudyNotes, GenerateStudyNotesOutput } from '@/ai/flows/generate-study-notes';
import { generateQuizTopics, GenerateQuizTopicsOutput, QuizTopic } from '@/ai/flows/generate-quiz-topics';
import { db } from '@/lib/firebase'; // Import Firestore db instance
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Import Firestore functions

// --- Firestore Data Structure ---
type LearningEntryType = "summary" | "study-notes" | "code-analysis"; // Define possible types

// Input type for saving (timestamp is added by Firestore)
interface LearningEntryInput {
  topicName: string; // Derived from category or summary
  type: LearningEntryType;
  content: string | SummarizeTopicsOutput | AnalyzeCodeOutput; // Flexible content based on type
}

// Type representing a saved document in Firestore (includes ID and Timestamp)
export interface LearningEntry extends LearningEntryInput {
    id: string;
    timestamp: Timestamp;
}

// --- Server Action to Save Entry ---
async function saveLearningEntry(entryData: LearningEntryInput): Promise<string | null> {
    try {
        console.log(`[Action] Attempting to save learning entry of type: ${entryData.type} for topic: ${entryData.topicName}`);
        const docRef = await addDoc(collection(db, "learningEntries"), {
            ...entryData,
            timestamp: serverTimestamp() // Add server-side timestamp
        });
        console.log(`[Action] Learning entry type '${entryData.type}' saved successfully with ID:`, docRef.id);
        return docRef.id; // Return the new document ID
    } catch (error: any) {
        // Log the specific error from Firestore
        console.error(`[Action] Firestore error saving learning entry type '${entryData.type}':`, error);
        console.error(`[Action] Firestore error code: ${error.code}, message: ${error.message}`);
        // Log the data that failed to save (be careful with sensitive data in production logs)
        // console.error("[Action] Data that failed to save:", entryData);
        return null; // Indicate failure
    }
}


const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// This result type is what the *action* returns to the *UI*.
// It no longer needs Firestore-specific fields like id/timestamp.
// The error field can now also indicate DB saving errors.
export type ProcessedConversationResult = {
  originalConversationText?: string;
  topicsSummary: string;
  keyTopics: string[];
  category: string | null;
  conceptsMap: MapConceptsOutput | null;
  codeAnalysis: AnalyzeCodeOutput | null;
  studyNotes: string | null;
  error?: string | null; // Can contain AI or DB errors
};


export async function processConversation(
  prevState: ProcessedConversationResult | null,
  formData: FormData
): Promise<ProcessedConversationResult> {
  console.log('[Action] processConversation started.');

   // Define a default error state structure
  const defaultErrorState = (message: string, conversationText: string): ProcessedConversationResult => ({
    topicsSummary: '',
    keyTopics: [],
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
    originalConversationText: conversationText,
    error: message,
  });

  let conversationText = formData.get('conversationText') as string ?? prevState?.originalConversationText ?? '';

  try {
    const validatedFields = processConversationInputSchema.safeParse({
      conversationText: conversationText,
    });

    if (!validatedFields.success) {
      const errorMsg = validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input.';
      console.error('[Action] Validation failed:', errorMsg);
      return defaultErrorState(errorMsg, conversationText);
    }

    // Reassign conversationText from validated data to be safe
    conversationText = validatedFields.data.conversationText;
    console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

    let summaryData: SummarizeTopicsOutput | null = null;
    let codeAnalysisData: AnalyzeCodeOutput | null = null;
    let studyNotesData: GenerateStudyNotesOutput | null = null;
    let conceptsMap: MapConceptsOutput | null = null;
    let saveError: string | null = null; // Track DB save errors separately

    console.log('[Action] Starting AI flows...');
    // Wrap AI calls in try-catch just in case Promise.allSettled itself fails or setup fails
    let settledResults: PromiseSettledResult<any>[] = [];
    try {
        settledResults = await Promise.allSettled([
            summarizeTopics({ conversation: conversationText }),
            analyzeCodeConceptAndFinalExample({ conversationText: conversationText }),
            generateStudyNotes({ conversationText: conversationText })
        ]);
    } catch (aiError: any) {
         console.error('[Action] Error during Promise.allSettled for AI flows:', aiError);
         return defaultErrorState(`Failed to initiate AI processing: ${aiError.message}`, conversationText);
    }

    console.log('[Action] AI flows results settled:', {
        summaryResult: settledResults[0],
        codeAnalysisResult: settledResults[1],
        studyNotesResult: settledResults[2]
    });

     // --- Helper function to extract result or null, logging errors ---
    const getResultOrNull = <T>(settledResult: PromiseSettledResult<T | null>, flowName: string): T | null => {
        if (settledResult.status === 'fulfilled') {
            console.log(`[Action] ${flowName} flow fulfilled.`);
            // Check if the value is actually null or undefined explicitly
            return settledResult.value !== undefined && settledResult.value !== null ? settledResult.value : null;
        } else {
            // Log the reason for rejection
            console.error(`[Action] Error in ${flowName} flow:`, settledResult.reason);
            return null;
        }
    };

    // --- Process Results ---
    summaryData = getResultOrNull(settledResults[0], 'Summarize Topics');
    codeAnalysisData = getResultOrNull(settledResults[1], 'Analyze Code');
    studyNotesData = getResultOrNull(settledResults[2], 'Generate Study Notes');

    // --- CRITICAL CHECK: Ensure summaryData is valid before proceeding ---
    // We need at least the summary or category to determine the topicName for saving.
    if (!summaryData || typeof summaryData.summary !== 'string' || !Array.isArray(summaryData.keyTopics)) {
        console.error("[Action] Critical failure: Could not summarize topics or summary data is incomplete/invalid.");
        let errorMsg = 'Could not summarize topics. Analysis incomplete.';
        if (!summaryData) errorMsg = 'Summarize Topics flow failed or returned null.';
        else if (typeof summaryData.summary !== 'string') errorMsg = 'Summarize Topics flow returned invalid summary type.';
        else if (!Array.isArray(summaryData.keyTopics)) errorMsg = 'Summarize Topics flow returned invalid key topics type.';

         // Return partial results if possible, but indicate the critical failure
         return {
            topicsSummary: '',
            keyTopics: [],
            category: null,
            conceptsMap: null, // Will be null anyway
            codeAnalysis: codeAnalysisData, // Return if available
            studyNotes: studyNotesData?.studyNotes ?? null, // Return if available
            originalConversationText: conversationText,
            error: errorMsg, // Set the critical error message
         };
    }

    const { summary: topicsSummary, keyTopics, category } = summaryData;
    console.log('[Action] Topics summarized successfully. Category:', category);

    const codeAnalysis: AnalyzeCodeOutput | null = codeAnalysisData;
    const studyNotes: string | null = studyNotesData?.studyNotes ?? null;
    console.log('[Action] Code analysis and study notes processed (may be null/empty).');

    // --- Concept Mapping (Optional based on summary) ---
    console.log('[Action] Starting Concept Mapping...');
    if (topicsSummary && topicsSummary.trim().length > 0) {
        const mapInput: MapConceptsInput = {
            mainTopic: topicsSummary, // Use summary as main topic for mapping
            conversationText: conversationText,
        };
        try {
            const mapResult = await mapConcepts(mapInput);
            conceptsMap = mapResult;
            console.log('[Action] Concepts mapped successfully.');
        } catch (mapError: any) {
            console.error("[Action] Error mapping concepts:", mapError);
            conceptsMap = null; // Set to null on error, don't stop processing
        }
    } else {
        console.log('[Action] Skipping Concept Mapping due to missing or empty summary.');
        conceptsMap = null;
    }

    // --- Save Results to Firestore ---
    const topicName = category || topicsSummary?.substring(0, 50) || "Untitled Conversation"; // Use category, fallback to summary snippet or default

    const savePromises: Promise<string | null>[] = [];

    // Prepare data for saving summary
    const summaryEntryData: LearningEntryInput | null = (topicsSummary || (keyTopics && keyTopics.length > 0)) ? {
        topicName: topicName,
        type: "summary",
        content: { summary: topicsSummary || "", keyTopics: keyTopics || [], category: category ?? null } // Ensure content matches schema
    } : null;

    // Prepare data for saving study notes
    const notesEntryData: LearningEntryInput | null = (studyNotes && studyNotes.trim().length > 0) ? {
        topicName: topicName,
        type: "study-notes",
        content: studyNotes // Store the notes string
    } : null;

     // Prepare data for saving code analysis
    const codeEntryData: LearningEntryInput | null = (codeAnalysis && (codeAnalysis.learnedConcept || codeAnalysis.finalCodeSnippet)) ? {
        topicName: topicName,
        type: "code-analysis",
        content: codeAnalysis // Store the whole code analysis object
    } : null;

    // Add save promises only if data exists
    if (summaryEntryData) savePromises.push(saveLearningEntry(summaryEntryData));
    if (notesEntryData) savePromises.push(saveLearningEntry(notesEntryData));
    if (codeEntryData) savePromises.push(saveLearningEntry(codeEntryData));

     // Wait for all save operations to complete
    if (savePromises.length > 0) {
        console.log(`[Action] Attempting to save ${savePromises.length} entries to Firestore...`);
        try {
            const saveResults = await Promise.allSettled(savePromises);
             let failedSaves = 0;
             saveResults.forEach((result, index) => {
                 const entryType = [summaryEntryData?.type, notesEntryData?.type, codeEntryData?.type].filter(Boolean)[index]; // Get corresponding type
                 if (result.status === 'rejected') {
                     failedSaves++;
                     console.error(`[Action] Failed to save learning entry type '${entryType}'. Reason:`, result.reason);
                 } else if (result.status === 'fulfilled' && result.value === null) {
                     failedSaves++;
                     // Error already logged in saveLearningEntry
                     console.error(`[Action] Firestore save failed internally for entry type '${entryType}'. Check previous logs.`);
                 } else if (result.status === 'fulfilled' && result.value !== null) {
                     console.log(`[Action] Successfully saved learning entry type '${entryType}' (ID: ${result.value})`);
                 }
             });
              if (failedSaves > 0) {
                 saveError = `AI processing succeeded, but failed to save ${failedSaves} learning entr${failedSaves > 1 ? 'ies' : 'y'} to the database. Check server logs for details. Firestore permissions or configuration might be incorrect.`;
             }

        } catch (saveAllError: any) {
             console.error('[Action] Error during Promise.allSettled for saving entries:', saveAllError);
             saveError = `AI processing succeeded, but encountered an error while attempting to save entries: ${saveAllError.message}`;
        }

    } else {
        console.log("[Action] No entries generated with content to save to Firestore.");
    }


    // --- Prepare final result for UI ---
    const analysisResult: ProcessedConversationResult = {
      originalConversationText: conversationText,
      topicsSummary: topicsSummary || "",
      keyTopics: keyTopics || [],
      category: category ?? null,
      conceptsMap: conceptsMap,
      codeAnalysis: codeAnalysis,
      studyNotes: studyNotes ?? null,
      error: saveError, // Pass DB save error (if any) to UI
    };

    console.log("[Action] AI processing and saving attempts complete. Returning results to UI.");
    return analysisResult;

  } catch (error: any) {
    // Catch any unexpected errors during the entire process
    console.error('[Action] Unexpected top-level error processing conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
     // Log the stack trace if available
    if (error.stack) {
        console.error(error.stack);
    }
    // Ensure the error is passed back to the UI state
    // Make sure to pass the original conversation text back
    return defaultErrorState(`Processing failed unexpectedly: ${errorMessage}`, conversationText);
  }
}


// --- Existing Action for Generating Quiz Topics (No DB interaction needed here) ---

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

    // Check if result itself is null or if quizTopics is null/undefined
    if (!result || !result.quizTopics) {
        const errorMsg = !result ? "Failed to generate quiz topics from AI (null result)." : "AI returned no quiz topics or invalid structure.";
        console.error(`[Action] ${errorMsg}`);
        // Return null for topics but provide an error message
        return { quizTopics: null, error: errorMsg };
    }

     // Return the topics (even if empty array) and no error
     return { quizTopics: result.quizTopics, error: null };

   } catch(error: any) {
     console.error('[Action] Unexpected error generating quiz topics:', error);
     const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during quiz generation.';
     console.error(error.stack);
     return { quizTopics: null, error: `Quiz generation failed: ${errorMessage}` };
   }

}

