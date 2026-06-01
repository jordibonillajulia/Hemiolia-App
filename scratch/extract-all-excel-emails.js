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
  const worksheet = workbook.getWorksheet('Municipis i Contactes');
  
  console.log(`Scanning worksheet rows: ${worksheet.rowCount}`);
  
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const municipality = row.getCell(3).value || row.getCell(2).value || '';
    
    // Email columns in the format:
    // Contact 1 Email is Col 12 (L), Contact 2 Email is Col 16 (P), etc.?
    // Let's print out the structure based on Tarragona Row 107:
    // Row values array had:
    // [empty, 106 (Col 1), 'Ajuntament' (Col 2), 'Tarragona' (Col 3), 'Tarragona' (Col 4), 'Instància feta' (Col 5), 'Cavernus' (Col 6), empty (Col 7), empty (Col 8), 'NO VEIG COM' (Col 9), 'Alexis Lanza' (Col 10), 'Director Escola de Música' (Col 11), {text, hyperlink} (Col 12), 661631041 (Col 13)]
    // Let's verify the columns:
    // Col 10: Contact 1 Name
    // Col 11: Contact 1 Role
    // Col 12: Contact 1 Email
    // Col 13: Contact 1 Phone
    // Col 14: Contact 2 Name
    // Col 15: Contact 2 Role
    // Col 16: Contact 2 Email
    // Col 17: Contact 2 Phone
    // Col 18: Contact 3 Name
    // Col 19: Contact 3 Role
    // Col 20: Contact 3 Email
    // Col 21: Contact 3 Phone
    
    const emailCols = [12, 16, 20, 24]; // Let's check 12, 16, 20, 24
    emailCols.forEach((colIdx, index) => {
      const cell = row.getCell(colIdx);
      const val = cell.value;
      if (val) {
        if (typeof val === 'object') {
          console.log(`Row ${r} (${municipality}): Contact ${index + 1} Email is Object: ${JSON.stringify(val)}`);
        } else if (String(val).includes('[object')) {
          console.log(`Row ${r} (${municipality}): Contact ${index + 1} Email is literal object string: ${val}`);
        }
      }
    });
  }
  process.exit(0);
}

main().catch(console.error);
