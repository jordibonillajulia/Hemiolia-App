/**
 * auto-mood.mjs
 * Script que llegeix tots els contactes amb "Entrevista feta" i sense mood,
 * aplica la detecció automàtica (basada en notes i feedbackSummary) i
 * actualitza Firestore només quan la detecció és clara.
 * 
 * Execució: node scripts/auto-mood.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const admin = require('firebase-admin');
const serviceAccount = require('/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/certs/google-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// ─── Mateixa lògica que la pàgina ─────────────────────────────────────────────

const MOODS = [
  { key: 'molt_be',  emoji: '😁', label: 'Ha anat molt bé' },
  { key: 'be',       emoji: '🙂', label: 'Ha anat bé' },
  { key: 'neutral',  emoji: '😐', label: 'Ni fu ni fa' },
  { key: 'malament', emoji: '😞', label: 'No ha agradat' },
];

const detectMoodFromNotes = (notes, feedbackSummary) => {
  if (!notes && !feedbackSummary) return null;
  const text = ((notes || '') + ' ' + (feedbackSummary || '')).toLowerCase();

  const veryGoodKw = ['molt bé', 'molt be', 'excel·lent', 'excel.lent', 'fantàstic', 'fantastic', 'molt interessat', 'molt interessada', 'entusiasta', 'genial', 'perfecte', 'molt positiu', 'encantats', 'encantat', 'encantada', 'molt favorable', 'molt content', 'molt contenta', 'molt entusiasta'];
  const badKw     = ['no interessa', 'no li interessa', 'no els interessa', 'malament', 'negatiu', 'negativa', 'impossible', 'no pot', 'no vol', 'rebutja', 'rebutjat', 'difícil de convèncer', 'molest', 'molesta', 'enfadat', 'enfadada', 'no ho veu', 'no els va', 'fora de pressupost', 'no els agrada'];
  const goodKw    = ['bé', 'interessat', 'interessada', 'positiu', 'positiva', 'favorable', 'obert', 'oberta', 'disposat', 'disposada', 'considera', 'podria', 'content', 'contenta', 'ha agradat'];
  const neutralKw = ['potser', 'possiblement', 'a veure', 'no sap', 'pendent', 'dubte', 'dubtes', 'pensarà', 'consultarà', 'ho mirarà', 'ho consultarà', 'sense confirmar'];

  if (veryGoodKw.some(kw => text.includes(kw))) return 'molt_be';
  if (badKw.some(kw => text.includes(kw)))      return 'malament';
  if (goodKw.some(kw => text.includes(kw)))     return 'be';
  if (neutralKw.some(kw => text.includes(kw)))  return 'neutral';
  return null;
};

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Llegint contactes amb "Entrevista feta"...\n');

  const snapshot = await db.collection('contacts').get();
  const contacts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  const entrevistades = contacts.filter(c => c.status === 'Entrevista feta');
  
  console.log(`📋 Total amb "Entrevista feta": ${entrevistades.length}`);
  
  const ambMood = entrevistades.filter(c => c.mood && c.mood !== '');
  const senseMood = entrevistades.filter(c => !c.mood || c.mood === '');
  
  console.log(`✅ Ja tenien careta: ${ambMood.length}`);
  console.log(`❓ Sense careta: ${senseMood.length}\n`);

  if (senseMood.length === 0) {
    console.log('✨ Tots els contactes amb entrevista feta ja tenen careta assignada.');
    process.exit(0);
  }

  console.log('── Processant contactes sense careta ──────────────────────────────\n');

  const resultats = {
    actualitzats: [],
    noClars: [],
  };

  for (const c of senseMood) {
    const detected = detectMoodFromNotes(c.notes, c.feedbackSummary);
    
    if (detected) {
      const moodInfo = MOODS.find(m => m.key === detected);
      console.log(`${moodInfo.emoji}  ${c.name} (${c.municipality}) → ${moodInfo.label}`);
      if (c.feedbackSummary) {
        console.log(`   💬 Feedback: "${c.feedbackSummary.substring(0, 100)}${c.feedbackSummary.length > 100 ? '...' : ''}"`);
      }
      if (c.notes && !c.feedbackSummary) {
        console.log(`   📝 Notes: "${c.notes.substring(0, 100)}${c.notes.length > 100 ? '...' : ''}"`);
      }
      
      // Actualitzar a Firestore
      await db.collection('contacts').doc(c.id).update({ mood: detected });
      
      resultats.actualitzats.push({ name: c.name, municipality: c.municipality, mood: detected, emoji: moodInfo.emoji, label: moodInfo.label });
    } else {
      console.log(`⚪  ${c.name} (${c.municipality}) → no clar, s'ignora`);
      if (c.feedbackSummary) {
        console.log(`   💬 "${c.feedbackSummary.substring(0, 100)}${c.feedbackSummary.length > 100 ? '...' : ''}"`);
      }
      if (c.notes) {
        console.log(`   📝 "${c.notes.substring(0, 100)}${c.notes.length > 100 ? '...' : ''}"`);
      }
      resultats.noClars.push({ name: c.name, municipality: c.municipality });
    }
    console.log('');
  }

  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`\n✅ Actualitzats (${resultats.actualitzats.length}):`);
  resultats.actualitzats.forEach(r => console.log(`   ${r.emoji} ${r.name} (${r.municipality}) — ${r.label}`));
  
  if (resultats.noClars.length > 0) {
    console.log(`\n⚪ No clars, sense modificar (${resultats.noClars.length}):`);
    resultats.noClars.forEach(r => console.log(`   • ${r.name} (${r.municipality})`));
    console.log('\n   → Pots assignar-los manualment des de la fitxa del CRM.');
  }
  
  console.log('\n✨ Fet!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
