// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB64tAKvCHeYnJ8-HNRLpzB7sQRng4FHyA",
  authDomain: "pufemo-2dc3a.firebaseapp.com",
  projectId: "pufemo-2dc3a",
  storageBucket: "pufemo-2dc3a.firebasestorage.app",
  messagingSenderId: "321284306570",
  appId: "1:321284306570:web:ca891826c3e4edde8edf73"
};

const app = initializeApp(firebaseConfig);

// Eğer istersen şunları da dışa aktarabiliriz:
const auth = getAuth(app);
const db = getFirestore(app);
