// Summarize the main topics discussed in a conversation.
'use server';
/**
 * @fileOverview Summarizes the main topics discussed in a conversation.
 *
 * - summarizeTopics - A function that summarizes the topics in a conversation.
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

// Updated output schema to potentially include a list of topics or a more structured summary
const SummarizeTopicsOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise paragraph summarizing the main themes and key takeaways of the conversation.'),
  keyTopics: z.array(z.string()).describe('A list of the most important topics discussed.')
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

  Your task is to carefully read the following ChatGPT conversation and provide a high-quality summary.

  Conversation:
  {{{conversation}}}

  Instructions:
  1. Identify the main themes and overarching goals discussed in the conversation.
  2. Extract the most important and distinct topics covered. List these as 'keyTopics'.
  3. Write a concise paragraph ('summary') that synthesizes these themes and topics, capturing the essence and key takeaways of the discussion. Focus on clarity and brevity.
  4. Ensure the output matches the requested JSON format with 'summary' and 'keyTopics' fields.
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
        throw new Error("AI failed to generate a summary.");
    }
    return output;
  }
);
