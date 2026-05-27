const fs = require('fs');
const dotenvLocalPath = './.env.local';
if (fs.existsSync(dotenvLocalPath)) {
  const envConfig = fs.readFileSync(dotenvLocalPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && !key.startsWith('#')) {
        process.env[key] = val;
      }
    }
  }
}

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
const { generateFacturaeXML } = require('./src/lib/facturaeGenerator');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, 'invoices'), where('invoiceNumber', '==', '202600000004'));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log('Invoice not found.');
    process.exit(1);
  }
  const invoice = snap.docs[0].data();
  const xml = generateFacturaeXML(invoice);
  fs.writeFileSync('test_invoice_4.xml', xml);
  console.log('Wrote test_invoice_4.xml');
  process.exit(0);
}

run().catch(console.error);
