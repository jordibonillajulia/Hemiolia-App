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
  process.exit(0);
}

main().catch(console.error);
