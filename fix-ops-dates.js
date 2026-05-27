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
const { getFirestore, doc, updateDoc, collection, getDocs } = require('firebase/firestore');

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
  const opsDates = {
    'PM-202600000002': '2026-05-09',
    'PM-202600000003': '2026-05-09',
    'JB-202600000002': '2026-05-14'
  };

  const snapshot = await getDocs(collection(db, 'invoices'));
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const key = `${data.issuerId}-${data.invoiceNumber}`;
    
    if (opsDates[key]) {
      const docRef = doc(db, 'invoices', docSnap.id);
      await updateDoc(docRef, {
        operationDate: opsDates[key]
      });
      console.log(`Updated ${key} operationDate to ${opsDates[key]}`);
    }
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
