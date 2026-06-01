const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('contacts').where('municipality', '==', 'el Bruc').get();
  if (snapshot.empty) {
    const snapshot2 = await db.collection('contacts').where('municipality', '==', 'El Bruc').get();
    snapshot2.docs.forEach(doc => {
      console.log(`Document: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
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
