// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyADeJA9BXp3d-6fOAwBERL0LKlSb_s-tF8",
  authDomain: "warehouse-yas.firebaseapp.com",
  projectId: "warehouse-yas",
  storageBucket: "warehouse-yas.firebasestorage.app",
  messagingSenderId: "925390333100",
  appId: "1:925390333100:web:730851f8049fc9404cab09"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);