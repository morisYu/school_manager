import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCr4pQC9kAS5QG0s3VDRdEYDqd08uducSY",
  authDomain: "schoolmanage87.firebaseapp.com",
  databaseURL: "https://schoolmanage87-default-rtdb.firebaseio.com",
  projectId: "schoolmanage87",
  storageBucket: "schoolmanage87.firebasestorage.app",
  messagingSenderId: "994976889761",
  appId: "1:994976889761:web:23e06a6fefc3af95bc69e0",
  measurementId: "G-48F460MVRZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
