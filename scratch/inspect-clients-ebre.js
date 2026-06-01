const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const collections = await db.listCollections();
  console.log("Collections found:", collections.map(c => c.id).join(', '));
  
  for (const col of collections) {
    const snapshot = await col.get();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const dataStr = JSON.stringify(data).toLowerCase();
      if (dataStr.includes('cantaires') || dataStr.includes('ebre')) {
        console.log(`[Collection: ${col.id}] Found doc: ${doc.id}`);
        console.log(JSON.stringify(data, null, 2));
      }
    });
  }
  process.exit(0);
}

main().catch(console.error);
