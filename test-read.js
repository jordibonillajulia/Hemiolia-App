import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "dummy",
  projectId: "hemiolia-app",
};

// I need the actual config from src/lib/firebase.js to read the db
