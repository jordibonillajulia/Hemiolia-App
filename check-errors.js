const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
  const snapshot = await getDocs(collection(db, 'invoices'));
  const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  console.log(`Found ${invoices.length} invoices:`);
  for (const inv of invoices) {
    console.log(`ID: ${inv.id}`);
    console.log(`  Number: ${inv.invoiceNumber}`);
    console.log(`  Client: ${inv.clientName}`);
    console.log(`  Date: ${inv.date}`);
    console.log(`  Status: ${inv.status}`);
    console.log(`  LastError: ${inv.lastError || 'none'}`);
    console.log(`  Totals: ${JSON.stringify(inv.totals)}`);
    console.log(`  Lines: ${JSON.stringify(inv.lines)}`);
    console.log(`  Issuer: ${inv.issuerId} - ${JSON.stringify(inv.issuerData)}`);
  }
}

run().catch(console.error);
