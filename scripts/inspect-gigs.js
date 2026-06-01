const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const ids = ["PcGbU5YYhqsBbHP0rDP1", "d3BfdjB5dxjWjjTkAAYW"];
  for (const id of ids) {
    const doc = await db.collection('gigs').doc(id).get();
    if (doc.exists) {
      console.log(`Gig: ${id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log(`Gig not found: ${id}`);
    }
  }
  process.exit(0);
}

main().catch(console.error);
