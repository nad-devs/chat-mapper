
import { config } from 'dotenv';
// Load environment variables from .env file, especially if GOOGLE_API_KEY is stored there
config();

// Make sure the paths to your AI flows are correct
import '@/ai/flows/map-concepts';
import '@/ai/flows/summarize-topics';
import '@/ai/flows/analyze-code'; // Add the new flow
