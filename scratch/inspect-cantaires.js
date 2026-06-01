const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('contacts').get();
  let found = false;
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const dataStr = JSON.stringify(data).toLowerCase();
    if (dataStr.includes('cantaires') || dataStr.includes('ebre')) {
      console.log(`Found doc: ${doc.id}`);
      console.log(JSON.stringify(data, null, 2));
      found = true;
    }
  });
  if (!found) {
    console.log("No contacts matching 'cantaires' or 'ebre' found.");
  }
  process.exit(0);
}

main().catch(console.error);
