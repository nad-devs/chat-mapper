'use server';
/**
 * @fileOverview Generates key topics from a conversation suitable for a recall quiz.
 *
 * - generateQuizTopics - A function that analyzes the conversation and extracts quiz topics.
 * - GenerateQuizTopicsInput - The input type for the generateQuizTopics function.
 * - GenerateQuizTopicsOutput - The return type for the generateQuizTopics function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateQuizTopicsInputSchema = z.object({
  conversationText: z.string().describe('The full text of the ChatGPT conversation.'),
  count: z.number().optional().default(5).describe('The approximate number of quiz topics to generate.'),
});
export type GenerateQuizTopicsInput = z.infer<typeof GenerateQuizTopicsInputSchema>;

const QuizTopicSchema = z.object({
  topic: z.string().describe('A concise key topic, concept, term, or specific problem discussed in the conversation.'),
  context: z.string().describe('A brief snippet or explanation from the conversation providing context for the topic.'),
});
export type QuizTopic = z.infer<typeof QuizTopicSchema>;


const GenerateQuizTopicsOutputSchema = z.object({
  quizTopics: z
    .array(QuizTopicSchema)
    .describe('An array of key topics suitable for a recall quiz, each with brief context.'),
});
export type GenerateQuizTopicsOutput = z.infer<typeof GenerateQuizTopicsOutputSchema>;


export async function generateQuizTopics(
  input: GenerateQuizTopicsInput
): Promise<GenerateQuizTopicsOutput | null> {
   try {
        const result = await generateQuizTopicsFlow(input);
        // Return result even if topics array is empty
        return result;
    } catch (error) {
        console.error("Error in generateQuizTopicsFlow:", error);
        return null; // Indicate failure
    }
}

const prompt = ai.definePrompt({
  name: 'generateQuizTopicsPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: GenerateQuizTopicsInputSchema},
  output: {schema: GenerateQuizTopicsOutputSchema},
  prompt: `You are an expert learning assistant analyzing conversations to create recall quizzes.

  Analyze the following conversation text:
  {{{conversationText}}}

  Your task is to:
  1. Identify approximately {{{count}}} distinct and important key topics, concepts, technical terms, or specific problems discussed or solved in the conversation. These should be suitable for testing recall.
  2. For each identified topic, provide a concise label in the "topic" field (e.g., "Frequency Count Algorithm", "Valid Anagram Problem", "React useEffect Hook").
  3. For each topic, extract or generate a brief (1-2 sentences) "context" from the conversation that explains what the topic refers to or how it was discussed. This context should help the user remember what the topic is about without giving away the full details.
  4. Ensure the output is an array of objects, each containing a "topic" and its corresponding "context".
  5. **If the conversation is too short or lacks distinct concepts, return an empty array for "quizTopics".**

  Focus on extracting core elements that represent significant learning points or discussion items.
`,
  config: {
    // Adjust temperature for more focused or creative topic selection if needed
    // temperature: 0.6,
  }
});

const generateQuizTopicsFlow = ai.defineFlow(
  {
    name: 'generateQuizTopicsFlow',
    inputSchema: GenerateQuizTopicsInputSchema,
    outputSchema: GenerateQuizTopicsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    // Ensure output is not null before returning, otherwise return a default structure
    if (!output) {
       return { quizTopics: [] }; // Return empty array if AI fails
    }
    // Pass through the AI's response
    return { quizTopics: output.quizTopics || [] };
  }
);