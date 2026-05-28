const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

// Use native --env-file flag or next env loading

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

console.log('Initializing Firebase Client SDK...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkInvoice() {
  console.log('Fetching all invoices...');
  const snapshot = await getDocs(collection(db, 'invoices'));
  const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  console.log(`Found ${invoices.length} invoices:`);
  for (const inv of invoices) {
    console.log(`- ID: ${inv.id}, Number: ${inv.invoiceNumber}, Status: ${inv.status}, Date: ${inv.date}, Client: ${inv.clientName}`);
    if (inv.invoiceNumber === 'JB-2026-002') {
      console.log('Palamos invoice lines:', JSON.stringify(inv.lines, null, 2));
      console.log('Palamos totals:', JSON.stringify(inv.totals, null, 2));
    }
  }
}

checkInvoice().catch(err => {
  console.error('Error fetching invoices:', err);
});
