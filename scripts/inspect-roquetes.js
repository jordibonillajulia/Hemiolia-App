const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('contacts').where('municipality', '==', 'Roquetes').get();
  if (snapshot.empty) {
    console.log("No contact found for Roquetes");
  } else {
    snapshot.docs.forEach(doc => {
      console.log(`Document: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  }
  process.exit(0);
}

main().catch(console.error);
