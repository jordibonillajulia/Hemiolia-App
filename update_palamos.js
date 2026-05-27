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
  if (snapshot.empty) {
    console.log('No invoice found for 202600000003');
    process.exit(0);
  }
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`Updating ${data.invoiceNumber} (Client: ${data.clientName})`);
    await doc.ref.update({
      status: 'Enviada',
      verifactuId: 'E-FACT',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Successfully updated!');
  }
}

run().catch(console.error).finally(() => process.exit(0));
