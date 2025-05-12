
'use server';

import { z } from 'zod';
import { summarizeTopics, SummarizeTopicsOutput } from '@/ai/flows/summarize-topics';
import { mapConcepts, MapConceptsInput, MapConceptsOutput } from '@/ai/flows/map-concepts';
import { analyzeCodeConceptAndFinalExample, AnalyzeCodeOutput } from '@/ai/flows/analyze-code';
import { generateStudyNotes, GenerateStudyNotesOutput } from '@/ai/flows/generate-study-notes';
import { generateQuizTopics, GenerateQuizTopicsOutput, QuizTopic } from '@/ai/flows/generate-quiz-topics';
// Remove Firestore imports
// import { db } from '@/lib/firebase';
// import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

// --- Removed Firestore Data Structure ---
// type LearningEntryType = "study-notes";
// interface LearningEntryInput { ... }
// export interface LearningEntry extends LearningEntryInput { ... }

// --- Removed Server Action to Save Entry ---
// async function saveLearningEntry(...) { ... }

const processConversationInputSchema = z.object({
  conversationText: z.string().min(1, 'Conversation text cannot be empty.'),
});

// Updated result type without database ID
export type ProcessedConversationResult = {
  originalConversationText: string;
  topicsSummary: string | null;
  keyTopics: string[] | null;
  category: string | null;
  conceptsMap: MapConceptsOutput | null; // Ensure this is serializable
  codeAnalysis: AnalyzeCodeOutput | null; // Ensure this is serializable
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
      try {
        return JSON.parse(JSON.stringify(defaultErrorState(errorMsg, conversationText)));
      } catch (stringifyError) {
         console.error("[Action] Error stringifying default error state:", stringifyError);
         // Return a very basic, guaranteed serializable error state
         return {
             topicsSummary: null, keyTopics: null, category: null, conceptsMap: null,
             codeAnalysis: null, studyNotes: null, originalConversationText: conversationText,
             error: "Validation failed and error state could not be serialized."
         };
      }
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
        // Run all relevant AI flows concurrently
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
         try {
            return JSON.parse(JSON.stringify(defaultErrorState(errorMsg, conversationText)));
         } catch (stringifyError) {
             console.error("[Action] Error stringifying AI initiation error state:", stringifyError);
             return {
                 topicsSummary: null, keyTopics: null, category: null, conceptsMap: null,
                 codeAnalysis: null, studyNotes: null, originalConversationText: conversationText,
                 error: "AI processing failed and error state could not be serialized."
             };
         }
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
    // Database saving feature is removed.

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
        try {
            return JSON.parse(JSON.stringify(defaultErrorState(errorMsg, conversationText)));
        } catch (innerStringifyError) {
            console.error("[Action] Error stringifying the default error state after another stringify error:", innerStringifyError);
            // Return a very basic, guaranteed serializable error state
             return {
                 topicsSummary: null, keyTopics: null, category: null, conceptsMap: null,
                 codeAnalysis: null, studyNotes: null, originalConversationText: conversationText,
                 error: "Analysis failed and result could not be serialized."
             };
        }
    }


  } catch (error: any) {
    // Catch any unexpected errors during the entire process
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
    console.error('[Action] Unexpected top-level error in processConversation:', errorMessage);
    if (error.stack) {
        console.error(error.stack);
    }
    // Return a valid, serializable error state
    try {
      return JSON.parse(JSON.stringify(defaultErrorState(`Processing failed unexpectedly: ${errorMessage}`, conversationText)));
    } catch (stringifyError) {
        console.error("[Action] Error stringifying the top-level error state:", stringifyError);
        // Return a very basic, guaranteed serializable error state
        return {
            topicsSummary: null, keyTopics: null, category: null, conceptsMap: null,
            codeAnalysis: null, studyNotes: null, originalConversationText: conversationText,
            error: "Processing failed unexpectedly and error state could not be serialized."
        };
    }
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
            // Ensure serializable return
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
            // Ensure serializable return
            try {
               return JSON.parse(JSON.stringify({ quizTopics: null, error: "Could not generate specific quiz topics from this conversation." }));
            } catch (e) { return { quizTopics: null, error: "Could not generate specific quiz topics." }; }
        }

        console.log(`[Action] Generated ${result.quizTopics.length} quiz topics.`);
        // Ensure serializable return
        try {
            return JSON.parse(JSON.stringify({ quizTopics: result.quizTopics, error: null }));
        } catch (e) {
            console.error("[Action] Error stringifying successful quiz results:", e);
            return { quizTopics: null, error: "Failed to format quiz topics." };
        }

   } catch(error: any) {
     const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during quiz generation.';
     console.error('[Action] Unexpected error generating quiz topics:', errorMessage);
     if (error.stack) {
        console.error(error.stack);
     }
     // Ensure serializable return
     try {
        return JSON.parse(JSON.stringify(defaultQuizErrorState(`Quiz generation failed: ${errorMessage}`)));
     } catch (e) { return { quizTopics: null, error: "Quiz generation failed unexpectedly." }; }
   }
}

 // --- Removed Action to Save Study Notes ---
// const saveNotesInputSchema = z.object({ ... });
// export type SaveNotesResult = { ... }
// export async function saveUpdatedNotesAction(...) { ... }

