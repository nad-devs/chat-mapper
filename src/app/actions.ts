
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
        const docRef = await addDoc(collection(db, "learningEntries"), {
            ...entryData,
            timestamp: serverTimestamp() // Add server-side timestamp
        });
        console.log("[Action] Learning entry saved with ID:", docRef.id);
        return docRef.id; // Return the new document ID
    } catch (error) {
        console.error("[Action] Error saving learning entry to Firestore:", error);
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
    let saveError: string | null = null; // Track DB save errors separately

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
            // Check if the value is actually null or undefined explicitly
            return settledResult.value !== undefined && settledResult.value !== null ? settledResult.value : null;
        } else {
            console.error(`[Action] Error in ${flowName} flow:`, settledResult.reason);
            return null;
        }
    };

    // --- Process Results ---
    summaryData = getResultOrNull(summaryResult, 'Summarize Topics');
    codeAnalysisData = getResultOrNull(codeAnalysisResult, 'Analyze Code');
    studyNotesData = getResultOrNull(studyNotesResult, 'Generate Study Notes');

    // --- CRITICAL CHECK: Ensure summaryData is valid before proceeding ---
    // We need at least the summary or category to determine the topicName for saving.
    if (!summaryData || typeof summaryData.summary !== 'string' || !Array.isArray(summaryData.keyTopics)) {
        console.error("[Action] Critical failure: Could not summarize topics or summary data is incomplete/invalid.");
        let errorMsg = 'Could not summarize topics. Analysis incomplete.';
        if (!summaryData) errorMsg = 'Summarize Topics flow failed.';
        else if (typeof summaryData.summary !== 'string') errorMsg = 'Summarize Topics flow returned invalid summary.';
        else if (!Array.isArray(summaryData.keyTopics)) errorMsg = 'Summarize Topics flow returned invalid key topics.';

         return {
            ...defaultErrorState(errorMsg),
            // Still return any partial results that might have succeeded
            codeAnalysis: codeAnalysisData,
            studyNotes: studyNotesData?.studyNotes ?? null,
            conceptsMap: conceptsMap, // conceptsMap will be null here anyway
            originalConversationText: conversationText,
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

    // Save Summary Entry
    if (topicsSummary || keyTopics.length > 0) {
         savePromises.push(saveLearningEntry({
            topicName: topicName,
            type: "summary",
            content: { summary: topicsSummary, keyTopics: keyTopics, category: category } // Store the whole summary object
        }));
    }

    // Save Study Notes Entry
    if (studyNotes && studyNotes.trim().length > 0) {
         savePromises.push(saveLearningEntry({
            topicName: topicName,
            type: "study-notes",
            content: studyNotes // Store the notes string
        }));
    }

     // Save Code Analysis Entry (only if there's actual content)
    if (codeAnalysis && (codeAnalysis.learnedConcept || codeAnalysis.finalCodeSnippet)) {
        savePromises.push(saveLearningEntry({
            topicName: topicName,
            type: "code-analysis",
            content: codeAnalysis // Store the whole code analysis object
        }));
    }

     // Wait for all save operations to complete
    if (savePromises.length > 0) {
        console.log(`[Action] Attempting to save ${savePromises.length} entries to Firestore...`);
        const saveResults = await Promise.allSettled(savePromises);
        saveResults.forEach((result, index) => {
            if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value === null)) {
                console.error(`[Action] Failed to save learning entry type: ${['summary', 'study-notes', 'code-analysis'][index]}`);
                saveError = "AI processing succeeded, but failed to save some learning entries to the database."; // Set a general save error
            } else if (result.status === 'fulfilled' && result.value !== null) {
                 console.log(`[Action] Successfully saved learning entry (ID: ${result.value}) type: ${['summary', 'study-notes', 'code-analysis'][index]}`);
            }
        });
    } else {
        console.log("[Action] No entries generated to save to Firestore.");
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
    console.error('[Action] Unexpected top-level error processing conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
    console.error(error.stack);
    // Ensure the error is passed back to the UI state
    return defaultErrorState(`AI processing failed: ${errorMessage}`);
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
