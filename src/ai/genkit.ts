
import { genkit } from 'genkit'; // Remove LogLevel import as it's not used here
import { googleAI } from '@genkit-ai/googleai';

// Ensure GOOGLE_API_KEY is available in the environment variables
// It might be loaded via dotenv in dev.ts or set directly in the deployment environment

export const ai = genkit({
  plugins: [
    googleAI({
        // You might need to explicitly pass apiKey if it's not automatically picked up
        // apiKey: process.env.GOOGLE_API_KEY
    })
  ],
  // Use the desired model, ensure it supports the required capabilities (function calling/structured output)
  // 'gemini-1.5-flash-latest' or 'gemini-1.5-pro-latest' are good choices
  // model: 'googleai/gemini-1.5-flash-latest', // Model can often be specified per-call if needed
  // logLevel and enableTracing removed as per Genkit 1.x guidelines for genkit()
});

