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

const SummarizeTopicsOutputSchema = z.object({
  topics: z
    .string()
    .describe('A summary of the main topics discussed in the conversation.'),
});
export type SummarizeTopicsOutput = z.infer<typeof SummarizeTopicsOutputSchema>;

export async function summarizeTopics(input: SummarizeTopicsInput): Promise<SummarizeTopicsOutput> {
  return summarizeTopicsFlow(input);
}

const summarizeTopicsPrompt = ai.definePrompt({
  name: 'summarizeTopicsPrompt',
  input: {schema: SummarizeTopicsInputSchema},
  output: {schema: SummarizeTopicsOutputSchema},
  prompt: `You are an expert at identifying the topics discussed in a conversation.

  Summarize the topics discussed in the following conversation:

  {{conversation}}`,
});

const summarizeTopicsFlow = ai.defineFlow(
  {
    name: 'summarizeTopicsFlow',
    inputSchema: SummarizeTopicsInputSchema,
    outputSchema: SummarizeTopicsOutputSchema,
  },
  async input => {
    const {output} = await summarizeTopicsPrompt(input);
    return output!;
  }
);
