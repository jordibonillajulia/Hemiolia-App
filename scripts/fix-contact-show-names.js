const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

const mapping = {
  "cavernus": "Cavernus, una evolució musical",
  "cavernus, una evolució musica": "Cavernus, una evolució musical",
  "layla": "Layla, un viatge d'esperança",
  "concert duo": "Concert Duo Hemiòlia",
  "concert trio": "Concert Trio Hemiòlia",
  "concert duo hemiòlia": "Concert Duo Hemiòlia",
  "concert trio hemiòlia": "Concert Trio Hemiòlia",
  "el contacontes, un viatge d'esperança": "Layla, el contacontes",
  "layla, el contacontes, un viatge d'esperança": "Layla, el contacontes",
  "el contacontes": "Layla, el contacontes",
  "un viatge d'esperança": "Layla, un viatge d'esperança",
  "un viatge d’esperança": "Layla, un viatge d'esperança"
};

async function migrate() {
  const snapshot = await db.collection('contacts').get();
  let updatedCount = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    const interestedShows = data.interestedShows || [];
    const performedShows = data.performedShows || [];
    
    const normalizedInterestedSet = new Set();
    let interestedChanged = false;
    for (const show of interestedShows) {
      const parts = show.includes(' i ') ? show.split(' i ') : (show.includes(' y ') ? show.split(' y ') : [show]);
      for (const part of parts) {
        const clean = part.trim().toLowerCase();
        if (!clean) continue;
        let target = part.trim();
        if (mapping[clean]) {
          target = mapping[clean];
          interestedChanged = true;
        } else if (clean !== part.trim().toLowerCase()) {
          interestedChanged = true;
        }
        if (normalizedInterestedSet.has(target)) {
          interestedChanged = true;
        } else {
          normalizedInterestedSet.add(target);
        }
      }
    }

    const normalizedPerformedSet = new Set();
    let performedChanged = false;
    for (const show of performedShows) {
      const parts = show.includes(' i ') ? show.split(' i ') : (show.includes(' y ') ? show.split(' y ') : [show]);
      for (const part of parts) {
        const clean = part.trim().toLowerCase();
        if (!clean) continue;
        let target = part.trim();
        if (mapping[clean]) {
          target = mapping[clean];
          performedChanged = true;
        } else if (clean !== part.trim().toLowerCase()) {
          performedChanged = true;
        }
        if (normalizedPerformedSet.has(target)) {
          performedChanged = true;
        } else {
          normalizedPerformedSet.add(target);
        }
      }
    }

    if (interestedChanged || performedChanged) {
      const newInterested = Array.from(normalizedInterestedSet);
      const newPerformed = Array.from(normalizedPerformedSet);
      
      console.log(`Updating ${document.id} (${data.entity || 'Unknown'} - ${data.municipality || ''}):`);
      console.log(`  Interested: [${interestedShows.join(', ')}] -> [${newInterested.join(', ')}]`);
      console.log(`  Performed: [${performedShows.join(', ')}] -> [${newPerformed.join(', ')}]`);
      
      await db.collection('contacts').doc(document.id).update({
        interestedShows: newInterested,
        performedShows: newPerformed
      });
      updatedCount++;
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} contacts.`);
  process.exit(0);
}

migrate().catch(console.error);
