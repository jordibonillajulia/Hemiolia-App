const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();
async function run() {
  const snapshot = await db.collection('invoices').where('invoiceNumber', '==', '202600000003').get();
  snapshot.docs.forEach(d => console.log(d.data()));
  process.exit(0);
}
run();
