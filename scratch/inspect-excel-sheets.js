const ExcelJS = require('exceljs');
const fs = require('fs');

const EXCEL_PATH = '/Users/hemiolia/Desktop/entrevistes_hemiolia_ajustat.xlsx';

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error("Excel file does not exist!");
    process.exit(1);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  
  console.log("Worksheets found:", workbook.worksheets.map(w => w.name));
  
  workbook.worksheets.forEach(worksheet => {
    worksheet.eachRow((row, rowNum) => {
      row.eachCell((cell, colNum) => {
        const val = cell.value;
        if (val && String(val).toLowerCase().includes('lanza')) {
          console.log(`Match in Sheet: "${worksheet.name}", Row ${rowNum}, Col ${colNum}:`, JSON.stringify(val));
          console.log("Row values:", row.values);
        }
      });
    });
  });
  process.exit(0);
}

main().catch(console.error);
