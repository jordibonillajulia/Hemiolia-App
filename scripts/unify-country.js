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

async function run() {
  const snapshot = await getDocs(collection(db, 'clients_billing'));
  let count = 0;
  for (const clientDoc of snapshot.docs) {
    const data = clientDoc.data();
    // Update the country to 'Espanya' and ensure countryCode is 'ES' for all
    if (data.country !== 'Espanya' || data.countryCode !== 'ES') {
      await updateDoc(doc(db, 'clients_billing', clientDoc.id), {
        country: 'Espanya',
        countryCode: 'ES'
      });
      console.log(`Updated client: ${data.name} (Was: ${data.country || 'N/A'}, ${data.countryCode || 'N/A'})`);
      count++;
    }
  }
  console.log(`Successfully unified country to 'Espanya' for ${count} clients.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
