const ExcelJS = require('exceljs');
const fs = require('fs');

const EXCEL_PATH = '/Users/hemiolia/Documents/ANTIGRAVITY/CREACIÓ EXCEL ENTREVISTES/entrevistes_hemiolia.xlsx';

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error("Excel file does not exist!");
    process.exit(1);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const worksheet = workbook.getWorksheet('Municipis i Contactes');
  
  const query = process.argv[2];
  if (!query) {
    console.log("Usage: node search-excel-text.js <query>");
    process.exit(1);
  }

  console.log(`Searching for "${query}" in Excel...`);
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    let match = false;
    for (let c = 1; c <= row.cellCount; c++) {
      const val = row.getCell(c).value;
      if (val && String(val).toLowerCase().includes(query.toLowerCase())) {
        match = true;
      }
    }
    if (match) {
      console.log(`Row ${r}: Municipality = ${row.getCell(2).value}`);
      for (let i = 0; i < 3; i++) {
        const colBase = 8 + i * 4;
        const name = row.getCell(colBase).value;
        const role = row.getCell(colBase + 1).value;
        const email = row.getCell(colBase + 2).value;
        const phone = row.getCell(colBase + 3).value;
        console.log(`  Contact ${i+1}: Name = ${JSON.stringify(name)}, Role = ${JSON.stringify(role)}, Email = ${JSON.stringify(email)}, Phone = ${JSON.stringify(phone)}`);
      }
    }
  }
  process.exit(0);
}

main().catch(console.error);
