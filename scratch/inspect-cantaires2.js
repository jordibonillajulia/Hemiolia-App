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
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const entity = data.entity || '';
    if (entity.toLowerCase().includes('cantaires') || (data.municipality || '').toLowerCase().includes('cantaires')) {
      console.log(`Document ID: ${doc.id}`);
      console.log(JSON.stringify(data, null, 2));
    }
  });
  process.exit(0);
}

main().catch(console.error);
