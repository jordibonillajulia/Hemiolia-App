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
  let grandTotal = 0;

  for (const col of collections) {
    const snapshot = await col.get();
    console.log(`Scanning collection "${col.id}" (${snapshot.size} docs)...`);
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      function checkValue(val, path) {
        if (val === null || val === undefined) return;
        
        if (typeof val === 'string') {
          if (val.includes('[object')) {
            console.log(`  [${col.id}] Doc ${doc.id}: field "${path}" = "${val}"`);
            grandTotal++;
          }
        } else if (Array.isArray(val)) {
          val.forEach((item, idx) => {
            checkValue(item, `${path}[${idx}]`);
          });
        } else if (typeof val === 'object') {
          if (val.constructor && val.constructor.name === 'Timestamp') return;
          Object.keys(val).forEach(key => {
            checkValue(val[key], `${path}.${key}`);
          });
        }
      }

      Object.keys(data).forEach(key => {
        checkValue(data[key], key);
      });
    });
  }

  console.log(`Grand total of corrupted fields in all collections: ${grandTotal}`);
  process.exit(0);
}

main().catch(console.error);
