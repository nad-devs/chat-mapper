
'use server';
/**
 * @fileOverview Analyzes conversation text to identify and extract code examples.
 *
 * - analyzeCodeExamples - A function that analyzes the conversation for code snippets.
 * - AnalyzeCodeInput - The input type for the analyzeCodeExamples function.
 * - AnalyzeCodeOutput - The return type for the analyzeCodeExamples function.
 * - CodeExample - Represents a single identified code example.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for a single identified code example
const CodeExampleSchema = z.object({
  codeSnippet: z.string().describe('The extracted code snippet.'),
  language: z
    .string()
    .nullable()
    .describe('The detected programming language (e.g., "javascript", "python") or null if unsure.'),
  context: z
    .string()
    .nullable()
    .describe('A brief description of what the code does or the context in which it was discussed.')
});
export type CodeExample = z.infer<typeof CodeExampleSchema>;

// Input schema for the flow
const AnalyzeCodeInputSchema = z.object({
  conversationText: z.string().describe('The full text of the ChatGPT conversation.'),
});
export type AnalyzeCodeInput = z.infer<typeof AnalyzeCodeInputSchema>;

// Output schema for the flow
const AnalyzeCodeOutputSchema = z.object({
  codeExamples: z.array(CodeExampleSchema).describe('A list of identified code examples found in the conversation.'),
});
export type AnalyzeCodeOutput = z.infer<typeof AnalyzeCodeOutputSchema>;

// Exported function to be called from server actions
export async function analyzeCodeExamples(input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput> {
  return analyzeCodeFlow(input);
}

// Define the Genkit prompt
const analyzeCodePrompt = ai.definePrompt({
  name: 'analyzeCodePrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: AnalyzeCodeInputSchema},
  output: {schema: AnalyzeCodeOutputSchema},
  prompt: `You are an expert code analyst specializing in extracting code examples from text conversations.

  Analyze the following conversation text and identify all distinct code examples or snippets.

  Conversation:
  {{{conversationText}}}

  For each code example found:
  1. Extract the complete code snippet accurately. Preserve formatting (indentation, line breaks).
  2. Identify the programming language if possible (e.g., "javascript", "python", "html", "css", "java", "c++", "bash"). If unsure, set the language to null.
  3. Provide a brief (1-2 sentence) context or description of what the code appears to be doing or the topic it relates to within the conversation. If no clear context is available, set the context to null.

  Return the results as a JSON object containing a list named "codeExamples". Each item in the list should be an object with "codeSnippet", "language", and "context" fields as described above. If no code examples are found, return an empty list for "codeExamples".
`,
});

// Define the Genkit flow
const analyzeCodeFlow = ai.defineFlow(
  {
    name: 'analyzeCodeFlow',
    inputSchema: AnalyzeCodeInputSchema,
    outputSchema: AnalyzeCodeOutputSchema,
  },
  async input => {
    const {output} = await analyzeCodePrompt(input);
    // Ensure output is not null before returning
    if (!output) {
      throw new Error("AI failed to analyze code examples.");
    }
    // If output exists but codeExamples is missing (shouldn't happen with schema), provide default
    return output.codeExamples ? output : { codeExamples: [] };
  }
);
