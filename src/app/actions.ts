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
        console.log(`[Action/DB] Attempting to save learning entry of type: ${entryData.type} for topic: ${entryData.topicName}`);
        // Basic validation before saving
        if (!entryData.topicName || typeof entryData.topicName !== 'string' || entryData.topicName.trim() === '') {
            throw new Error("Invalid topicName provided for saving.");
        }
         if (!entryData.type || typeof entryData.type !== 'string') {
            throw new Error("Invalid type provided for saving.");
        }
        if (entryData.content === undefined || entryData.content === null) {
             throw new Error("Invalid content provided for saving (null or undefined).");
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
// It no longer needs Firestore-specific fields like id/timestamp.
// The error field can now also indicate DB saving errors.
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
    topicsSummary: null, // Default to null on error
    keyTopics: null, // Default to null
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
      // Pass potentially empty string if validation failed early
      return defaultErrorState(errorMsg, conversationText);
    }

    // Reassign conversationText from validated data to be safe
    conversationText = validatedFields.data.conversationText;
    console.log('[Action] Validation successful. Conversation text length:', conversationText.length);

    let summaryData: SummarizeTopicsOutput | null = null;
    let codeAnalysisData: AnalyzeCodeOutput | null = null;
    let studyNotesData: GenerateStudyNotesOutput | null = null;
    let conceptsMap: MapConceptsOutput | null = null;
    let processingError: string | null = null; // Track AI/Processing errors
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
         const errorMsg = `Failed to initiate AI processing: ${aiError.message}`;
         console.error('[Action] Error during Promise.allSettled for AI flows:', aiError);
         console.error(aiError.stack);
         // Return default error state immediately if AI setup fails
         return defaultErrorState(errorMsg, conversationText);
    }

    console.log('[Action] AI flows results settled.');

     // --- Helper function to extract result or null, logging errors ---
    const getResultOrNull = <T>(settledResult: PromiseSettledResult<T | null>, flowName: string): T | null => {
        if (settledResult.status === 'fulfilled') {
            console.log(`[Action] ${flowName} flow fulfilled successfully.`);
            // Return the value, even if it's null (as intended by some flows)
            return settledResult.value;
        } else {
            // Log the reason for rejection and set processingError
            const reason = settledResult.reason instanceof Error ? settledResult.reason.message : String(settledResult.reason);
            console.error(`[Action] Error in ${flowName} flow:`, reason);
            if (settledResult.reason instanceof Error && settledResult.reason.stack) {
                console.error(settledResult.reason.stack);
            }
            // Set the first processing error encountered
            if (!processingError) {
                processingError = `Error during ${flowName}: ${reason}`;
            }
            return null; // Return null for this specific result
        }
    };

    // --- Process Results ---
    summaryData = getResultOrNull(settledResults[0], 'Summarize Topics');
    codeAnalysisData = getResultOrNull(settledResults[1], 'Analyze Code');
    studyNotesData = getResultOrNull(settledResults[2], 'Generate Study Notes');

    // --- Check if ANY critical AI flow failed ---
    if (processingError) {
        console.warn(`[Action] Proceeding with partial results due to AI error: ${processingError}`);
        // We will still try to map concepts and save what we have, but the error will be reported.
    }

    // Extract data even if null
    const topicsSummary = summaryData?.summary ?? null;
    const keyTopics = summaryData?.keyTopics ?? null;
    const category = summaryData?.category ?? null;
    const codeAnalysis = codeAnalysisData; // Keep as potentially null object
    const studyNotes = studyNotesData?.studyNotes ?? null; // Extract string or null

    console.log('[Action] AI results processed (some may be null due to errors).');
    console.log(`[Action] Summary: ${topicsSummary ? topicsSummary.substring(0, 50) + '...' : 'null'}`);
    console.log(`[Action] Key Topics: ${keyTopics ? keyTopics.join(', ') : 'null'}`);
    console.log(`[Action] Category: ${category}`);
    console.log(`[Action] Code Analysis Concept: ${codeAnalysis?.learnedConcept ?? 'null'}`);
    console.log(`[Action] Study Notes: ${studyNotes ? studyNotes.substring(0, 50) + '...' : 'null'}`);


    // --- Concept Mapping (Optional based on summary) ---
    if (topicsSummary && topicsSummary.trim().length > 0) {
         console.log('[Action] Starting Concept Mapping...');
         const mapInput: MapConceptsInput = {
             mainTopic: topicsSummary, // Use summary as main topic for mapping
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
             conceptsMap = null; // Set to null on error
             // Add this error to processing errors if none existed before
             if (!processingError) {
                processingError = `Error during Concept Mapping: ${reason}`;
             }
         }
     } else {
         console.log('[Action] Skipping Concept Mapping due to missing or empty summary.');
         conceptsMap = null;
     }

    // --- Save Results to Firestore ---
    // Determine topicName, ensure it's valid even if summary/category are null/empty
    const topicName = category || (topicsSummary && topicsSummary.trim().length > 0 ? topicsSummary.substring(0, 50) : null) || "Untitled Analysis";
    console.log(`[Action] Determined topic name for saving: ${topicName}`);

    const savePromises: Promise<string | null>[] = [];

    // Prepare data for saving summary - only if content exists
    const summaryEntryData: LearningEntryInput | null = (topicsSummary || (keyTopics && keyTopics.length > 0)) ? {
        topicName: topicName,
        type: "summary",
        // Ensure content matches schema, provide defaults if parts are null
        content: { summary: topicsSummary || "", keyTopics: keyTopics || [], category: category ?? null }
    } : null;

    // Prepare data for saving study notes - only if content exists
    const notesEntryData: LearningEntryInput | null = (studyNotes && studyNotes.trim().length > 0) ? {
        topicName: topicName,
        type: "study-notes",
        content: studyNotes // Store the notes string
    } : null;

     // Prepare data for saving code analysis - only if content exists
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
        console.log(`[Action] Attempting to save ${savePromises.length} entries to Firestore for topic "${topicName}"...`);
        try {
            const saveResults = await Promise.allSettled(savePromises);
            let failedSaves = 0;
            saveResults.forEach((result, index) => {
                 const entryType = [summaryEntryData?.type, notesEntryData?.type, codeEntryData?.type].filter(Boolean)[index] ?? 'unknown';
                 if (result.status === 'rejected') {
                     failedSaves++;
                     const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
                     console.error(`[Action/DB] Failed to save learning entry type '${entryType}'. Reason:`, reason);
                     if (result.reason instanceof Error && result.reason.stack) console.error(result.reason.stack);
                 } else if (result.status === 'fulfilled' && result.value === null) {
                     // Error logged within saveLearningEntry, count as failed
                     failedSaves++;
                     console.error(`[Action/DB] Firestore save failed internally for entry type '${entryType}'. Check previous logs.`);
                 } else if (result.status === 'fulfilled' && result.value !== null) {
                     console.log(`[Action/DB] Successfully saved learning entry type '${entryType}' (ID: ${result.value})`);
                 }
            });

            if (failedSaves > 0) {
                 saveError = `Failed to save ${failedSaves} learning entr${failedSaves > 1 ? 'ies' : 'y'} to the database. Check server logs for details. Firestore permissions or configuration might be incorrect.`;
                 console.error(`[Action/DB] ${saveError}`);
            } else {
                 console.log(`[Action/DB] All ${savePromises.length} entries saved successfully.`);
            }

        } catch (saveAllError: any) {
             const reason = saveAllError instanceof Error ? saveAllError.message : String(saveAllError);
             console.error('[Action/DB] Error during Promise.allSettled for saving entries:', reason);
             if (saveAllError instanceof Error && saveAllError.stack) console.error(saveAllError.stack);
             saveError = `Encountered an error while attempting to save entries: ${reason}`;
        }
    } else {
        console.log("[Action] No entries generated with content to save to Firestore.");
    }


    // --- Prepare final result for UI ---
    // Combine processing and save errors. Prioritize processing error if both exist.
    const finalError = processingError || saveError || null;

    const analysisResult: ProcessedConversationResult = {
      originalConversationText: conversationText,
      topicsSummary: topicsSummary,
      keyTopics: keyTopics,
      category: category,
      conceptsMap: conceptsMap,
      codeAnalysis: codeAnalysis,
      studyNotes: studyNotes,
      error: finalError, // Report combined error
    };

    console.log("[Action] ProcessConversation action complete. Returning results to UI.");
    if (finalError) {
        console.error(`[Action] Final error state being returned: ${finalError}`);
    }
    // Ensure the returned object structure is always consistent and serializable
    return JSON.parse(JSON.stringify(analysisResult)); // Basic serialization check

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

 // --- Action to Save Updated Study Notes ---
const saveNotesInputSchema = z.object({
    topicName: z.string().min(1, 'Topic name is required.'),
    studyNotes: z.string(), // Allow empty notes
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

    if (savedId) {
        console.log(`[Action/SaveNotes] Successfully saved updated notes for topic "${topicName}" (ID: ${savedId})`);
        return { success: true, error: null };
    } else {
        const errorMsg = `Failed to save updated notes for topic "${topicName}" to the database.`;
        console.error(`[Action/SaveNotes] ${errorMsg}`);
        return { success: false, error: errorMsg };
    }
}
