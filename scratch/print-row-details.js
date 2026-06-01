const ExcelJS = require('exceljs');
const fs = require('fs');

const EXCEL_PATH = '/Users/hemiolia/Documents/ANTIGRAVITY/CREACIÓ EXCEL ENTREVISTES/entrevistes_hemiolia.xlsx';

async function main() {
  const rowNum = parseInt(process.argv[2], 10);
  if (isNaN(rowNum)) {
    console.error("Please provide row number.");
    process.exit(1);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const worksheet = workbook.getWorksheet('Municipis i Contactes');
  const row = worksheet.getRow(rowNum);
  
  for (let c = 1; c <= row.cellCount; c++) {
    const val = row.getCell(c).value;
    if (val) {
      console.log(`Col ${c}: ${JSON.stringify(val)}`);
    }
  }
  process.exit(0);
}

main().catch(console.error);
