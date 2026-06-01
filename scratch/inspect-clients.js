const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('clients_billing').get();
  console.log(`Scanning ${snapshot.size} clients_billing for bad fields...`);
  
  let totalBadFields = 0;

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    
    // Check all fields recursively
    function checkValue(val, path) {
      if (val === null || val === undefined) return;
      
      if (typeof val === 'string') {
        if (val.includes('[object')) {
          console.log(`Corrupted string in client ${doc.id} (${data.name || ''}): field "${path}" = "${val}"`);
          totalBadFields++;
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

  console.log(`Total corrupted fields found in clients_billing: ${totalBadFields}`);
  process.exit(0);
}

main().catch(console.error);
