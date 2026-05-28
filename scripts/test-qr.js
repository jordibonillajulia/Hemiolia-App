const fs = require('fs');
const path = require('path');
const dotenvLocalPath = path.join(__dirname, '.env.local');
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
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snapshot = await getDocs(collection(db, 'invoices'));
  const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const targetIds = ['PM-2026-001', 'PM-2026-002', 'PM-2026-003', 'JB-2026-001'];
  const targets = invoices.filter(inv => targetIds.includes(inv.invoiceNumber));
  
  console.log("=== CALCULATING QR URLS ===");
  for (const invoice of targets) {
    const qrDate = invoice.date ? (() => {
      // Split YYYY-MM-DD to avoid timezone shifts
      const parts = invoice.date.split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      const d = new Date(invoice.date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    })() : '';
    
    const qrAmount = invoice.totals 
      ? (parseFloat(invoice.totals.baseImposable || 0) + parseFloat(invoice.totals.totalIva || 0)).toFixed(2) 
      : '0.00';
    
    const issuerNif = invoice.issuerData?.nif || '';
    const invoiceNum = invoice.invoiceNumber || '';
    
    const isProduction = invoice.verifactuEnv === 'production' || invoice.verifactuId === 'AEAT-APP';
    const qrBaseUrl = isProduction 
      ? 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR' 
      : 'https://www5.aeat.es/wlpl/YECB-VFA1/Verifica';
    const numParam = isProduction ? 'numserie' : 'numfact';
    const qrUrl = `${qrBaseUrl}?nif=${issuerNif}&${numParam}=${encodeURIComponent(invoiceNum)}&fecha=${qrDate}&importe=${qrAmount}`;
    
    console.log(`\nInvoice: ${invoiceNum}`);
    console.log(`  Issuer NIF: ${issuerNif}`);
    console.log(`  Date (qrDate): ${qrDate} (original: ${invoice.date})`);
    console.log(`  Amount (qrAmount): ${qrAmount} (Base: ${invoice.totals?.baseImposable}, IVA: ${invoice.totals?.totalIva})`);
    console.log(`  QR URL: ${qrUrl}`);
  }
}

run().catch(console.error);
