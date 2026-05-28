require('dotenv').config({ path: '.env.local' });
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

const showTranslations = {
  "layla, un viatge d'esperança": {
    ca: "Layla, un viatge d'esperança",
    es: "Layla, un viaje de esperanza",
    en: "Layla, a Journey of Hope"
  },
  "layla, un viatge d’esperança": {
    ca: "Layla, un viatge d'esperança",
    es: "Layla, un viaje de esperanza",
    en: "Layla, a Journey of Hope"
  },
  "layla, el contacontes": {
    ca: "Layla, el contacontes",
    es: "Layla, el cuentacuentos",
    en: "Layla, the Storyteller"
  },
  "cavernus, una evolució musical": {
    ca: "Cavernus, una evolució musical",
    es: "Cavernus, una evolución musical",
    en: "Cavernus, a Musical Evolution"
  },
  "un nadal màgic": {
    ca: "Un Nadal Màgic",
    es: "Una Navidad Mágica",
    en: "A Magical Christmas"
  },
  "silencis trencats": {
    ca: "Silencis trencats",
    es: "Silencios rotos",
    en: "Broken silences"
  }
};

async function run() {
  const snapshot = await getDocs(collection(db, 'gigs'));
  const todayStr = new Date().toISOString().split('T')[0];
  
  const mappedGigs = snapshot.docs.map(docDoc => {
    const data = docDoc.data();
    const rawDate = data.date || "";
    const showTime = data.showTime || "";
    const rawTitle = data.title || "";
    const locationName = data.locationName || "";
    const municipality = data.municipality || "";
    const status = data.status || "";

    let formattedDate = "a determinar";
    let timeVal = null;
    let yearVal = "upcoming";
    let typeVal = "upcoming";

    if (rawDate && rawDate !== "a determinar") {
      const parts = rawDate.split('-');
      if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        formattedDate = `${dd}/${mm}/${yyyy}`;
        
        if (rawDate >= todayStr) {
          typeVal = "upcoming";
          yearVal = "upcoming";
          if (showTime) {
            timeVal = `${showTime}h`;
          }
        } else {
          typeVal = rawTitle.toLowerCase().includes("estrena") ? "estrena" : "realitzat";
          const yearNum = parseInt(yyyy, 10);
          if (yearNum <= 2019) {
            yearVal = "old";
          } else {
            yearVal = yyyy;
          }
        }
      }
    }

    const cleanTitle = rawTitle.trim().toLowerCase();
    let showObj = { ca: rawTitle, es: rawTitle, en: rawTitle };
    
    let matched = false;
    for (const [key, trans] of Object.entries(showTranslations)) {
      if (cleanTitle.includes(key) || key.includes(cleanTitle)) {
        showObj = trans;
        matched = true;
        break;
      }
    }

    let formattedLocation = "";
    if (municipality && locationName) {
      formattedLocation = `${municipality} (${locationName})`;
    } else {
      formattedLocation = municipality || locationName || "";
    }

    return {
      id: docDoc.id,
      date: formattedDate,
      time: timeVal,
      rawDate: rawDate,
      show: showObj,
      location: formattedLocation,
      type: typeVal,
      year: yearVal
    };
  });

  // Log the first 5 and last 5 gigs
  console.log('Total mapped gigs:', mappedGigs.length);
  console.log('Sample mapped gigs (first 3):', JSON.stringify(mappedGigs.slice(0, 3), null, 2));
  
  // Log count per type and year
  const counts = {};
  mappedGigs.forEach(g => {
    counts[g.type] = (counts[g.type] || 0) + 1;
    counts[g.year] = (counts[g.year] || 0) + 1;
  });
  console.log('Counts:', counts);
}

run().catch(console.error);
