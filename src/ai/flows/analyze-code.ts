'use server';
/**
 * @fileOverview Analyzes conversation text to identify the main coding concept learned and the final code example.
 *
 * - analyzeCodeConceptAndFinalExample - A function that analyzes the conversation for the core coding concept and the final code snippet.
 * - AnalyzeCodeInput - The input type for the analyzeCodeConceptAndFinalExample function.
 * - AnalyzeCodeOutput - The return type for the analyzeCodeConceptAndFinalExample function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema for the flow (remains the same)
const AnalyzeCodeInputSchema = z.object({
  conversationText: z.string().describe('The full text of the ChatGPT conversation.'),
});
export type AnalyzeCodeInput = z.infer<typeof AnalyzeCodeInputSchema>;

// Updated Output schema for the flow
const AnalyzeCodeOutputSchema = z.object({
  learnedConcept: z
    .string()
    .describe('A summary of the main coding concept learned or problem solved in the conversation.'),
  finalCodeSnippet: z
    .string()
    .describe('The final or most complete code snippet provided in the conversation related to the learned concept.'),
   codeLanguage: z
    .string()
    .nullable()
    .describe('The detected programming language of the final code snippet (e.g., "javascript", "python") or null if unsure.'),
});
export type AnalyzeCodeOutput = z.infer<typeof AnalyzeCodeOutputSchema>;

// Exported function to be called from server actions (renamed for clarity)
export async function analyzeCodeConceptAndFinalExample(input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput | null> {
  // Return null if the flow fails or returns no meaningful output
  try {
      const result = await analyzeCodeFlow(input);
      // Basic check if the result seems valid
      if (result?.learnedConcept && result?.finalCodeSnippet) {
          return result;
      }
      return null;
  } catch (error) {
      console.error("Error in analyzeCodeFlow:", error);
      return null;
  }
}

// Define the updated Genkit prompt
const analyzeCodePrompt = ai.definePrompt({
  name: 'analyzeCodeConceptAndFinalExamplePrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: AnalyzeCodeInputSchema},
  output: {schema: AnalyzeCodeOutputSchema},
  prompt: `You are an expert code analyst specializing in understanding the core concepts discussed in coding conversations.

  Analyze the following conversation text:
  {{{conversationText}}}

  Your task is to:
  1. Identify the main coding problem being solved or the primary programming concept being learned or explained. Summarize this in the "learnedConcept" field.
  2. Find and extract the *final* and most complete code snippet provided in the conversation that represents the solution or the culmination of the discussion about that concept/problem. Put this code in the "finalCodeSnippet" field. Preserve formatting (indentation, line breaks).
  3. Determine the programming language of the final code snippet (e.g., "javascript", "python", "html"). If the language is unclear or it's not code, set "codeLanguage" to null.

  Return the results as a single JSON object matching the specified output schema. If no specific coding concept or final code snippet can be clearly identified, return an object with empty strings for "learnedConcept" and "finalCodeSnippet", and null for "codeLanguage".
`,
});

// Define the Genkit flow
const analyzeCodeFlow = ai.defineFlow(
  {
    name: 'analyzeCodeConceptAndFinalExampleFlow', // Renamed flow
    inputSchema: AnalyzeCodeInputSchema,
    outputSchema: AnalyzeCodeOutputSchema,
  },
  async input => {
    const {output} = await analyzeCodePrompt(input);
    // Ensure output is not null before returning, otherwise return a default structure
    if (!output) {
      // Return a structure indicating nothing significant was found, matching the schema
      return { learnedConcept: "", finalCodeSnippet: "", codeLanguage: null };
    }
     // If AI returns empty strings, pass them through. Add default null for language if missing.
    return {
        learnedConcept: output.learnedConcept || "",
        finalCodeSnippet: output.finalCodeSnippet || "",
        codeLanguage: output.codeLanguage !== undefined ? output.codeLanguage : null,
    };
  }
);

// Remove the old CodeExample schema and type as they are no longer used
// const CodeExampleSchema = z.object({...});
// export type CodeExample = z.infer<typeof CodeExampleSchema>;
// Remove old analyzeCodeExamples function if it existed and rename the main exported function.
