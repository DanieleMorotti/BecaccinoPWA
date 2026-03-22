import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBCDflnhtbfqsU6nCAYWQ-pgnDGlOvO8f8",
  authDomain: "becaccino-9bd67.firebaseapp.com",
  projectId: "becaccino-9bd67",
  storageBucket: "becaccino-9bd67.firebasestorage.app",
  messagingSenderId: "506804103545",
  appId: "1:506804103545:web:03d1af7c770cfa16a5e7a8"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const ensureAuth = async () => {
  if (!auth.currentUser) {
    const cred = await signInAnonymously(auth);
    return cred.user;
  }
  return auth.currentUser;
};
