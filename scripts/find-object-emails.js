const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('contacts').get();
  let count = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const emailsToCheck = [
      { path: 'email', value: data.email },
      { path: 'contact1.email', value: data.contact1?.email },
      { path: 'contact2.email', value: data.contact2?.email },
      { path: 'contact3.email', value: data.contact3?.email },
      { path: 'contact4.email', value: data.contact4?.email }
    ];
    
    let hasBad = false;
    emailsToCheck.forEach(item => {
      if (item.value && (String(item.value).includes('[object') || typeof item.value === 'object')) {
        console.log(`Bad email in ${doc.id} (${data.entity || ''} - ${data.municipality || ''}): ${item.path} = ${JSON.stringify(item.value)}`);
        hasBad = true;
      }
    });
    if (hasBad) count++;
  });
  
  console.log(`Total contacts with bad emails: ${count}`);
  process.exit(0);
}

main().catch(console.error);
