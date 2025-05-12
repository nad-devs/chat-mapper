'use server';
/**
 * @fileOverview Generates concise study notes summarizing the key concepts and takeaways from a conversation.
 *
 * - generateStudyNotes - A function that analyzes the conversation and generates study notes.
 * - GenerateStudyNotesInput - The input type for the generateStudyNotes function.
 * - GenerateStudyNotesOutput - The return type for the generateStudyNotes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStudyNotesInputSchema = z.object({
  conversationText: z
    .string()
    .describe('The full text of the ChatGPT conversation.'),
});
export type GenerateStudyNotesInput = z.infer<
  typeof GenerateStudyNotesInputSchema
>;

const GenerateStudyNotesOutputSchema = z.object({
  studyNotes: z
    .string()
    .describe(
      'Concise study notes summarizing the main concepts, key points, and important takeaways learned or discussed in the conversation. Formatted potentially using Markdown for readability (e.g., bullet points, bold text). If the conversation is too brief or lacks substantial content, this should be an empty string or a brief message indicating such.'
    ),
});
export type GenerateStudyNotesOutput = z.infer<
  typeof GenerateStudyNotesOutputSchema
>;

export async function generateStudyNotes(
  input: GenerateStudyNotesInput
): Promise<GenerateStudyNotesOutput | null> {
   try {
        const result = await generateStudyNotesFlow(input);
        // Return result even if notes are empty, action handler will check content
        return result;
    } catch (error) {
        console.error("Error in generateStudyNotesFlow:", error);
        return null; // Indicate failure
    }
}

const prompt = ai.definePrompt({
  name: 'generateStudyNotesPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: GenerateStudyNotesInputSchema},
  output: {schema: GenerateStudyNotesOutputSchema},
  prompt: `You are an expert study assistant skilled at synthesizing information from conversations.

  Analyze the following conversation text:
  {{{conversationText}}}

  Your task is to:
  1. Identify the main concepts, key programming techniques, important definitions, problem-solving steps, or significant takeaways discussed in the conversation.
  2. Generate concise study notes summarizing these points. Focus on capturing the essence of what was learned or explained.
  3. Combine these notes into a single string in the "studyNotes" field. Use simple Markdown for formatting (like bullet points '*' or '-' and bold text '**') if it enhances clarity and organization. Structure the notes logically.
  4. **If the conversation is very short, lacks specific technical/conceptual content, or is purely conversational, return an empty string ("") for the "studyNotes" field.** Do not invent content.

  Aim for notes that would be helpful for someone reviewing the key information from the conversation later. Avoid conversational filler or commentary about user understanding unless it's directly relevant to a key point.
`,
  // Optional: Configure safety settings if needed
  // config: {
  //   safetySettings: [
  //     // ... settings
  //   ],
  // },
});

const generateStudyNotesFlow = ai.defineFlow(
  {
    name: 'generateStudyNotesFlow',
    inputSchema: GenerateStudyNotesInputSchema,
    outputSchema: GenerateStudyNotesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure output is not null before returning, otherwise return a default structure
    if (!output) {
       return { studyNotes: "" }; // Return empty notes if AI fails to produce output
    }
    // Pass through the AI's response, even if notes are empty
    return { studyNotes: output.studyNotes || "" };
  }
);
