const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const doc = await db.collection('contacts').doc('09DozvVip0sZpYgH5Rz1').get();
  console.log(JSON.stringify(doc.data(), null, 2));
  process.exit(0);
}

main().catch(console.error);
