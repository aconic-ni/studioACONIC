

// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAmJn-Kyy-efCeEqvjSZBADRLasPNXkShc",
  authDomain: "aconic-examiner.firebaseapp.com",
  projectId: "aconic-examiner",
  storageBucket: "aconic-examiner.appspot.com",
  messagingSenderId: "836588880993",
  appId: "1:836588880993:web:209d3f7cf414300258d620",
  measurementId: "G-C5GDZT3L32"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // Use existing app if already initialized
}

const authInstance: Auth = getAuth(app);
const firestoreInstance: Firestore = getFirestore(app);

let analytics: Analytics | undefined;
// Initialize Analytics only on the client side
if (typeof window !== 'undefined') {
  try {
    if (firebaseConfig.measurementId) {
      analytics = getAnalytics(app);
    } else {
      console.warn("Firebase Analytics not initialized because measurementId is missing from firebaseConfig.");
    }
  } catch (error) {
    console.warn("Firebase Analytics could not be initialized.", error);
  }
}

export { app, authInstance as auth, firestoreInstance as db, analytics };

