'use server';
/**
 * @fileOverview Generates study notes by identifying areas of struggle or clarification requests in a conversation.
 *
 * - generateStruggleNotes - A function that analyzes the conversation and generates notes on difficult concepts.
 * - GenerateStruggleNotesInput - The input type for the generateStruggleNotes function.
 * - GenerateStruggleNotesOutput - The return type for the generateStruggleNotes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStruggleNotesInputSchema = z.object({
  conversationText: z
    .string()
    .describe('The full text of the ChatGPT conversation.'),
});
export type GenerateStruggleNotesInput = z.infer<
  typeof GenerateStruggleNotesInputSchema
>;

const GenerateStruggleNotesOutputSchema = z.object({
  notes: z
    .string()
    .describe(
      'Concise study notes summarizing concepts the user struggled with or asked for clarification on, formatted potentially using Markdown for readability. If no struggles are identified, this should be an empty string or a brief message indicating such.'
    ),
});
export type GenerateStruggleNotesOutput = z.infer<
  typeof GenerateStruggleNotesOutputSchema
>;

export async function generateStruggleNotes(
  input: GenerateStruggleNotesInput
): Promise<GenerateStruggleNotesOutput | null> {
   try {
        const result = await generateStruggleNotesFlow(input);
        // Return result even if notes are empty, action handler will check content
        return result;
    } catch (error) {
        console.error("Error in generateStruggleNotesFlow:", error);
        return null; // Indicate failure
    }
}

const prompt = ai.definePrompt({
  name: 'generateStruggleNotesPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: GenerateStruggleNotesInputSchema},
  output: {schema: GenerateStruggleNotesOutputSchema},
  prompt: `You are an expert study assistant skilled at analyzing conversations to identify learning difficulties.

  Analyze the following conversation text:
  {{{conversationText}}}

  Your task is to:
  1. Identify specific points, concepts, or code sections where the user expressed confusion, asked for clarification multiple times, seemed to misunderstand, or explicitly stated they were struggling.
  2. For each identified area of struggle, generate a concise study note. This note should briefly explain the core idea the user was struggling with, tailored to address the likely source of their confusion based on the conversation.
  3. Combine these notes into a single string in the "notes" field. Use simple Markdown for formatting (like bullet points or bold text) if it enhances clarity.
  4. **If you cannot identify any clear areas where the user struggled or needed significant clarification, return an empty string ("") for the "notes" field.** Do not invent struggles.

  Focus on providing helpful reminders or clarifications for the user to review later.
`,
  // Optional: Configure safety settings if needed, although likely not required for this task
  // config: {
  //   safetySettings: [
  //     { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  //     // ... other settings
  //   ],
  // },
});

const generateStruggleNotesFlow = ai.defineFlow(
  {
    name: 'generateStruggleNotesFlow',
    inputSchema: GenerateStruggleNotesInputSchema,
    outputSchema: GenerateStruggleNotesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure output is not null before returning, otherwise return a default structure
    if (!output) {
       return { notes: "" }; // Return empty notes if AI fails to produce output
    }
    // Pass through the AI's response, even if notes are empty
    return { notes: output.notes || "" };
  }
);
