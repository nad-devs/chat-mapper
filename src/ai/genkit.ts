
import { genkit, LogLevel } from 'genkit'; // Import LogLevel if needed
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
  model: 'googleai/gemini-1.5-flash-latest',
  logLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO, // Optional: Set log level
  enableTracing: true, // Optional: Enable tracing
});
