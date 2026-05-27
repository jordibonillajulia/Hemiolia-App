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
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

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

async function checkAndFix() {
  const snapshot = await getDocs(collection(db, 'clients_billing'));
  for (const clientDoc of snapshot.docs) {
    const data = clientDoc.data();
    if (data.country !== 'Espanya') {
      console.log(`Found un-unified client: ${data.name} -> country: ${data.country}`);
      await updateDoc(doc(db, 'clients_billing', clientDoc.id), { country: 'Espanya' });
    }
  }

  const invSnapshot = await getDocs(collection(db, 'invoices'));
  let invCount = 0;
  for (const inv of invSnapshot.docs) {
    const data = inv.data();
    if (data.clientData && data.clientData.country && data.clientData.country !== 'Espanya') {
      const newClientData = { ...data.clientData, country: 'Espanya' };
      await updateDoc(doc(db, 'invoices', inv.id), { clientData: newClientData });
      invCount++;
    }
  }
  console.log(`Fixed ${invCount} invoices with old country data.`);
  process.exit(0);
}

checkAndFix().catch(console.error);
