const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// Config paths
const EXCEL_PATH = '/Users/hemiolia/Documents/ANTIGRAVITY/CREACIÓ EXCEL ENTREVISTES/entrevistes_hemiolia.xlsx';
const CREDENTIALS_PATH = path.join(process.env.HOME, '.config/configstore/firebase-tools.json');

const toFirestoreValue = (val) => {
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(v => ({ stringValue: String(v) }))
      }
    };
  }
  return { stringValue: String(val || '') };
};

async function main() {
  console.log("=================================================");
  console.log("    IMPORTING HEMIOLIA EXCEL DATA TO FIRESTORE   ");
  console.log("=================================================");

  // 1. Load Firebase CLI Access Token
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("❌ Firebase CLI credentials file not found! Run 'firebase login' first.");
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const accessToken = config.tokens?.access_token;
  if (!accessToken) {
    console.error("❌ No access token found in firebase-tools.json!");
    process.exit(1);
  }

  // 2. Load Excel File
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ Excel file not found at: ${EXCEL_PATH}`);
    process.exit(1);
  }

  console.log("Reading Excel file...");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  
  const worksheet = workbook.getWorksheet('Municipis i Contactes');
  if (!worksheet) {
    console.error("❌ Worksheet 'Municipis i Contactes' not found in Excel!");
    process.exit(1);
  }

  console.log(`✅ Loaded worksheet. Total rows: ${worksheet.rowCount}`);

  const url = 'https://firestore.googleapis.com/v1/projects/hemiolia-app/databases/(default)/documents/contacts';
  
  let successCount = 0;
  let errorCount = 0;
  let skippedRows = 0;

  // 3. Loop over rows (skipping header at row 1)
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    
    // Check if row is empty
    if (!row.getCell(2).value) {
      skippedRows++;
      continue;
    }

    const municipality = String(row.getCell(2).value || '').trim();
    const province = String(row.getCell(3).value || '').trim();
    const status = String(row.getCell(4).value || 'Pendent').trim();
    const performedShowsRaw = String(row.getCell(5).value || '').trim();
    const interestedShowsRaw = String(row.getCell(6).value || '').trim();
    const feedbackSummary = String(row.getCell(7).value || '').trim();
    const notes = String(row.getCell(20).value || '').trim();

    const performedShows = performedShowsRaw ? performedShowsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const interestedShows = interestedShowsRaw ? interestedShowsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Parse up to 3 contacts
    const contacts = [];
    for (let i = 0; i < 3; i++) {
      const colBase = 8 + i * 4;
      const cName = String(row.getCell(colBase).value || '').trim();
      const cRole = String(row.getCell(colBase + 1).value || '').trim();
      const cEmail = String(row.getCell(colBase + 2).value || '').trim();
      const cPhone = String(row.getCell(colBase + 3).value || '').trim();

      if (cName || cEmail) {
        contacts.push({
          name: cName,
          role: cRole,
          email: cEmail,
          phone: cPhone
        });
      }
    }

    // Fallback placeholder if no contacts listed
    if (contacts.length === 0 && municipality) {
      contacts.push({
        name: `Ajuntament de ${municipality}`,
        role: 'General',
        email: '',
        phone: ''
      });
    }

    // 4. Send contacts to Firestore REST API
    for (const contact of contacts) {
      const payload = {
        fields: {
          name: toFirestoreValue(contact.name),
          entity: toFirestoreValue(contact.role || 'Ajuntament'),
          municipality: toFirestoreValue(municipality),
          province: toFirestoreValue(province),
          email: toFirestoreValue(contact.email),
          phone: toFirestoreValue(contact.phone),
          status: toFirestoreValue(status),
          performedShows: toFirestoreValue(performedShows),
          interestedShows: toFirestoreValue(interestedShows),
          feedbackSummary: toFirestoreValue(feedbackSummary),
          notes: toFirestoreValue(notes),
          nextActionDate: toFirestoreValue(''),
          nextActionNotes: toFirestoreValue(''),
          createdAt: toFirestoreValue(new Date().toISOString())
        }
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
          successCount++;
          // Print progress every 50 records
          if (successCount % 50 === 0) {
            console.log(`Progress: Imported ${successCount} contacts...`);
          }
        } else {
          console.error(`❌ Error importing ${contact.name} in ${municipality}:`, data.error || data);
          errorCount++;
        }
      } catch (err) {
        console.error(`❌ Network error importing ${contact.name}:`, err.message);
        errorCount++;
      }
    }
  }

  console.log("\n=================================================");
  console.log("               IMPORT COMPLETED                  ");
  console.log("=================================================");
  console.log(`✅ Success: Imported ${successCount} contacts.`);
  console.log(`❌ Errors: ${errorCount} failures.`);
  console.log(`ℹ️ Skipped rows: ${skippedRows} empty rows.`);
  console.log("=================================================");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
