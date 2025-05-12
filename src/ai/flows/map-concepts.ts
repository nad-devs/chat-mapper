'use server';

/**
 * @fileOverview An AI agent for identifying and relating subtopics and key concepts within a main topic of a conversation.
 *
 * - mapConcepts - A function that handles the concept mapping process.
 * - MapConceptsInput - The input type for the mapConcepts function.
 * - MapConceptsOutput - The return type for the mapConcepts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MapConceptsInputSchema = z.object({
  mainTopic: z.string().describe('The main topic of the conversation.'),
  conversationText: z.string().describe('The full text of the ChatGPT conversation.'),
});
export type MapConceptsInput = z.infer<typeof MapConceptsInputSchema>;

const MapConceptsOutputSchema = z.object({
  concepts: z
    .array(z.string())
    .describe('A list of key concepts related to the main topic.'),
  subtopics: z
    .array(z.string())
    .describe('A list of subtopics within the main topic.'),
  relationships: z
    .array(z.object({from: z.string(), to: z.string(), type: z.string()}))
    .describe('The relationships between concepts and subtopics.'),
});
export type MapConceptsOutput = z.infer<typeof MapConceptsOutputSchema>;

export async function mapConcepts(input: MapConceptsInput): Promise<MapConceptsOutput> {
  return mapConceptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'mapConceptsPrompt',
  model: 'googleai/gemini-1.5-flash-latest', // Added model
  input: {schema: MapConceptsInputSchema},
  output: {schema: MapConceptsOutputSchema},
  prompt: `You are an expert in analyzing conversations and identifying key concepts, subtopics, and their relationships.

  Analyze the following conversation within the context of the main topic and identify the key concepts, subtopics, and relationships between them.

  Main Topic: {{{mainTopic}}}
  Conversation: {{{conversationText}}}

  Consider the relationships between concepts and subtopics, such as "is a part of", "is related to", "causes", "requires", etc.
  Format the output as JSON.  The \"concepts\" and \"subtopics\" fields should be simple lists of strings.
  The \"relationships\" field should be a list of objects where each object has a \"from\" field, a \"to\" field, and a \"type\" field.
`,
});

const mapConceptsFlow = ai.defineFlow(
  {
    name: 'mapConceptsFlow',
    inputSchema: MapConceptsInputSchema,
    outputSchema: MapConceptsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
