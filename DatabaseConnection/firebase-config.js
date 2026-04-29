
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyC_xdeJHhtH8zRfUg_febv3a0PrplWqBsw",
  authDomain:        "embr6database.firebaseapp.com",
  projectId:         "embr6database",
  storageBucket:     "embr6database.firebasestorage.app",
  messagingSenderId: "903842472512",
  appId:             "1:903842472512:web:9966ef6d6c90811f2335a5",
  measurementId:     "G-J2Y4574G5N"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);