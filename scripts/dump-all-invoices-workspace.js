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
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
  const snapshot = await getDocs(collection(db, 'invoices'));
  console.log("=== ALL INVOICES ===");
  const list = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    list.push({
      id: doc.id,
      invoiceNumber: data.invoiceNumber,
      issuerId: data.issuerId,
      date: data.date,
      status: data.status,
      huella: data.huella || 'NONE',
      verifactuId: data.verifactuId || 'NONE',
      verifactuEnv: data.verifactuEnv || 'NONE',
      totals: data.totals
    });
  }
  // Sort by invoiceNumber
  list.sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
  console.log(JSON.stringify(list, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
