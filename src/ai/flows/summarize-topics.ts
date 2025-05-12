'use server';
/**
 * @fileOverview Summarizes the main topics discussed in a conversation and assigns a category.
 *
 * - summarizeTopics - A function that summarizes the topics and categorizes a conversation.
 * - SummarizeTopicsInput - The input type for the summarizeTopics function.
 * - SummarizeTopicsOutput - The return type for the summarizeTopics function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeTopicsInputSchema = z.object({
  conversation: z
    .string()
    .describe('The ChatGPT conversation to summarize.'),
});
export type SummarizeTopicsInput = z.infer<typeof SummarizeTopicsInputSchema>;

// Updated output schema to include category
const SummarizeTopicsOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise paragraph summarizing the main themes and key takeaways of the conversation.'),
  keyTopics: z.array(z.string()).describe('A list of the most important topics discussed.'),
  category: z.string().nullable().describe('The main category of the conversation (e.g., "Backend Development", "Data Structures & Algorithms", "Leetcode Problem", "Frontend Frameworks", "Web Design", "General Conversation", "Other Technical"). Null if category is unclear.')
});
export type SummarizeTopicsOutput = z.infer<typeof SummarizeTopicsOutputSchema>;

export async function summarizeTopics(input: SummarizeTopicsInput): Promise<SummarizeTopicsOutput> {
  return summarizeTopicsFlow(input);
}

const summarizeTopicsPrompt = ai.definePrompt({
  name: 'summarizeTopicsPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: SummarizeTopicsInputSchema},
  output: {schema: SummarizeTopicsOutputSchema},
  prompt: `You are an expert AI assistant skilled in analyzing and summarizing conversations.

  Your task is to carefully read the following ChatGPT conversation and provide a high-quality summary and categorization.

  Conversation:
  {{{conversation}}}

  Instructions:
  1. Identify the main themes and overarching goals discussed in the conversation.
  2. Extract the most important and distinct topics covered. List these as 'keyTopics'.
  3. Write a concise paragraph ('summary') that synthesizes these themes and topics, capturing the essence and key takeaways of the discussion. Focus on clarity and brevity.
  4. Determine the primary category of the conversation. Choose from the following options: "Backend Development", "Data Structures & Algorithms", "Leetcode Problem", "Frontend Frameworks", "Web Design", "General Conversation", "Other Technical". If the category is ambiguous or doesn't fit well, assign "General Conversation" or "Other Technical" as appropriate. If unsure, set the 'category' field to null.
  5. Ensure the output matches the requested JSON format with 'summary', 'keyTopics', and 'category' fields.
`,
});

const summarizeTopicsFlow = ai.defineFlow(
  {
    name: 'summarizeTopicsFlow',
    inputSchema: SummarizeTopicsInputSchema,
    outputSchema: SummarizeTopicsOutputSchema,
  },
  async input => {
    const {output} = await summarizeTopicsPrompt(input);
    // Ensure output is not null before returning
    if (!output) {
        // Provide a default structure on failure, matching the schema
        return { summary: "", keyTopics: [], category: null };
    }
    // Ensure category is returned, defaulting to null if missing
    return {
        summary: output.summary || "",
        keyTopics: output.keyTopics || [],
        category: output.category !== undefined ? output.category : null
    };
  }
);
