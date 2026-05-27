const fs = require('fs');
const dotenvLocalPath = './.env.local';
if (fs.existsSync(dotenvLocalPath)) {
  const envConfig = fs.readFileSync(dotenvLocalPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && !key.startsWith('#')) {
        process.env[key] = val;
      }
    }
  }
}

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log('Iniciant migració de números de factura...');
  const snapshot = await getDocs(collection(db, 'invoices'));
  
  let migratedCount = 0;
  
  for (const document of snapshot.docs) {
    const data = document.data();
    const oldNum = data.invoiceNumber;
    
    if (!oldNum) continue;
    
    // Matxar format antic: prefix-any-seq (ex: PM-2026-001 o JB-2026-02)
    const match = oldNum.match(/^([A-Za-z]+)-(\d{4})-(\d+)$/);
    
    if (match) {
      const prefix = match[1];
      const year = match[2];
      const seqStr = match[3];
      
      const seqNum = parseInt(seqStr, 10);
      const paddedSeq = String(seqNum).padStart(8, '0');
      const newNum = `${year}${paddedSeq}`;
      
      console.log(`Document ID: ${document.id} | Emissor: ${prefix} | Format antic: ${oldNum} -> Format nou: ${newNum}`);
      
      // Actualitzar a Firestore
      const docRef = doc(db, 'invoices', document.id);
      await updateDoc(docRef, { invoiceNumber: newNum });
      migratedCount++;
    } else {
      console.log(`Document ID: ${document.id} | Número de factura '${oldNum}' ja té el format correcte o no és compatible.`);
    }
  }
  
  console.log(`Migració completada! S'han actualitzat ${migratedCount} factures.`);
}

run().catch(console.error);
