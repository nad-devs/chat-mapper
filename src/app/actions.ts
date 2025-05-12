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
// Simplifying the types slightly, as we primarily save notes now.
// The content type can still be flexible if needed later.
type LearningEntryType = "study-notes" | "summary" | "code-analysis"; // Retain types, but only use 'study-notes' initially

// Input type for saving (timestamp is added by Firestore)
interface LearningEntryInput {
  topicName: string; // Derived from category or summary or a default
  type: LearningEntryType;
  content: string | AnalyzeCodeOutput | SummarizeTopicsOutput; // Flexible content based on type
}

// Type representing a saved document in Firestore (includes ID and Timestamp)
export interface LearningEntry extends LearningEntryInput {
    id: string;
    timestamp: Timestamp;
}

// --- Server Action to Save Entry (remains the same, used by initial save and update) ---
// This is the core function to write to Firestore. It is called by other actions.
async function saveLearningEntry(entryData: LearningEntryInput): Promise<string | null | "skipped_empty"> {
    try {
        console.log(`[Action/DB] Attempting to save learning entry of type: ${entryData.type} for topic: ${entryData.topicName}`);
        // Basic validation before saving
        if (!entryData.topicName || typeof entryData.topicName !== 'string' || entryData.topicName.trim() === '') {
            // Assign a default topic name if it's invalid/missing
            console.warn("[Action/DB] Invalid or missing topicName provided for saving. Using 'Untitled Analysis'.");
            entryData.topicName = 'Untitled Analysis';
        }
         if (!entryData.type || typeof entryData.type !== 'string') {
            throw new Error("Invalid type provided for saving.");
        }
        if (entryData.content === undefined || entryData.content === null) {
             throw new Error("Invalid content provided for saving (null or undefined).");
        }
         // Additional check for empty string content (specifically for notes)
         if (entryData.type === "study-notes" && typeof entryData.content === 'string' && entryData.content.trim() === '') {
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
// It includes all generated data, regardless of whether it was saved.
export type ProcessedConversationResult = {
  originalConversationText?: string;
  topicsSummary: string | null; // Allow null if summarization fails
  keyTopics: string[] | null; // Allow null
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

   // Define a default error state structure more defensively
  const defaultErrorState = (message: string, conversationText: string | undefined): ProcessedConversationResult => ({
    topicsSummary: null,
    keyTopics: null,
    category: null,
    conceptsMap: null,
    codeAnalysis: null,
    studyNotes: null,
    originalConversationText: conversationText ?? '', // Ensure it's a string
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
      return defaultErrorState(errorMsg, conversationText);
    }

    conversationText = validatedFields.data.conversationText;
    console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

    let summaryData: SummarizeTopicsOutput | null = null;
    let codeAnalysisData: AnalyzeCodeOutput | null = null;
    let studyNotesData: GenerateStudyNotesOutput | null = null;
    let conceptsMap: MapConceptsOutput | null = null;
    let processingError: string | null = null; // Track AI/Processing errors
    // Removed saveError as saving is now handled separately

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
         console.error(aiError.stack);
         return defaultErrorState(errorMsg, conversationText);
    }

    console.log('[Action] AI flows results settled.');

    const getResultOrNull = <T>(settledResult: PromiseSettledResult<T | null>, flowName: string): T | null => {
        if (settledResult.status === 'fulfilled') {
            console.log(`[Action] ${flowName} flow fulfilled successfully.`);
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

    // --- REMOVED: Automatic saving of study notes ---
    // Saving is now handled by `saveUpdatedNotesAction` triggered by the user.
    // console.log("[Action] Skipping automatic saving of study notes.");


    // --- Prepare final result for UI ---
    // The final error only includes processing errors now.
    const finalError = processingError || null;

    const analysisResult: ProcessedConversationResult = {
      originalConversationText: conversationText,
      topicsSummary: topicsSummary,
      keyTopics: keyTopics,
      category: category,
      conceptsMap: conceptsMap,
      codeAnalysis: codeAnalysis,
      studyNotes: studyNotes,
      error: finalError, // Report processing error only
    };

    console.log("[Action] ProcessConversation action complete. Returning results to UI.");
    if (finalError) {
        console.error(`[Action] Final error state being returned: ${finalError}`);
    }
    // Ensure the returned object structure is always consistent and serializable
    // Using JSON parse/stringify is a simple way to handle potential non-serializable values (like Timestamps if they were included)
    try {
        return JSON.parse(JSON.stringify(analysisResult));
    } catch (stringifyError) {
        console.error("[Action] Error stringifying analysis result:", stringifyError);
        return defaultErrorState("Failed to serialize analysis results.", conversationText);
    }


  } catch (error: any) {
    // Catch any unexpected errors during the entire process
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
    console.error('[Action] Unexpected top-level error in processConversation:', errorMessage);
    if (error.stack) {
        console.error(error.stack);
    }
    // Return a valid error state
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
   let conversationText: string | undefined; // Define here for broader scope

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
            return { quizTopics: null, error: errorMsg };
        }

        const { conversationText: validText, count: validCount } = validatedFields.data;

        console.log('[Action] Calling generateQuizTopics flow...');
        const result = await generateQuizTopics({ conversationText: validText, count: validCount });
        console.log('[Action] generateQuizTopics flow completed.');

        if (!result || !result.quizTopics) {
            const errorMsg = !result ? "Failed to generate quiz topics from AI (null result)." : "AI returned no quiz topics or invalid structure.";
            console.warn(`[Action] ${errorMsg}`);
            // Return null for topics but provide an informative message (not necessarily an error)
            return { quizTopics: null, error: "Could not generate specific quiz topics from this conversation." };
        }

        console.log(`[Action] Generated ${result.quizTopics.length} quiz topics.`);
        // Return the topics (even if empty array) and no error
        return { quizTopics: result.quizTopics, error: null };

   } catch(error: any) {
     const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during quiz generation.';
     console.error('[Action] Unexpected error generating quiz topics:', errorMessage);
     if (error.stack) {
        console.error(error.stack);
     }
     return { quizTopics: null, error: `Quiz generation failed: ${errorMessage}` };
   }
}

 // --- Action to Save Updated Study Notes (Called by user clicking Save in UI) ---
const saveNotesInputSchema = z.object({
    topicName: z.string().min(1, 'Topic name is required.'),
    studyNotes: z.string(), // Allow empty notes (though saveLearningEntry might skip)
});

export async function saveUpdatedNotesAction(
    prevState: { success: boolean, error?: string | null } | null,
    formData: FormData
): Promise<{ success: boolean, error?: string | null }> {
    console.log('[Action] saveUpdatedNotesAction started.');

    const validatedFields = saveNotesInputSchema.safeParse({
        topicName: formData.get('topicName'),
        studyNotes: formData.get('studyNotes'),
    });

    if (!validatedFields.success) {
        const errorMsg = validatedFields.error.flatten().fieldErrors.topicName?.[0]
                      || validatedFields.error.flatten().fieldErrors.studyNotes?.[0]
                      || 'Invalid input for saving notes.';
        console.error('[Action/SaveNotes] Validation failed:', errorMsg);
        return { success: false, error: errorMsg };
    }

    const { topicName, studyNotes } = validatedFields.data;

    const notesEntryData: LearningEntryInput = {
        topicName: topicName,
        type: "study-notes",
        content: studyNotes
    };

    const savedId = await saveLearningEntry(notesEntryData);

    if (savedId === null) {
        // Error occurred during save
        const errorMsg = `Failed to save updated notes for topic "${topicName}" to the database. Check server logs for Firestore permissions or configuration issues.`;
        console.error(`[Action/SaveNotes] ${errorMsg}`);
        return { success: false, error: errorMsg };
    } else if (savedId === "skipped_empty") {
         // Saved skipped because notes were empty
         console.log(`[Action/SaveNotes] Skipped saving empty notes for topic "${topicName}".`);
         // Return success, maybe with an info message if desired?
         // For now, just return success as no *error* occurred.
         return { success: true, error: null }; // Or add an info field: { success: true, info: "Notes were empty, nothing saved."}
    } else {
        // Save successful
        console.log(`[Action/SaveNotes] Successfully saved updated notes for topic "${topicName}" (ID: ${savedId})`);
        return { success: true, error: null };
    }
}

    