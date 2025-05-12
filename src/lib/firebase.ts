
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, serverTimestamp } from 'firebase/firestore'; // Import Firestore and serverTimestamp
// Add other Firebase services as needed (e.g., getAuth, getStorage)

// User-provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD-_ZnF95A9m5o2eKE2Pdv9V06Eg70rQ4o",
  authDomain: "chatmapper-jagu3.firebaseapp.com",
  projectId: "chatmapper-jagu3",
  storageBucket: "chatmapper-jagu3.appspot.com", // Ensure this matches your storage bucket if using storage
  messagingSenderId: "440684675583",
  appId: "1:440684675583:web:0003e89a9efd1396a067ca"
  // measurementId is optional and wasn't provided, can be added if needed
};


console.log("[Firebase] Initializing with Project ID:", firebaseConfig.projectId);
console.log("[Firebase] Auth Domain:", firebaseConfig.authDomain);

// Basic check for essential config
if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    console.error("[Firebase] ERROR: Firebase Project ID or API Key is missing in the provided configuration.");
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

// Initialize Firestore
let db: Firestore;
try {
    db = getFirestore(app);
    console.log("[Firebase] Firestore initialized successfully.");
} catch(e) {
    console.error("[Firebase] Error initializing Firestore:", e);
    // Rethrow or handle error as needed
    throw e;
}


// Export the app and db instances, and serverTimestamp
export { app, db, serverTimestamp };
