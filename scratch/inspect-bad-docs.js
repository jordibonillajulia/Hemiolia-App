const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

const ids = [
  "4PI2Rk2M9TAznasXdkPd",
  "4PeSBGFTNPLw5TZK79ET",
  "9K812nBMBJq8hQbQjD4l",
  "Dn9dp4meDHm8NUXoNkO9",
  "JgkTFQS5FfXwngyH4Lpa",
  "Kk47YtlRZSo0IFsXgH37",
  "KxRsfnJ2PCEaewRO1raL",
  "P3nuAZa0cu5zEODYOK1m",
  "PCYTZZLD0fltlsWYLUYB",
  "aj6SRxfc5d58IeNmByKi",
  "eJ7eoOZIimkNbCUfILuD",
  "ezIWKDYxBmdjFw8J6IDF",
  "uCzwnBMsHVcwhPwzTjwO",
  "x3hNRFPRaCuqoxrBEEZW"
];

async function main() {
  for (const id of ids) {
    const doc = await db.collection('contacts').doc(id).get();
    if (doc.exists) {
      const d = doc.data();
      console.log(`\nDoc ID: ${id} (${d.entity} - ${d.municipality}):`);
      console.log(`  contact1: name=${d.contact1?.name || ''}, role=${d.contact1?.role || ''}, email=${d.contact1?.email || ''}`);
      console.log(`  contact2: name=${d.contact2?.name || ''}, role=${d.contact2?.role || ''}, email=${d.contact2?.email || ''}`);
      console.log(`  contact3: name=${d.contact3?.name || ''}, role=${d.contact3?.role || ''}, email=${d.contact3?.email || ''}`);
      console.log(`  contact4: name=${d.contact4?.name || ''}, role=${d.contact4?.role || ''}, email=${d.contact4?.email || ''}`);
    }
  }
  process.exit(0);
}

main().catch(console.error);
