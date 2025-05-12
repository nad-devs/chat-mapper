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
// Only saving study notes for now.
type LearningEntryType = "study-notes"; // Simplified

// Input type for saving (timestamp is added by Firestore)
interface LearningEntryInput {
  topicName: string; // Derived from category or summary or a default
  type: LearningEntryType;
  content: string; // Content is always string for study notes
}

// Type representing a saved document in Firestore (includes ID and Timestamp)
export interface LearningEntry extends LearningEntryInput {
    id: string;
    timestamp: Timestamp; // Note: Timestamp object is not serializable for client components directly
}

// --- Server Action to Save Entry (only for study notes now) ---
// This is the core function to write study notes to Firestore.
async function saveLearningEntry(entryData: LearningEntryInput): Promise<string | null | "skipped_empty"> {
    // Validate input specific to study notes
    if (entryData.type !== "study-notes") {
        console.error("[Action/DB] Invalid type provided for saving. Only 'study-notes' is supported currently.");
        return null;
    }
     if (typeof entryData.content !== 'string') {
        console.error("[Action/DB] Invalid content provided for saving study notes (must be a string).");
        return null;
    }

    try {
        console.log(`[Action/DB] Attempting to save learning entry of type: ${entryData.type} for topic: ${entryData.topicName}`);
        // Basic validation for topic name
        if (!entryData.topicName || typeof entryData.topicName !== 'string' || entryData.topicName.trim() === '') {
            console.warn("[Action/DB] Invalid or missing topicName provided for saving. Using 'Untitled Analysis'.");
            entryData.topicName = 'Untitled Analysis';
        }

         // Check for empty string content before saving
         if (entryData.content.trim() === '') {
            console.log(`[Action/DB] Skipping save for empty study notes for topic: ${entryData.topicName}`);
            return "skipped_empty"; // Indicate skipped save due to empty content
         }

        const docRef = await addDoc(collection(db, "learningEntries"), {
            ...entryData,
            timestamp: serverTimestamp() // Add server-side timestamp
        });
        console.log(`[Action/DB] Learning entry type '${entryData.type}' saved successfully with ID:`, docRef.id);
        return docRef.id; // Return the new document ID
    } catch (error: any) {
        // Log the specific error from Firestore
        console.error(`[Action/DB] Firestore error saving learning entry type '${entryData.type}':`, error);
        console.error(`[Action/DB] Firestore error code: ${error.code}, message: ${error.message}`);
        console.error("[Action/DB] Data that failed to save:", JSON.stringify(entryData)); // Log stringified data
        console.error(error.stack); // Log stack trace
        return null; // Indicate failure
    }
}


const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// This result type is what the *action* returns to the *UI*.
// It includes all generated data. Ensure all fields are serializable.
export type ProcessedConversationResult = {
  originalConversationText: string; // Changed from optional
  topicsSummary: string | null;
  keyTopics: string[] | null;
  category: string | null;
  // Ensure MapConceptsOutput and AnalyzeCodeOutput only contain serializable data
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

   // Define a default error state structure more defensively and ensure it's serializable
  const defaultErrorState = (message: string, conversationText: string = ''): ProcessedConversationResult => ({
    topicsSummary: null,
    keyTopics: null,
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
    originalConversationText: conversationText, // Ensure it's always a string
    error: message || 'An unknown error occurred.', // Ensure message is a string
  });

  let conversationText = formData.get('conversationText') as string ?? prevState?.originalConversationText ?? '';

  try {
    const validatedFields = processConversationInputSchema.safeParse({
      conversationText: conversationText,
    });

    if (!validatedFields.success) {
      const errorMsg = validatedFields.error.flatten().fieldErrors.conversationText?.[0] || 'Invalid input.';
      console.error('[Action] Validation failed:', errorMsg);
      // Ensure the returned state is serializable
      return JSON.parse(JSON.stringify(defaultErrorState(errorMsg, conversationText)));
    }

    conversationText = validatedFields.data.conversationText;
    console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

    let summaryData: SummarizeTopicsOutput | null = null;
    let codeAnalysisData: AnalyzeCodeOutput | null = null;
    let studyNotesData: GenerateStudyNotesOutput | null = null;
    let conceptsMap: MapConceptsOutput | null = null;
    let processingError: string | null = null; // Track AI/Processing errors

    console.log('[Action] Starting AI flows...');
    let settledResults: PromiseSettledResult<any>[] = [];
    try {
        // Only run flows needed for display and potential saving (notes)
        settledResults = await Promise.allSettled([
            summarizeTopics({ conversation: conversationText }),
            analyzeCodeConceptAndFinalExample({ conversationText: conversationText }),
            generateStudyNotes({ conversationText: conversationText })
        ]);
    } catch (aiError: any) {
         const errorMsg = `Failed to initiate AI processing: ${aiError.message}`;
         console.error('[Action] Error during Promise.allSettled for AI flows:', aiError);
         console.error(aiError.stack);
         // Ensure the returned state is serializable
         return JSON.parse(JSON.stringify(defaultErrorState(errorMsg, conversationText)));
    }

    console.log('[Action] AI flows results settled.');

    const getResultOrNull = <T>(settledResult: PromiseSettledResult<T | null>, flowName: string): T | null => {
        if (settledResult.status === 'fulfilled') {
            console.log(`[Action] ${flowName} flow fulfilled successfully.`);
            // Additional check for null/undefined return values from the flow itself
             if (settledResult.value === null || settledResult.value === undefined) {
                console.warn(`[Action] ${flowName} flow fulfilled but returned null/undefined.`);
                return null;
            }
            return settledResult.value;
        } else {
            const reason = settledResult.reason instanceof Error ? settledResult.reason.message : String(settledResult.reason);
            console.error(`[Action] Error in ${flowName} flow:`, reason);
            if (settledResult.reason instanceof Error && settledResult.reason.stack) {
                console.error(settledResult.reason.stack);
            }
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

    console.log('[Action] AI results processed (some may be null due to errors).');
    console.log(`[Action] Summary: ${topicsSummary ? topicsSummary.substring(0, 50) + '...' : 'null'}`);
    console.log(`[Action] Key Topics: ${keyTopics ? keyTopics.join(', ') : 'null'}`);
    console.log(`[Action] Category: ${category}`);
    console.log(`[Action] Code Analysis Concept: ${codeAnalysis?.learnedConcept ?? 'null'}`);
    console.log(`[Action] Study Notes: ${studyNotes ? studyNotes.substring(0, 50) + '...' : 'null'}`);

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
             if (mapError instanceof Error && mapError.stack) {
                 console.error(mapError.stack);
             }
             conceptsMap = null;
             if (!processingError) {
                processingError = `Error during Concept Mapping: ${reason}`;
             }
         }
     } else {
         console.log('[Action] Skipping Concept Mapping due to missing or empty summary.');
         conceptsMap = null;
     }

    // --- NO Automatic Saving Here ---
    // Saving is handled by `saveUpdatedNotesAction` triggered by the user.

    // --- Prepare final result for UI ---
    const finalError = processingError || null;

    const analysisResult: ProcessedConversationResult = {
      originalConversationText: conversationText,
      topicsSummary: topicsSummary,
      keyTopics: keyTopics,
      category: category,
      conceptsMap: conceptsMap, // Ensure this is serializable
      codeAnalysis: codeAnalysis, // Ensure this is serializable
      studyNotes: studyNotes,
      error: finalError,
    };

    console.log("[Action] ProcessConversation action complete. Returning results to UI.");
    if (finalError) {
        console.error(`[Action] Final error state being returned: ${finalError}`);
    }

    // Force serialization before returning to catch potential issues
    try {
        // Stringify and parse to ensure only serializable data is returned
        const serializableResult = JSON.parse(JSON.stringify(analysisResult));
        console.log("[Action] Returning serializable analysis result.");
        return serializableResult;
    } catch (stringifyError: any) {
        console.error("[Action] Error stringifying analysis result:", stringifyError);
        const errorMsg = `Failed to serialize analysis results: ${stringifyError.message}`;
        // Return a valid error state, ensuring it's also serializable
        return JSON.parse(JSON.stringify(defaultErrorState(errorMsg, conversationText)));
    }


  } catch (error: any) {
    // Catch any unexpected errors during the entire process
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
    console.error('[Action] Unexpected top-level error in processConversation:', errorMessage);
    if (error.stack) {
        console.error(error.stack);
    }
    // Return a valid, serializable error state
    return JSON.parse(JSON.stringify(defaultErrorState(`Processing failed unexpectedly: ${errorMessage}`, conversationText)));
  }
}


// --- Action for Generating Quiz Topics (No DB interaction) ---

const generateQuizInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
  count: z.number().optional(),
});

// Ensure GenerateQuizResult is serializable
export type GenerateQuizResult = {
  quizTopics: QuizTopic[] | null; // QuizTopic should be serializable
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
            return JSON.parse(JSON.stringify(defaultQuizErrorState(errorMsg)));
        }

        const { conversationText: validText, count: validCount } = validatedFields.data;

        console.log('[Action] Calling generateQuizTopics flow...');
        const result = await generateQuizTopics({ conversationText: validText, count: validCount });
        console.log('[Action] generateQuizTopics flow completed.');

        if (!result || !result.quizTopics) {
            const errorMsg = !result ? "Failed to generate quiz topics from AI (null result)." : "AI returned no quiz topics or invalid structure.";
            console.warn(`[Action] ${errorMsg}`);
            // Return serializable state
            return JSON.parse(JSON.stringify({ quizTopics: null, error: "Could not generate specific quiz topics from this conversation." }));
        }

        console.log(`[Action] Generated ${result.quizTopics.length} quiz topics.`);
        // Return serializable topics (even if empty array) and no error
        return JSON.parse(JSON.stringify({ quizTopics: result.quizTopics, error: null }));

   } catch(error: any) {
     const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during quiz generation.';
     console.error('[Action] Unexpected error generating quiz topics:', errorMessage);
     if (error.stack) {
        console.error(error.stack);
     }
     // Return serializable error state
     return JSON.parse(JSON.stringify(defaultQuizErrorState(`Quiz generation failed: ${errorMessage}`)));
   }
}

 // --- Action to Save Study Notes (Called by user clicking Save in UI) ---
const saveNotesInputSchema = z.object({
    topicName: z.string().min(1, 'Topic name is required.'),
    studyNotes: z.string(), // Allow empty notes (saveLearningEntry will skip)
});

// Ensure return type is serializable
export type SaveNotesResult = {
    success: boolean;
    error?: string | null;
    info?: string | null; // Optional info message (e.g., for skipped save)
}

export async function saveUpdatedNotesAction(
    prevState: SaveNotesResult | null,
    formData: FormData
): Promise<SaveNotesResult> {
    console.log('[Action] saveUpdatedNotesAction started.');

    const defaultSaveErrorState = (message: string): SaveNotesResult => ({
        success: false,
        error: message || 'An unknown error occurred while saving notes.',
    });

    try {
        const validatedFields = saveNotesInputSchema.safeParse({
            topicName: formData.get('topicName'),
            studyNotes: formData.get('studyNotes'),
        });

        if (!validatedFields.success) {
            const errorMsg = validatedFields.error.flatten().fieldErrors.topicName?.[0]
                          || validatedFields.error.flatten().fieldErrors.studyNotes?.[0]
                          || 'Invalid input for saving notes.';
            console.error('[Action/SaveNotes] Validation failed:', errorMsg);
            return JSON.parse(JSON.stringify(defaultSaveErrorState(errorMsg)));
        }

        const { topicName, studyNotes } = validatedFields.data;

        const notesEntryData: LearningEntryInput = {
            topicName: topicName,
            type: "study-notes",
            content: studyNotes
        };

        const savedId = await saveLearningEntry(notesEntryData);

        let result: SaveNotesResult;

        if (savedId === null) {
            // Error occurred during save
            const errorMsg = `Failed to save notes for topic "${topicName}" to the database. Check server logs.`;
            console.error(`[Action/SaveNotes] ${errorMsg}`);
            result = defaultSaveErrorState(errorMsg);
        } else if (savedId === "skipped_empty") {
             // Saved skipped because notes were empty
             console.log(`[Action/SaveNotes] Skipped saving empty notes for topic "${topicName}".`);
             result = { success: true, error: null, info: "Notes were empty, nothing saved." };
        } else {
            // Save successful
            console.log(`[Action/SaveNotes] Successfully saved notes for topic "${topicName}" (ID: ${savedId})`);
            result = { success: true, error: null };
        }
        // Force serialization before returning
        return JSON.parse(JSON.stringify(result));

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during note saving.';
        console.error('[Action/SaveNotes] Unexpected top-level error:', errorMessage);
        if (error.stack) {
            console.error(error.stack);
        }
        // Force serialization before returning
        return JSON.parse(JSON.stringify(defaultSaveErrorState(`Note saving failed unexpectedly: ${errorMessage}`)));
    }
}
