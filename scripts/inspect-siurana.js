const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('contacts').where('municipality', '==', "Siurana d'Empordà").get();
  if (snapshot.empty) {
    const snapshot2 = await db.collection('contacts').get();
    snapshot2.docs.forEach(doc => {
      const data = doc.data();
      if ((data.municipality || '').toLowerCase().includes('siurana')) {
        console.log(`Document found by search: ${doc.id}`);
        console.log(JSON.stringify(data, null, 2));
      }
    });
  } else {
    snapshot.docs.forEach(doc => {
      console.log(`Document: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  }
  process.exit(0);
}

main().catch(console.error);
