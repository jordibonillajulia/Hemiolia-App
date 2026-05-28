const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

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
  const newInvoice = {
    clientName: "Cantaires de l'Ebre",
    clientNif: "G43014620",
    clientNifType: "NIF",
    clientCountryCode: "ES",
    clientId: "fncU3qkW5y2yJnoxpXJ5",
    clientData: {
      name: "Cantaires de l'Ebre",
      nif: "G43014620",
      postalCode: "43500",
      province: "Tarragona",
      type: "Jurídica",
      id: "fncU3qkW5y2yJnoxpXJ5",
      address: "Plaça Sant Joan, 3",
      municipality: "Tortosa",
      country: "Espanya"
    },
    date: "2026-05-25",
    invoiceNumber: "202600000005",
    issuerId: "JB",
    issuerData: {
      address: "Avinguda Catalunya, 87 (5-A)",
      municipality: "Tortosa",
      phone: "639966697",
      province: "Tarragona",
      id: "JB",
      iban: "ES60 1491 0001 2420 6282 2024",
      email: "jordibonillajulia@gmail.com",
      website: "www.hemiolia.cat",
      bankName: "TRIODOS BANK",
      postalCode: "43500",
      nif: "40936132L",
      name: "Jordi Bonilla Julià"
    },
    lines: [
      {
        amount: "1000.00",
        vatPercent: "10",
        type: "product",
        description: "Assaig i Concert de primavera",
        exemptionCause: "",
        isVatExempt: false,
        id: "1779379175784"
      }
    ],
    totals: {
      baseImposable: 1000,
      totalIva: 100,
      totalIrpf: 150,
      total: 950
    },
    irpfPercent: 15,
    status: "Pendent",
    submissionMethod: "verifactu",
    createdAt: new Date().toISOString()
  };

  const docRef = await addDoc(collection(db, 'invoices'), newInvoice);
  console.log('Successfully created test invoice 202600000005 with ID:', docRef.id);
}

run().catch(console.error);
