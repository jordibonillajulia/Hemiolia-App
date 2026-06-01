const ExcelJS = require('exceljs');
const fs = require('fs');

const EXCEL_PATH_1 = '/Users/hemiolia/Documents/ANTIGRAVITY/CREACIÓ EXCEL ENTREVISTES/entrevistes_hemiolia.xlsx';
const EXCEL_PATH_2 = '/Users/hemiolia/Desktop/entrevistes_hemiolia_ajustat.xlsx';

async function checkFile(path) {
  if (!fs.existsSync(path)) {
    console.log(`File not found: ${path}`);
    return;
  }
  console.log(`Checking ${path}...`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const worksheet = workbook.getWorksheet('Municipis i Contactes');
  if (!worksheet) {
    console.log(`Worksheet 'Municipis i Contactes' not found in ${path}`);
    return;
  }

  let count = 0;
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const municipality = row.getCell(2).value;
    const emailCols = [10, 14, 18];
    emailCols.forEach((colIdx, index) => {
      const cell = row.getCell(colIdx);
      const val = cell.value;
      if (val && typeof val === 'object') {
        console.log(`Row ${r} (${municipality}): Contact ${index + 1} email is object:`, JSON.stringify(val));
        count++;
      }
    });
  }
  console.log(`Total objects in ${path}: ${count}\n`);
}

async function main() {
  await checkFile(EXCEL_PATH_1);
  await checkFile(EXCEL_PATH_2);
  process.exit(0);
}

main().catch(console.error);
