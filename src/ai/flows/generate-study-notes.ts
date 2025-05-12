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
import { saveLearningEntry } from '@/app/actions'; // Ensure save action is imported

const GenerateStudyNotesInputSchema = z.object({
  conversationText: z
    .string()
    .describe('The full text of the ChatGPT conversation.'),
  // Optional: Pass learned concept and code snippet if already extracted
  learnedConcept: z.string().optional().nullable().describe('The main concept learned/problem solved, if pre-analyzed.'),
  finalCodeSnippet: z.string().optional().nullable().describe('The final code snippet, if pre-analyzed.'),
  codeLanguage: z.string().optional().nullable().describe('The language of the code snippet, if pre-analyzed.')
});
export type GenerateStudyNotesInput = z.infer<
  typeof GenerateStudyNotesInputSchema
>;

const GenerateStudyNotesOutputSchema = z.object({
  studyNotes: z
    .string()
    .describe(
      'Compact, well-formatted study sheet based *only* on the technical content of the conversation. Follows the structure: Problem Definition, Algorithm Outline, Annotated Solution (in relevant language). No mention of learner struggles. Uses Markdown.' // Updated description
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

// Previous simpler prompt structure
const prompt = ai.definePrompt({
  name: 'generateStudyNotesPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: GenerateStudyNotesInputSchema},
  output: {schema: GenerateStudyNotesOutputSchema},
  prompt: `You are an expert technical writer creating study notes from a conversation.
Analyze the entire conversation text provided below. Your task is to create a compact, well-formatted study sheet that the learner can review later. **This sheet should contain ONLY the technical reference material derived from the conversation.**

Conversation Text:
{{{conversationText}}}

{{#if learnedConcept}}
Previously Identified Concept: {{{learnedConcept}}}
{{/if}}
{{#if finalCodeSnippet}}
Previously Identified Code Snippet:
\`\`\`{{#if codeLanguage}}{{{codeLanguage}}}{{/if}}
{{{finalCodeSnippet}}}
\`\`\`
{{/if}}

Instructions for **Study Notes**:
1.  **Structure:** Format the output *exactly* as follows using Markdown. Omit a subsection ONLY if the information is genuinely absent in the conversation.
    *   Use H3 headings (\`### \`) for "Problem Definition", "Algorithm Outline", and "Annotated Solution".
    *   Use bullet points (\`* \` or \`- \`) or numbered lists (\`1. \`) as appropriate under each heading.
2.  **Content:**
    *   **### Problem Definition:** Write one crisp sentence naming the specific problem discussed (e.g., "Contains Duplicate", "Valid Anagram") and its objective. Extract this from the conversation.
    *   **### Algorithm Outline:** List the key steps of the *final or agreed-upon algorithm* discussed for solving the problem. Extract or synthesize these steps from the conversation.
    *   **### Annotated Solution:** Include the *final or most complete code snippet* presented in the conversation.
        *   If a \`finalCodeSnippet\` was provided in the input, use that. Otherwise, extract it from the \`conversationText\`.
        *   If no code snippet is present in the conversation, state "No specific code solution provided in the conversation." under this heading.
        *   If a code snippet *is* included, add brief, clear inline comments (\`# comment\` for Python, \`// comment\` for JS/Java/C++, etc.) explaining each crucial step or line of the code, based on the explanation given *in the conversation*. Use the language identified (\`codeLanguage\` input) or detect it if necessary.
3.  **Restrictions:**
    *   **DO NOT** mention the learner's struggles, learning journey, thought process, or any conversational back-and-forth in this Study Notes section.
    *   Keep the notes concise and focused purely on the technical information and the final solution.
    *   If the conversation doesn't contain a clear technical problem, algorithm, or code, make the relevant sections brief or indicate the absence of information (e.g., "Algorithm not applicable.", "No specific code solution provided."). If the entire conversation lacks technical substance for notes, return a brief message like "No specific technical content suitable for study notes was found."

Return the formatted study notes as a single Markdown string in the "studyNotes" field.
`,
});


const generateStudyNotesFlow = ai.defineFlow(
  {
    name: 'generateStudyNotesFlow',
    inputSchema: GenerateStudyNotesInputSchema,
    outputSchema: GenerateStudyNotesOutputSchema, // Ensure output schema is defined
  },
  async input => {
    // Note: This flow now takes optional pre-analyzed code info,
    // but the prompt is designed to work even if it's not provided,
    // extracting info directly from the conversation text.
    const {output} = await prompt(input);
    // Ensure output is not null before returning, otherwise return a default structure
    if (!output) {
       return { studyNotes: "" }; // Return empty notes if AI fails to produce output
    }

    const studyNotesContent = output.studyNotes || "";

    // // Removed Firestore saving from here - will be triggered by button in UI
    // if (studyNotesContent.trim().length > 0) {
    //     const topicName = input.learnedConcept || "Untitled Study Notes"; // Use learned concept or a default
    //     try {
    //         await saveLearningEntry({
    //             topicName: topicName,
    //             type: "study-notes",
    //             content: studyNotesContent,
    //             // timestamp is added by the action
    //         });
    //         console.log(`[Flow: Study Notes] Saved study notes for topic: ${topicName}`);
    //     } catch (saveError) {
    //         console.error(`[Flow: Study Notes] Failed to save study notes for topic ${topicName}:`, saveError);
    //         // Decide if flow should fail or just log error
    //     }
    // }

    // Pass through the AI's response, even if notes are empty
    return { studyNotes: studyNotesContent };
  }
);