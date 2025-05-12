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

// Updated output schema for a simpler learning summary
const SummarizeTopicsOutputSchema = z.object({
  learningSummary: z
    .string()
    .describe('A concise summary (paragraph or simple bullet points) of the main concepts or techniques the learner grasped or discussed during the conversation. Focus on the core takeaways.'),
  keyTopics: z.array(z.string()).describe('A list of the most important specific topics or terms discussed (e.g., "Python Dictionaries", "Recursion", "Valid Anagram Problem", "CSS Flexbox").'),
  category: z.string().nullable().describe('The main category of the conversation (e.g., "Backend Development", "Data Structures & Algorithms", "Leetcode Problem", "Frontend Frameworks", "Web Design", "General Conversation", "Other Technical"). Null if category is unclear.')
});
export type SummarizeTopicsOutput = z.infer<typeof SummarizeTopicsOutputSchema>;

export async function summarizeTopics(input: SummarizeTopicsInput): Promise<SummarizeTopicsOutput | null> {
   try {
        const result = await summarizeTopicsFlow(input);
        // Return result even if empty, action handler will check content
        return result;
    } catch (error) {
        console.error("Error in summarizeTopicsFlow:", error);
        return null; // Indicate failure
    }
}

const summarizeTopicsPrompt = ai.definePrompt({
  name: 'summarizeTopicsPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: SummarizeTopicsInputSchema},
  output: {schema: SummarizeTopicsOutputSchema},
  prompt: `You are an expert learning assistant. Analyze the following conversation:

Conversation:
{{{conversation}}}

Your task is to:
1.  **Learning Summary:** Write a concise summary (1-3 sentences or a short bullet list) of the main technical concepts, skills, or problem-solving approaches the learner grasped or discussed. Focus on the key takeaways of the conversation. Keep it simple and direct.
2.  **Key Topics:** Identify the most important, specific technical topics, terms, or problem names mentioned (e.g., "Python Dictionaries", "Recursion", "Valid Anagram Problem", "CSS Flexbox"). List these as an array of strings in the \`keyTopics\` field. Be specific.
3.  **Category:** Determine the primary category of the conversation. Choose the *most specific relevant category* from: "Backend Development", "Data Structures & Algorithms", "Leetcode Problem", "Frontend Frameworks", "Web Design", "General Conversation", "Other Technical". If it's a specific Leetcode problem, use "Leetcode Problem". If unsure or ambiguous, use "General Conversation" or "Other Technical". Return this in the \`category\` field (or null if truly unclassifiable).

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
    const {output} = await prompt(input);
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
