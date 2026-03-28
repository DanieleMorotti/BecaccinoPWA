import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { CACHE_SIZE_UNLIMITED, initializeFirestore } from "firebase/firestore";

const requiredEnv = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

for (const key of requiredEnv) {
  if (!import.meta.env[key]) {
    throw new Error(`Missing env var: ${key}`);
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

const detectUnstableRealtimeEnvironment = () => {
  if (typeof window == "undefined" || typeof navigator == "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";
  const isIos = 
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/.test(ua);
  const isStandalone = 
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & {standalone?: boolean}).standalone);

  return isIos || isSafari || isStandalone;
};

const shouldPreferLongPolling = detectUnstableRealtimeEnvironment();

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// We use initializeFirestore to set specific networking properties.
// On iOS/Safari, we MUST use long-polling to avoid the 2-3 second buffering delay imposed by Safari
export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: shouldPreferLongPolling,
});

export const ensureAuth = async () => {
  if (!auth.currentUser) {
    const cred = await signInAnonymously(auth);
    return cred.user;
  }
  return auth.currentUser;
};
