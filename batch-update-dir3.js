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

const dir3Map = {
  "P4300400A": "L01430043", // Alcanar
  "P4301400J": "L01430141", // Amposta
  "P4301900I": "L01430192", // Ascó
  "P4315800E": "L01431567", // Ulldecona
  "P4404900E": "L01440491", // Calaceit
  "P4310800J": "L01431068", // El Pinell de Brai
  "P0808800G": "L01080898", // Gavà
  "P2502800B": "L01251403", // Montferrer
  "P2518000A": "L01251431", // Montornes de Segarra
  "P1712500F": "L01171181", // Palamós
  "P4310400I": "L01431021", // Paüls
  "P0816000D": "L01081614", // Piera
  "P4313500C": "L01431331", // Roquetes
  "P0822500E": "L01082188", // Sant Joan de Vilatorrada
  "P4315000B": "L01431484", // Tarragona / Escola de Música
  "P4315500A": "L01431536", // Torredembarra
  "P0830300J": "L01083020", // Vilanova del Camí
  "P4301300B": "L01430136", // l'Ametlla de Mar
  "P430500D":  "L01430445", // la Sénia (NIF entered by user was P430500D)
  "P4304400E": "L01430445"  // la Sénia alternative if NIF is actually P4304400E
};

async function run() {
  const snapshot = await getDocs(collection(db, 'clients_billing'));
  let count = 0;
  for (const clientDoc of snapshot.docs) {
    const data = clientDoc.data();
    if (data.nif && dir3Map[data.nif]) {
      const dir3Code = dir3Map[data.nif];
      await updateDoc(doc(db, 'clients_billing', clientDoc.id), {
        dir3OficinaContable: dir3Code,
        dir3OrganoGestor: dir3Code,
        dir3UnidadTramitadora: dir3Code
      });
      console.log(`Updated ${data.name} (${data.nif}) with DIR3: ${dir3Code}`);
      count++;
    }
  }
  console.log(`Updated ${count} clients.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
