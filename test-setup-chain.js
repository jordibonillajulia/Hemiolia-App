const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const docRef = doc(db, 'invoices', 'tLfMDXdgNo9ljD612FIv');
  await updateDoc(docRef, {
    status: 'Enviada',
    huella: '87FE2BFD4FAA8D95861074FC305C51465CD8C392A66F3540DD2C6B77B8DA7566',
    verifactuId: 'A-F56S8BAY623ZL8',
    sentAt: '2026-05-25T14:16:59.000Z'
  });
  console.log('Successfully set invoice tLfMDXdgNo9ljD612FIv to Enviada with the registered huella and CSV!');
}

run().catch(console.error);
