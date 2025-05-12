'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
import { analyzeCodeConceptAndFinalExample, AnalyzeCodeOutput } from '@/ai/flows/analyze-code';
import { generateStudyNotes, GenerateStudyNotesOutput } from '@/ai/flows/generate-study-notes';
import { generateQuizTopics, GenerateQuizTopicsOutput, QuizTopic } from '@/ai/flows/generate-quiz-topics';
// Import Firestore related functions
import { db, serverTimestamp } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';

// --- Data Structures ---

// Structure for storing entries in Firestore
export interface LearningEntry {
  id?: string; // Firestore ID
  topicName: string;
  type: 'study-notes' | 'code-snippet' | 'summary';
  content: string;
  category: string | null; // Added category field
  createdAt: Timestamp; // Firestore Timestamp for ordering
  // Add a simple string version for client-side serialization if needed
  createdAtISO?: string;
}

const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// Result type for the main processing action
export type ProcessedConversationResult = {
  originalConversationText: string;
  topicsSummary: string | null;
  keyTopics: string[] | null;
  category: string | null;
  conceptsMap: MapConceptsOutput | null;
  codeAnalysis: AnalyzeCodeOutput | null;
  studyNotes: string | null;
  error?: string | null;
};

// --- Main Conversation Processing Action ---

export async function processConversation(
  prevState: ProcessedConversationResult | null,
  formData: FormData
): Promise<ProcessedConversationResult> {
  console.log('[Action] processConversation started.');

   // Default error state
  const defaultErrorState = (message: string, conversationText: string = ''): ProcessedConversationResult => ({
    topicsSummary: null,
    keyTopics: null,
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
    originalConversationText: conversationText,
    error: message || 'An unknown error occurred.',
  });

  let conversationText = formData.get('conversationText') as string ?? prevState?.originalConversationText ?? '';

  try {
    const validatedFields = processConversationInputSchema.safeParse({
      conversationText: conversationText,
    });

    if (!validatedFields.success) {
      const errorMsg = validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input.';
      console.error('[Action] Validation failed:', errorMsg);
       return JSON.parse(JSON.stringify(defaultErrorState(errorMsg, conversationText)));
    }

    conversationText = validatedFields.data.conversationText;
    console.log('[Action] Validation successful.');

    let summaryData: SummarizeTopicsOutput | null = null;
    let codeAnalysisData: AnalyzeCodeOutput | null = null;
    let studyNotesData: GenerateStudyNotesOutput | null = null;
    let conceptsMap: MapConceptsOutput | null = null;
    let processingError: string | null = null;

    console.log('[Action] Starting AI flows...');
    let settledResults: PromiseSettledResult<any>[] = [];
    try {
        settledResults = await Promise.allSettled([
            summarizeTopics({ conversation: conversationText }),
            analyzeCodeConceptAndFinalExample({ conversationText: conversationText }),
            generateStudyNotes({ conversationText: conversationText })
        ]);
    } catch (aiError: any) {
         const errorMsg = `Failed to initiate AI processing: ${aiError.message}`;
         console.error('[Action] Error during Promise.allSettled for AI flows:', aiError);
         return JSON.parse(JSON.stringify(defaultErrorState(errorMsg, conversationText)));
    }

    console.log('[Action] AI flows results settled.');

    const getResultOrNull = <T>(settledResult: PromiseSettledResult<T | null>, flowName: string): T | null => {
        if (settledResult.status === 'fulfilled') {
            console.log(`[Action] ${flowName} flow fulfilled successfully.`);
             if (settledResult.value === null || settledResult.value === undefined) {
                console.warn(`[Action] ${flowName} flow fulfilled but returned null/undefined.`);
                return null;
            }
            return settledResult.value;
        } else {
            const reason = settledResult.reason instanceof Error ? settledResult.reason.message : String(settledResult.reason);
            console.error(`[Action] Error in ${flowName} flow:`, reason);
            if (!processingError) {
                processingError = `Error during ${flowName}: ${reason}`;
            }
            return null;
        }
    };

    summaryData = getResultOrNull(settledResults[0], 'Summarize Topics');
    codeAnalysisData = getResultOrNull(settledResults[1], 'Analyze Code');
    studyNotesData = getResultOrNull(settledResults[2], 'Generate Study Notes');

    if (processingError) {
        console.warn(`[Action] Proceeding with partial results due to AI error: ${processingError}`);
    }

    const topicsSummary = summaryData?.summary ?? null;
    const keyTopics = summaryData?.keyTopics ?? null;
    const category = summaryData?.category ?? null;
    const codeAnalysis = codeAnalysisData;
    const studyNotes = studyNotesData?.studyNotes ?? null;

    console.log('[Action] AI results processed.');

    // Concept Mapping (depends on summary)
    if (topicsSummary && topicsSummary.trim().length > 0) {
         console.log('[Action] Starting Concept Mapping...');
         const mapInput: MapConceptsInput = {
             mainTopic: topicsSummary,
             conversationText: conversationText,
         };
         try {
             conceptsMap = await mapConcepts(mapInput);
             console.log('[Action] Concepts mapped successfully.');
         } catch (mapError: any) {
             const reason = mapError instanceof Error ? mapError.message : String(mapError);
             console.error("[Action] Error mapping concepts:", reason);
             conceptsMap = null;
             if (!processingError) {
                processingError = `Error during Concept Mapping: ${reason}`;
             }
         }
     } else {
         console.log('[Action] Skipping Concept Mapping due to missing or empty summary.');
         conceptsMap = null;
     }

    // --- Prepare final result for UI ---
    const finalError = processingError || null;

    const analysisResult: ProcessedConversationResult = {
      originalConversationText: conversationText,
      topicsSummary: topicsSummary,
      keyTopics: keyTopics,
      category: category,
      conceptsMap: conceptsMap,
      codeAnalysis: codeAnalysis,
      studyNotes: studyNotes,
      error: finalError,
    };

    console.log("[Action] ProcessConversation action complete.");
    if (finalError) {
        console.error(`[Action] Final error state being returned: ${finalError}`);
    }

    // Force serialization before returning
    try {
        const serializableResult = JSON.parse(JSON.stringify(analysisResult));
        console.log("[Action] Returning serializable analysis result.");
        return serializableResult;
    } catch (stringifyError: any) {
        console.error("[Action] Error stringifying analysis result:", stringifyError);
        const errorMsg = `Failed to serialize analysis results: ${stringifyError.message}`;
        try {
            return JSON.parse(JSON.stringify(defaultErrorState(errorMsg, conversationText)));
        } catch (innerStringifyError) {
             console.error("[Action] Error stringifying the default error state after another stringify error:", innerStringifyError);
             return {
                 topicsSummary: null, keyTopics: null, category: null, conceptsMap: null,
                 codeAnalysis: null, studyNotes: null, originalConversationText: conversationText,
                 error: "Analysis failed and result could not be serialized."
             };
        }
    }


  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
    console.error('[Action] Unexpected top-level error in processConversation:', errorMessage);
    if (error.stack) console.error(error.stack);
    try {
      return JSON.parse(JSON.stringify(defaultErrorState(`Processing failed unexpectedly: ${errorMessage}`, conversationText)));
    } catch (stringifyError) {
        console.error("[Action] Error stringifying the top-level error state:", stringifyError);
        return {
            topicsSummary: null, keyTopics: null, category: null, conceptsMap: null,
            codeAnalysis: null, studyNotes: null, originalConversationText: conversationText,
            error: "Processing failed unexpectedly and error state could not be serialized."
        };
    }
  }
}

// --- Action for Generating Quiz Topics ---

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
   let conversationText: string | undefined;

   const defaultQuizErrorState = (message: string): GenerateQuizResult => ({
       quizTopics: null,
       error: message || 'An unknown error occurred during quiz generation.',
   });

   try {
        conversationText = formData.get('conversationText') as string;
        const countRaw = formData.get('count') as string | null;
        const count = countRaw ? parseInt(countRaw, 10) : undefined;

        const validatedFields = generateQuizInputSchema.safeParse({
            conversationText: conversationText,
            count: count,
        });

        if (!validatedFields.success) {
            const errorMsg = validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input for quiz generation.';
            console.error('[Action] Quiz Validation failed:', errorMsg);
            try {
               return JSON.parse(JSON.stringify(defaultQuizErrorState(errorMsg)));
            } catch (e) { return { quizTopics: null, error: "Quiz generation failed validation." }; }
        }

        const { conversationText: validText, count: validCount } = validatedFields.data;

        console.log('[Action] Calling generateQuizTopics flow...');
        const result = await generateQuizTopics({ conversationText: validText, count: validCount });
        console.log('[Action] generateQuizTopics flow completed.');

        if (!result || !result.quizTopics) {
            const errorMsg = !result ? "Failed to generate quiz topics from AI (null result)." : "AI returned no quiz topics or invalid structure.";
            console.warn(`[Action] ${errorMsg}`);
            try {
               return JSON.parse(JSON.stringify({ quizTopics: null, error: "Could not generate specific quiz topics from this conversation." }));
            } catch (e) { return { quizTopics: null, error: "Could not generate specific quiz topics." }; }
        }

        console.log(`[Action] Generated ${result.quizTopics.length} quiz topics.`);
        try {
            return JSON.parse(JSON.stringify({ quizTopics: result.quizTopics, error: null }));
        } catch (e) {
            console.error("[Action] Error stringifying successful quiz results:", e);
            return { quizTopics: null, error: "Failed to format quiz topics." };
        }

   } catch(error: any) {
     const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during quiz generation.';
     console.error('[Action] Unexpected error generating quiz topics:', errorMessage);
     if (error.stack) console.error(error.stack);
     try {
        return JSON.parse(JSON.stringify(defaultQuizErrorState(`Quiz generation failed: ${errorMessage}`)));
     } catch (e) { return { quizTopics: null, error: "Quiz generation failed unexpectedly." }; }
   }
}

// --- Action for Saving Individual Entries (Notes, Code, Summary) ---

const saveEntryInputSchema = z.object({
  topicName: z.string().min(1, 'Topic name cannot be empty.'),
  contentType: z.enum(['study-notes', 'code-snippet', 'summary']),
  content: z.string().min(1, 'Content cannot be empty.'),
  category: z.string().nullable().optional(), // Added category to schema
});

export type SaveEntryResult = {
  success: boolean;
  error?: string | null;
  info?: string | null; // For success messages
}

export async function saveEntryAction(
  prevState: SaveEntryResult | null,
  formData: FormData
): Promise<SaveEntryResult> {
    console.log('[Action] saveEntryAction started.');

    const validatedFields = saveEntryInputSchema.safeParse({
        topicName: formData.get('topicName'),
        contentType: formData.get('contentType'),
        content: formData.get('content'),
        category: formData.get('category'), // Get category from form data
    });

    if (!validatedFields.success) {
        const errorMsg = validatedFields.error.flatten().fieldErrors.contentType?.[0] ||
                         validatedFields.error.flatten().fieldErrors.topicName?.[0] ||
                         validatedFields.error.flatten().fieldErrors.content?.[0] ||
                         validatedFields.error.flatten().fieldErrors.category?.[0] ||
                         'Invalid input for saving entry.';
        console.error('[Action] Save Entry Validation failed:', errorMsg);
        return { success: false, error: errorMsg };
    }

    const { topicName, contentType, content, category } = validatedFields.data;
    const entryType = contentType; // Rename for clarity

    console.log(`[Action] Attempting to save entry: Type=${entryType}, Topic=${topicName.substring(0, 50)}, Category=${category ?? 'N/A'}...`);

    try {
        const docRef = await addDoc(collection(db, "learningEntries"), {
            topicName: topicName,
            type: entryType,
            content: content,
            category: category ?? null, // Save category (or null if not provided)
            createdAt: serverTimestamp()
        });
        console.log("[Action] Document written with ID: ", docRef.id);
        const successMsg = `${entryType.replace('-', ' ')} saved successfully!`;
        return { success: true, error: null, info: successMsg };
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while saving to Firestore.';
        console.error("[Action] Error saving document to Firestore:", errorMessage);
        if (error.stack) console.error(error.stack);
        return { success: false, error: `Failed to save ${entryType}: ${errorMessage}` };
    }
}


// --- Action for Fetching Learning Entries ---
export type GetLearningEntriesResult = {
    entries: LearningEntry[] | null;
    error?: string | null;
};

export async function getLearningEntriesAction(): Promise<GetLearningEntriesResult> {
    console.log('[Action] getLearningEntriesAction started.');
    try {
        const entriesCollection = collection(db, "learningEntries");
        const q = query(entriesCollection, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const entries: LearningEntry[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Convert Firestore Timestamp to ISO string for serialization
            const createdAt = data.createdAt as Timestamp;
            entries.push({
                id: doc.id,
                topicName: data.topicName,
                type: data.type,
                content: data.content,
                category: data.category ?? null, // Fetch category, default to null if missing
                createdAt: createdAt, // Keep original Timestamp for potential server-side use
                createdAtISO: createdAt.toDate().toISOString(), // Add ISO string for client
            });
        });

        console.log(`[Action] Fetched ${entries.length} learning entries.`);
        // Ensure the result is serializable
        return JSON.parse(JSON.stringify({ entries: entries, error: null }));

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while fetching learning entries.';
        console.error("[Action] Error fetching documents from Firestore:", errorMessage);
        if (error.stack) console.error(error.stack);
         // Ensure the error result is serializable
        return JSON.parse(JSON.stringify({ entries: null, error: `Failed to fetch learning entries: ${errorMessage}` }));
    }
}
