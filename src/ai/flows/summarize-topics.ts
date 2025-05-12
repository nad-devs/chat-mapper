'use server';
/**
 * @fileOverview Summarizes the key concepts grasped by the learner in a conversation and assigns a category.
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

// Updated output schema to include learningSummary in the specified format
const SummarizeTopicsOutputSchema = z.object({
  learningSummary: z
    .string()
    .describe('A Markdown bullet-point list of every concept the learner ended up grasping. Each bullet starts with ✔, describes the concept concisely, and includes a short parenthetical note on the specific stumbling block resolved (e.g., "(struggled with mapping chars to indices)"). Include one-sentence plain-English definitions where helpful. No praise or teaching process explanations.'),
  keyTopics: z.array(z.string()).describe('A list of the most important general topics discussed (remains for categorization/tagging).'),
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
  prompt: `You are ChatGPT, a senior learning-design specialist.
Analyze the entire conversation below.

Conversation:
{{{conversation}}}

Your job is to produce a **Learning Summary**.

Instructions for **Learning Summary**:
1.  Identify *every* concept or technique the learner **ended up grasping** by the end of the conversation. Ignore concepts they remained confused about.
2.  Format the output as a Markdown bullet-point list.
3.  For *each* grasped concept:
    *   Start the bullet point with a checkmark emoji (✔).
    *   Follow with a concise description of the concept/technique grasped.
    *   Immediately after the description, add a very short parenthetical note identifying the specific stumbling block that was resolved during the discussion of *that specific concept*. Example: "(struggled with dictionary syntax)" or "(confused about base cases)". If no specific struggle for a grasped concept is evident, omit the parenthesis for that bullet.
    *   Where helpful for clarity, include a brief, one-sentence plain-English definition of the technical term or concept *within* the bullet point description.
4.  **Crucially:** Do *not* include any explanation of the teaching process, praise for the learner, or repetition of the problem name after its first mention (if applicable). Focus solely on the learned concepts and resolved struggles.
5.  Return this bullet list as the value for the \`learningSummary\` field.

Additionally:
6.  Identify the most important general topics discussed (e.g., "Python Dictionaries", "Recursion", "Valid Anagram Problem") and return them as a list in the \`keyTopics\` field.
7.  Determine the primary category of the conversation. Choose from: "Backend Development", "Data Structures & Algorithms", "Leetcode Problem", "Frontend Frameworks", "Web Design", "General Conversation", "Other Technical". If unsure or ambiguous, use "General Conversation" or "Other Technical". Return this in the \`category\` field (or null if truly unclassifiable).

Ensure the entire output strictly matches the requested JSON schema with 'learningSummary', 'keyTopics', and 'category' fields.
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
        return { learningSummary: "", keyTopics: [], category: null };
    }
    // Ensure all fields are returned, defaulting if necessary
    return {
        learningSummary: output.learningSummary || "",
        keyTopics: output.keyTopics || [],
        category: output.category !== undefined ? output.category : null
    };
  }
);
