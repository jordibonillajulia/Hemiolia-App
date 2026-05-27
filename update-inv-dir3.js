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
const { getFirestore, collection, query, where, getDocs, doc, updateDoc } = require('firebase/firestore');

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
  const dir3Code = 'L01430770';
  const q = query(collection(db, 'invoices'), where('invoiceNumber', '==', '202600000004'));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data();
    const updatedClientData = {
      ...data.clientData,
      dir3OficinaContable: dir3Code,
      dir3OrganoGestor: dir3Code,
      dir3UnidadTramitadora: dir3Code
    };
    await updateDoc(doc(db, 'invoices', d.id), {
      clientData: updatedClientData
    });
    console.log(`Updated invoice JB-2026-004 with DIR3 for Mas de Barberans`);
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
