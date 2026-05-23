// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// PASTE YOUR CONFIG FROM FIREBASE CONSOLE BELOW:
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDD34FfvHTuz7QYUErdd29um7YcuvunZ3I",
  authDomain: "styleai-5ed86.firebaseapp.com",
  projectId: "styleai-5ed86",
  storageBucket: "styleai-5ed86.firebasestorage.app",
  messagingSenderId: "758428842534",
  appId: "1:758428842534:web:1309ce13a107ae1108c4e7",
  measurementId: "G-FYZRWENWM6"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);