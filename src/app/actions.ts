'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
import { analyzeCodeConceptAndFinalExample, AnalyzeCodeOutput } from '@/ai/flows/analyze-code';
import { generateStudyNotes, GenerateStudyNotesOutput } from '@/ai/flows/generate-study-notes';
import { generateQuizTopics, GenerateQuizTopicsOutput, QuizTopic } from '@/ai/flows/generate-quiz-topics';
// Import Firestore related functions
import { db, serverTimestamp } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';

// --- Data Structures ---

// Updated structure for storing entries in Firestore as a single document per conversation analysis
export interface LearningEntry {
  id?: string; // Firestore ID
  topicName: string; // Primary topic/concept name for display
  learningSummary?: string | null; // The new bulleted list summary
  codeSnippetContent?: string | null;
  codeLanguage?: string | null;
  studyNotesContent?: string | null;
  category: string | null;
  createdAt: Timestamp; // Firestore Timestamp for ordering
  createdAtISO?: string; // ISO string for client-side serialization
}


const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// Result type for the main processing action - updated topicsSummary to learningSummary
export type ProcessedConversationResult = {
  originalConversationText: string;
  learningSummary: string | null; 
  mainProblemOrTopicName: string | null; // Added for specific title generation
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

  const defaultErrorState = (message: string, conversationText: string = ''): ProcessedConversationResult => ({
    learningSummary: null, 
    mainProblemOrTopicName: null,
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

    const learningSummary = summaryData?.learningSummary ?? null; 
    const mainProblemOrTopicName = summaryData?.mainProblemOrTopicName ?? null;
    const keyTopics = summaryData?.keyTopics ?? null;
    const category = summaryData?.category ?? null;
    const codeAnalysis = codeAnalysisData; 
    const studyNotes = studyNotesData?.studyNotes ?? null;

    console.log('[Action] AI results processed.');

    const mainTopicForMapping = mainProblemOrTopicName || (keyTopics && keyTopics.length > 0 ? keyTopics.join(', ') : (learningSummary || ''));
    if (mainTopicForMapping.trim().length > 0) {
         console.log('[Action] Starting Concept Mapping based on:', mainTopicForMapping.substring(0, 100));
         const mapInput: MapConceptsInput = {
             mainTopic: mainTopicForMapping, 
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
         console.log('[Action] Skipping Concept Mapping due to missing topics/summary.');
         conceptsMap = null;
     }

    const finalError = processingError || null;

    const analysisResult: ProcessedConversationResult = {
      originalConversationText: conversationText,
      learningSummary: learningSummary,
      mainProblemOrTopicName: mainProblemOrTopicName,
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
                 learningSummary: null, mainProblemOrTopicName: null, keyTopics: null, category: null, conceptsMap: null,
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
            learningSummary: null, mainProblemOrTopicName: null, keyTopics: null, category: null, conceptsMap: null,
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

// --- Action for Saving a Single Learning Entry (containing all insights) ---

const saveEntryInputSchema = z.object({
  topicName: z.string().min(1, 'Topic name cannot be empty.'),
  learningSummary: z.string().optional().nullable(), 
  codeSnippetContent: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  studyNotesContent: z.string().optional().nullable(),
  category: z.string().nullable().optional(),
}).refine(
  (data) => !!data.learningSummary || !!data.codeSnippetContent || !!data.studyNotesContent,
  { message: "At least one piece of content (summary, code, or notes) must be provided to save." }
);


export type SaveEntryResult = {
  success: boolean;
  error?: string | null;
  info?: string | null; 
}

export async function saveEntryAction(
  prevState: SaveEntryResult | null,
  formData: FormData
): Promise<SaveEntryResult> {
    console.log('[Action] saveEntryAction started.');

    const validatedFields = saveEntryInputSchema.safeParse({
        topicName: formData.get('topicName'),
        learningSummary: formData.get('learningSummary'), 
        codeSnippetContent: formData.get('codeSnippetContent'),
        codeLanguage: formData.get('codeLanguage'),
        studyNotesContent: formData.get('studyNotesContent'),
        category: formData.get('category'),
    });

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.flatten().fieldErrors;
        const firstError = Object.values(errorMessages).flat()[0] || 'Invalid input for saving entry.';
        console.error('[Action] Save Entry Validation failed:', firstError, errorMessages);
        return { success: false, error: firstError };
    }

    const {
        topicName,
        learningSummary, 
        codeSnippetContent,
        codeLanguage,
        studyNotesContent,
        category
    } = validatedFields.data;

    console.log(`[Action] Attempting to save entry: Topic=${topicName.substring(0, 50)}, Category=${category ?? 'N/A'}...`);

    try {
        const entryToSave: Omit<LearningEntry, 'id' | 'createdAt' | 'createdAtISO'> = {
            topicName: topicName,
            category: category ?? null, // If category is empty string from form, store as null
        };
        if (learningSummary) entryToSave.learningSummary = learningSummary; 
        if (codeSnippetContent) entryToSave.codeSnippetContent = codeSnippetContent;
        if (codeLanguage && codeSnippetContent) entryToSave.codeLanguage = codeLanguage; 
        if (studyNotesContent) entryToSave.studyNotesContent = studyNotesContent;


        const docRef = await addDoc(collection(db, "learningEntries"), {
            ...entryToSave,
            createdAt: serverTimestamp()
        });
        console.log("[Action] Document written with ID: ", docRef.id);
        const successMsg = `Learning insights for '${topicName}' saved successfully!`;
        return { success: true, error: null, info: successMsg };
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while saving to Firestore.';
        console.error("[Action] Error saving document to Firestore:", errorMessage);
        if (error.stack) console.error(error.stack);
        return { success: false, error: `Failed to save entry: ${errorMessage}` };
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
            const createdAt = data.createdAt as Timestamp;
            entries.push({
                id: doc.id,
                topicName: data.topicName,
                learningSummary: data.learningSummary ?? null, 
                codeSnippetContent: data.codeSnippetContent ?? null,
                codeLanguage: data.codeLanguage ?? null,
                studyNotesContent: data.studyNotesContent ?? null,
                category: data.category ?? null,
                createdAt: createdAt, 
                createdAtISO: createdAt.toDate().toISOString(), 
            });
        });

        console.log(`[Action] Fetched ${entries.length} learning entries.`);
        return JSON.parse(JSON.stringify({ entries: entries, error: null }));

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while fetching learning entries.';
        console.error("[Action] Error fetching documents from Firestore:", errorMessage);
        if (error.stack) console.error(error.stack);
        return JSON.parse(JSON.stringify({ entries: null, error: `Failed to fetch learning entries: ${errorMessage}` }));
    }
}

// --- Action for Updating an Entry's Category ---
const updateEntryCategoryInputSchema = z.object({
  entryId: z.string().min(1, "Entry ID cannot be empty."),
  newCategory: z.string().optional().nullable(), // Allow empty string to be treated as 'Uncategorized' (null)
});

export type UpdateEntryCategoryResult = {
  success: boolean;
  error?: string | null;
  info?: string | null;
};

export async function updateEntryCategoryAction(
  prevState: UpdateEntryCategoryResult | null,
  formData: FormData
): Promise<UpdateEntryCategoryResult> {
  console.log('[Action] updateEntryCategoryAction started.');

  const validatedFields = updateEntryCategoryInputSchema.safeParse({
    entryId: formData.get('entryId'),
    newCategory: formData.get('newCategory'),
  });

  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages).flat()[0] || "Invalid input for updating category.";
    console.error('[Action] Update Category Validation failed:', firstError, errorMessages);
    return { success: false, error: firstError };
  }

  const { entryId, newCategory } = validatedFields.data;
  // Treat empty string as null for "Uncategorized"
  const categoryToSave = newCategory && newCategory.trim().length > 0 ? newCategory.trim() : null;


  console.log(`[Action] Attempting to update category for entry ID: ${entryId} to "${categoryToSave ?? 'Uncategorized'}"`);

  try {
    const entryRef = doc(db, "learningEntries", entryId);
    await updateDoc(entryRef, {
      category: categoryToSave,
    });

    const successMsg = `Category for entry updated successfully to "${categoryToSave ?? 'Uncategorized'}"!`;
    console.log(`[Action] ${successMsg}`);
    return { success: true, error: null, info: successMsg };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while updating category in Firestore.';
    console.error("[Action] Error updating category in Firestore:", errorMessage);
    if (error.stack) console.error(error.stack);
    return { success: false, error: `Failed to update category: ${errorMessage}` };
  }
}
