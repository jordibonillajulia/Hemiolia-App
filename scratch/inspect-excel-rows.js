const ExcelJS = require('exceljs');
const fs = require('fs');

const EXCEL_PATH = '/Users/hemiolia/Documents/ANTIGRAVITY/CREACIÓ EXCEL ENTREVISTES/entrevistes_hemiolia.xlsx';
const targets = ["Alfara", "Sant Cugat del Vallès", "Benicarló", "l'Estany", "Tarragona", "Roquetes", "Móra la Nova", "Salou", "la Riba", "la Garriga", "Castellvell del Camp", "Paüls", "Móra d’Ebre", "El Perelló", "Tortosa"];

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error("Excel file does not exist!");
    process.exit(1);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const worksheet = workbook.getWorksheet('Municipis i Contactes');
  if (!worksheet) {
    console.error("Worksheet not found!");
    process.exit(1);
  }

  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const municipality = String(row.getCell(2).value || '');
    
    const matched = targets.some(t => municipality.toLowerCase().includes(t.toLowerCase()));
    if (matched) {
      console.log(`\nRow ${r}: Municipality = ${municipality}`);
      for (let i = 0; i < 3; i++) {
        const colBase = 8 + i * 4;
        const name = row.getCell(colBase).value;
        const role = row.getCell(colBase + 1).value;
        const email = row.getCell(colBase + 2).value;
        const phone = row.getCell(colBase + 3).value;
        if (name || email) {
          console.log(`  Contact ${i+1}: Name = ${JSON.stringify(name)}, Role = ${JSON.stringify(role)}, Email = ${JSON.stringify(email)}, Phone = ${JSON.stringify(phone)}`);
        }
      }
    }
  }
  process.exit(0);
}

main().catch(console.error);
