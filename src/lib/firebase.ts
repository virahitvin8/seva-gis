/**
 * Firebase Client SDK Configuration & Initializer
 *
 * Provides optional Firebase Authentication, Firestore, and Analytics integration.
 * If credentials are not yet supplied via environment variables, operations fall back
 * smoothly to local IndexedDB / mock storage without breaking the UI.
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'seva-gis-backend.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'seva-gis-backend',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'seva-gis-backend.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId
);

console.log(
  `[SEVA·GIS Firebase] Project: ${firebaseConfig.projectId} · Status: ${
    isFirebaseConfigured ? 'CONNECTED' : 'STANDALONE (Hosting-ready)'
  }`
);
