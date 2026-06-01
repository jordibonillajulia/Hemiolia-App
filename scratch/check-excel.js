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
  if (!worksheet) {
    console.error("Worksheet not found!");
    process.exit(1);
  }

  console.log(`Worksheet rows: ${worksheet.rowCount}`);
  
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const municipality = row.getCell(2).value;
    const entity = row.getCell(1).value || ''; // Wait, cell 1? Or is it not entity? Let's check row.getCell(1).value
    
    // Check contact 1 (col 10 = J), contact 2 (col 14 = N), contact 3 (col 18 = R)
    const emailCols = [10, 14, 18];
    emailCols.forEach((colIdx, index) => {
      const cell = row.getCell(colIdx);
      const val = cell.value;
      if (val && typeof val === 'object') {
        console.log(`Row ${r} (${municipality}): Contact ${index + 1} email is object:`, JSON.stringify(val));
      }
    });
  }
  process.exit(0);
}

main().catch(console.error);
