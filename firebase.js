/* ===================================================================
 *  FIREBASE SETUP  —  this is the only file you edit by hand.
 *  Firebase console → Project settings (gear) → Your apps → Web app →
 *  copy the config object and paste its values below, replacing PASTE_ME.
 *
 *  NOTE: these values are NOT secret. The Firebase web config is meant to
 *  ship in client code; your data is protected by Firestore security rules
 *  + Google sign-in, not by hiding this. It's safe in a public repo.
 * =================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PASTE_ME",
  authDomain: "PASTE_ME",
  projectId: "PASTE_ME",
  storageBucket: "PASTE_ME",
  messagingSenderId: "PASTE_ME",
  appId: "PASTE_ME",
};

export const configured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "PASTE_ME";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
