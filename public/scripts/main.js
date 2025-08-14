// Import the functions you need from the SDKs you need
// Ensure you use the specific version number in the path
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Your web app's Firebase configuration
// IMPORTANT: REPLACE WITH YOUR ACTUAL VALUES from Firebase Console -> Project Settings -> Your Apps (Web App)
const firebaseConfig = {
  apiKey: "AIzaSyBa7_mkNVlIHQgWYytgXy0sLqkfuS-rVK4",
  authDomain: "rajukart-ae5ca.firebaseapp.com",
  projectId: "rajukart-ae5ca", // This should already be correct
  storageBucket: "rajukart-ae5ca.firebasestorage.app",
  messagingSenderId: "570218176052",
  appId: "1:570218176052:web:ea421005352249c160b461",
  measurementId: "G-PGTT4FEZEJ" // If you have Analytics enabled
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Get the Authentication service instance

const userStatusDiv = document.getElementById('user-status');

// --- Basic User Presence with Anonymous Authentication ---

// Function to handle user state changes (login, logout)
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in.
    const uid = user.uid;
    console.log("User is signed in. UID:", uid);
    if (userStatusDiv) {
        userStatusDiv.textContent = `User is signed in. UID: ${uid} (Anonymous)`;
    }
  } else {
    // User is signed out.
    console.log("User is signed out.");
    if (userStatusDiv) {
        userStatusDiv.textContent = `User is signed out.`;
    }
  }
});

// Sign in anonymously to get a basic user ID
signInAnonymously(auth)
  .then(() => {
    console.log("Successfully signed in anonymously.");
  })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    console.error("Anonymous sign-in failed:", errorCode, errorMessage);
    if (userStatusDiv) {
        userStatusDiv.textContent = `Error signing in: ${errorMessage}`;
    }
  });

// We'll add more code here later for products, cart, etc.
