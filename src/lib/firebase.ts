
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
// Remove Firestore imports: import { getFirestore, Firestore } from 'firebase/firestore';
// Add other Firebase services as needed (e.g., getAuth, getStorage)

// Log which variables are being used for configuration
console.log("[Firebase] Initializing with Project ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID);
console.log("[Firebase] Auth Domain:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN);

const firebaseConfig = {
  // Prefer server-side variables (without NEXT_PUBLIC_) if available,
  // otherwise fallback to NEXT_PUBLIC_ variables.
  // This assumes you might set FIREBASE_API_KEY etc. directly in your server environment.
  apiKey: process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Basic check for essential config
if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    console.error("[Firebase] ERROR: Firebase Project ID or API Key is missing in environment variables.");
    // Consider throwing an error or handling this case appropriately
    // throw new Error("Firebase Project ID or API Key is missing.");
}


// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("[Firebase] Firebase App initialized successfully.");
  } catch (e) {
      console.error("[Firebase] Error initializing Firebase App:", e);
      // Rethrow or handle error as needed
      throw e;
  }

} else {
  app = getApp();
  console.log("[Firebase] Existing Firebase App retrieved.");
}

// Removed Firestore initialization and export
// let db: Firestore;
// try {
//     db = getFirestore(app);
//     console.log("[Firebase] Firestore initialized successfully.");
// } catch(e) {
//     console.error("[Firebase] Error initializing Firestore:", e);
//     // Rethrow or handle error as needed
//     throw e;
// }


// Export only the app instance
export { app }; // Removed db export

// Note: Ensure that your Firestore rules in the Firebase console
// allow write access to the 'learningEntries' collection for authenticated users
// or for the specific service account/identity running your server actions if applicable.
// (This note is less relevant now but kept for context if Firestore is re-added later)

