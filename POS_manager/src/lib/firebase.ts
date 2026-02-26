import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAWk-4VmOTCe1TfnrwUGPOotN877ob8K4c",
  authDomain: "mynga-6c26a.firebaseapp.com",
  databaseURL: "https://mynga-6c26a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mynga-6c26a",
  storageBucket: "mynga-6c26a.firebasestorage.app",
  messagingSenderId: "381816147855",
  appId: "1:381816147855:web:b16865625211ef0b9b45fa",
  measurementId: "G-DWJZFZ5KCV",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
