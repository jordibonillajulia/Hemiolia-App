import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { adminDb } from '@/lib/firebaseAdmin';
import { formatClientName } from '@/lib/firestoreUtils';
import { verifySessionOrToken } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

// Parse date string YYYY-MM-DD to a timezone-neutral local Date object for ExcelJS using Date.UTC to prevent timezone shift issues
const parseDate = (dStr) => {
  if (!dStr) return null;
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? null : d;
};

const isSpain = (countryCode) => {
  if (!countryCode) return true;
  const code = countryCode.toUpperCase().trim();
  return code === 'ES' || code === 'ESP' || code === 'ESPANYA' || code === 'ESPAÑA' || code === 'SPAIN';
};

const parseNifAndCountry = (nif, defaultCountryCode) => {
  let cleanNif = String(nif || '').toUpperCase().trim();
  let country = defaultCountryCode || 'ES';
  let isSpainNif = isSpain(country);

  if (cleanNif.length >= 9 && /^[A-Z]{2}[A-Z0-9]/.test(cleanNif)) {
    const prefix = cleanNif.substring(0, 2);
    if (prefix === 'ES') {
      cleanNif = cleanNif.substring(2);
      country = 'ES';
      isSpainNif = true;
    } else {
      country = prefix;
      isSpainNif = false;
    }
  }

  return { nif: cleanNif, country, isSpain: isSpainNif };
};

const copyRowStyles = (sheet, sourceRowNum, targetRowNum, maxCols) => {
  const sourceRow = sheet.getRow(sourceRowNum);
  const targetRow = sheet.getRow(targetRowNum);
  
  if (sourceRow.height) {
    targetRow.height = sourceRow.height;
  }
  
  for (let c = 1; c <= maxCols; c++) {
    const sourceCell = sourceRow.getCell(c);
    const targetCell = targetRow.getCell(c);
    if (sourceCell.style) {
      targetCell.style = { ...sourceCell.style };
    }
  }
};

const getQuarterFromDate = (dateStr) => {
  if (!dateStr) return '1T';
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 1 && month <= 3) return '1T';
  if (month >= 4 && month <= 6) return '2T';
  if (month >= 7 && month <= 9) return '3T';
  return '4T';
};

const updateMetadataHeader = (sheet, owner, filterYear) => {
  if (!sheet) return;
  const ownerNif = owner === 'Jordi' ? '40936132L' : '78582484V';
  const ownerName = owner === 'Jordi' ? 'Bonilla Julia, Jordi' : 'Martí Fandos, Paula';
  const yearText = filterYear === 'Tots' ? '2026' : filterYear;

  // 1. Update the original metadata values in their original template cells
  for (const r of [2, 3, 5]) {
    for (let c = 1; c <= 20; c++) {
      const cell = sheet.getRow(r).getCell(c);
      if (cell.value && typeof cell.value === 'string') {
        const val = cell.value.trim();
        if (val.startsWith('Ejercicio:')) {
          cell.value = `Ejercicio: ${yearText}`;
        } else if (val.startsWith('NIF:')) {
          cell.value = `NIF: ${ownerNif}`;
        } else if (val.startsWith('NOMBRE O RAZÓN SOCIAL:')) {
          cell.value = `NOMBRE O RAZÓN SOCIAL: ${ownerName}`;
        }
      }
    }
  }
};

export async function GET(request) {
  // Verify authorization
  const session = await verifySessionOrToken(request, ['admin', 'crm']);
  if (!session) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner') || 'Jordi';
  const filterYear = searchParams.get('year') || '2026';
  const filterPeriod = searchParams.get('period') || 'Tots';

  console.log(`Excel Export API called. Owner: ${owner}, Year: ${filterYear}, Period: ${filterPeriod}`);

  try {
    // 1. Fetch data from Firestore using Admin SDK
    const [issuedSnapshot, receivedSnapshot] = await Promise.all([
      adminDb.collection('ledgers_issued').get(),
      adminDb.collection('ledgers_received').get()
    ]);

    const issued = issuedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const received = receivedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Cumulative period mapping logic:
    const getTargetPeriods = (p) => {
      if (p === '1T') return ['1T'];
      if (p === '2T') return ['1T', '2T'];
      if (p === '3T') return ['1T', '2T', '3T'];
      return ['1T', '2T', '3T', '4T']; // For 4T or Tots
    };

    const targetPeriods = getTargetPeriods(filterPeriod);

    // Filter Issued (Ingressos)
    const filteredIssued = issued.filter(item => {
      const matchOwner = item.owner === owner;
      const matchYear = filterYear === 'Tots' || item.year?.toString() === filterYear;
      const matchPeriod = filterPeriod === 'Tots' || targetPeriods.includes(item.period);
      return matchOwner && matchYear && matchPeriod;
    }).sort((a, b) => {
      const dateCompare = (a.dateExp || '').localeCompare(b.dateExp || '');
      if (dateCompare !== 0) return dateCompare;
      return String(a.invoiceNumber || '').localeCompare(String(b.invoiceNumber || ''), undefined, { numeric: true });
    });

    // Filter Received (Despeses)
    const filteredReceived = received.filter(item => {
      const matchOwner = item.owner === owner;
      const matchYear = filterYear === 'Tots' || item.year?.toString() === filterYear;
      const matchPeriod = filterPeriod === 'Tots' || targetPeriods.includes(item.period);
      return matchOwner && matchYear && matchPeriod;
    }).sort((a, b) => {
      const dateCompare = (a.dateExp || '').localeCompare(b.dateExp || '');
      if (dateCompare !== 0) return dateCompare;
      return String(a.invoiceNumber || '').localeCompare(String(b.invoiceNumber || ''), undefined, { numeric: true });
    });

    // 2. Load the AEAT Excel Template
    const ledgersDir = path.join(process.cwd(), 'data/ledgers');
    if (!fs.existsSync(ledgersDir)) {
      console.error(`Ledgers directory not found: ${ledgersDir}`);
      return NextResponse.json({ error: 'Directori de llibres no trobat.' }, { status: 404 });
    }
    
    const files = fs.readdirSync(ledgersDir);
    const templateFileName = files.find(f => f.startsWith('LLIBRE REGISTRE_MODEL'));
    
    if (!templateFileName) {
      console.error(`Template file starting with LLIBRE REGISTRE_MODEL not found in: ${ledgersDir}`);
      return NextResponse.json({ error: 'Plantilla d\'Excel no trobada.' }, { status: 404 });
    }

    const templatePath = path.join(ledgersDir, templateFileName);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    // Update metadata headers (Ejercicio, NIF, NOMBRE) to match taxpayer
    const sheetIssued = workbook.getWorksheet('EXPEDIDAS_INGRESOS');
    const sheetReceived = workbook.getWorksheet('RECIBIDAS_GASTOS');
    const sheetAssets = workbook.getWorksheet('BIENES-INVERSIÓN');

    updateMetadataHeader(sheetIssued, owner, filterYear);
    updateMetadataHeader(sheetReceived, owner, filterYear);
    updateMetadataHeader(sheetAssets, owner, filterYear);

    if (sheetIssued) {
      // Clear data cells from row 10 to 500 just to be safe
      for (let r = 10; r <= 500; r++) {
        for (let c = 1; c <= 36; c++) {
          sheetIssued.getRow(r).getCell(c).value = null;
        }
      }

      let rowIdx = 10;
      for (const item of filteredIssued) {
        const parsed = parseNifAndCountry(item.clientNif, item.clientCountryCode);
        const clientCountry = parsed.country;
        const clientIsSpain = parsed.isSpain;
        const clientNifClean = parsed.nif;

        if (rowIdx > 10) {
          copyRowStyles(sheetIssued, 10, rowIdx, 36);
        }

        sheetIssued.getCell(`A${rowIdx}`).value = item.year;
        sheetIssued.getCell(`B${rowIdx}`).value = item.period || getQuarterFromDate(item.dateExp);
        sheetIssued.getCell(`C${rowIdx}`).value = item.activityCode || 'A';
        sheetIssued.getCell(`D${rowIdx}`).value = String(item.activityType || '04').padStart(2, '0');
        sheetIssued.getCell(`E${rowIdx}`).value = String(item.activityIae || '032').replace('.', '').trim().padStart(3, '0');
        sheetIssued.getCell(`F${rowIdx}`).value = item.invoiceType || 'F1';
        sheetIssued.getCell(`G${rowIdx}`).value = item.incomeConcept || 'I08';
        
        const cellH = sheetIssued.getCell(`H${rowIdx}`);
        cellH.value = item.incomeAmount || item.base;
        cellH.style = { ...cellH.style, numFmt: '0.00' };

        const dateExpVal = parseDate(item.dateExp);
        if (dateExpVal) {
          const cellI = sheetIssued.getCell(`I${rowIdx}`);
          cellI.value = dateExpVal;
          cellI.style = { ...cellI.style, numFmt: 'dd/mm/yyyy' };
        }

        const dateOpVal = parseDate(item.dateOp || item.dateExp);
        if (dateOpVal) {
          const cellJ = sheetIssued.getCell(`J${rowIdx}`);
          cellJ.value = dateOpVal;
          cellJ.style = { ...cellJ.style, numFmt: 'dd/mm/yyyy' };
        }

        sheetIssued.getCell(`K${rowIdx}`).value = item.invoiceSerie || null;
        sheetIssued.getCell(`L${rowIdx}`).value = String(item.invoiceNumber || '').trim();
        sheetIssued.getCell(`M${rowIdx}`).value = null;
        
        sheetIssued.getCell(`N${rowIdx}`).value = clientIsSpain ? null : String(item.clientNifType || '02').padStart(2, '0');
        sheetIssued.getCell(`O${rowIdx}`).value = clientIsSpain ? null : clientCountry;
        
        sheetIssued.getCell(`P${rowIdx}`).value = clientNifClean;
        sheetIssued.getCell(`Q${rowIdx}`).value = formatClientName(item.clientName);
        sheetIssued.getCell(`R${rowIdx}`).value = String(item.operationKey || '01').padStart(2, '0');
        
        // Calificación de la Operación (Col S) & Operación Exenta (Col T)
        const isExempt = !!item.exemptReason;
        sheetIssued.getCell(`S${rowIdx}`).value = isExempt ? null : (item.operationType || 'S1');
        sheetIssued.getCell(`T${rowIdx}`).value = item.exemptReason || null;

        const cellU = sheetIssued.getCell(`U${rowIdx}`);
        cellU.value = item.total;
        cellU.style = { ...cellU.style, numFmt: '0.00' };

        const cellV = sheetIssued.getCell(`V${rowIdx}`);
        cellV.value = item.base;
        cellV.style = { ...cellV.style, numFmt: '0.00' };
        
        const cellW = sheetIssued.getCell(`W${rowIdx}`);
        cellW.value = item.vatPercent || 0;
        cellW.style = { ...cellW.style, numFmt: '0.00' };

        const cellX = sheetIssued.getCell(`X${rowIdx}`);
        cellX.value = item.vatQuota || 0;
        cellX.style = { ...cellX.style, numFmt: '0.00' };

        sheetIssued.getCell(`Y${rowIdx}`).value = null;
        sheetIssued.getCell(`Z${rowIdx}`).value = null;

        const cellAE = sheetIssued.getCell(`AE${rowIdx}`);
        cellAE.value = item.irpfPercent || 0;
        cellAE.style = { ...cellAE.style, numFmt: '0.00' };

        const cellAF = sheetIssued.getCell(`AF${rowIdx}`);
        cellAF.value = item.irpfQuota || 0;
        cellAF.style = { ...cellAF.style, numFmt: '0.00' };

        sheetIssued.getCell(`AJ${rowIdx}`).value = item.id;
        rowIdx++;
      }

      // Delete trailing unused/explanatory rows bottom-up to correctly handle merged cells in ExcelJS
      const totalRowsIssued = sheetIssued.rowCount;
      for (let i = totalRowsIssued; i >= rowIdx; i--) {
        sheetIssued.spliceRows(i, 1);
      }
    }

    // 4. Write RECIBIDAS_GASTOS sheet
    if (sheetReceived) {
      for (let r = 10; r <= 500; r++) {
        for (let c = 1; c <= 42; c++) {
          sheetReceived.getRow(r).getCell(c).value = null;
        }
      }

      let rowIdxRec = 10;
      for (const item of filteredReceived) {
        const parsed = parseNifAndCountry(item.supplierNif, item.supplierCountryCode);
        const supplierCountry = parsed.country;
        const supplierIsSpain = parsed.isSpain;
        const supplierNifClean = parsed.nif;

        if (rowIdxRec > 10) {
          copyRowStyles(sheetReceived, 10, rowIdxRec, 42);
        }

        sheetReceived.getCell(`A${rowIdxRec}`).value = item.year;
        sheetReceived.getCell(`B${rowIdxRec}`).value = item.period || getQuarterFromDate(item.dateExp || item.dateReceipt);
        sheetReceived.getCell(`C${rowIdxRec}`).value = item.activityCode || 'A';
        sheetReceived.getCell(`D${rowIdxRec}`).value = String(item.activityType || '04').padStart(2, '0');
        sheetReceived.getCell(`E${rowIdxRec}`).value = String(item.activityIae || '032').replace('.', '').trim().padStart(3, '0');
        sheetReceived.getCell(`F${rowIdxRec}`).value = item.invoiceType || 'F1';
        sheetReceived.getCell(`G${rowIdxRec}`).value = item.expenseConcept || null;
        
        const cellH = sheetReceived.getCell(`H${rowIdxRec}`);
        cellH.value = item.expenseAmount || item.base;
        cellH.style = { ...cellH.style, numFmt: '0.00' };

        const dateExpVal = parseDate(item.dateExp);
        if (dateExpVal) {
          const cellI = sheetReceived.getCell(`I${rowIdxRec}`);
          cellI.value = dateExpVal;
          cellI.style = { ...cellI.style, numFmt: 'dd/mm/yyyy' };
        }

        const dateOpVal = parseDate(item.dateOp || item.dateExp);
        if (dateOpVal) {
          const cellJ = sheetReceived.getCell(`J${rowIdxRec}`);
          cellJ.value = dateOpVal;
          cellJ.style = { ...cellJ.style, numFmt: 'dd/mm/yyyy' };
        }

        sheetReceived.getCell(`K${rowIdxRec}`).value = String(item.invoiceNumber || '').trim();
        sheetReceived.getCell(`L${rowIdxRec}`).value = null;

        const dateReceiptVal = parseDate(item.dateReceipt || item.dateExp);
        if (dateReceiptVal) {
          const cellM = sheetReceived.getCell(`M${rowIdxRec}`);
          cellM.value = dateReceiptVal;
          cellM.style = { ...cellM.style, numFmt: 'dd/mm/yyyy' };
        }

        sheetReceived.getCell(`N${rowIdxRec}`).value = null;
        sheetReceived.getCell(`O${rowIdxRec}`).value = null;
        
        sheetReceived.getCell(`P${rowIdxRec}`).value = supplierIsSpain ? null : String(item.supplierNifType || '02').padStart(2, '0');
        sheetReceived.getCell(`Q${rowIdxRec}`).value = supplierIsSpain ? null : supplierCountry;
        
        sheetReceived.getCell(`R${rowIdxRec}`).value = supplierNifClean;
        sheetReceived.getCell(`S${rowIdxRec}`).value = formatClientName(item.supplierName);
        sheetReceived.getCell(`T${rowIdxRec}`).value = String(item.operationKey || '01').padStart(2, '0');
        
        // Bien de inversión (Col U): 'S' or 'N'
        sheetReceived.getCell(`U${rowIdxRec}`).value = (item.isInvestmentGood === 'S' || item.isInvestmentGood === 'SI' || item.isInvestmentGood === true) ? 'S' : 'N';
        
        // Inversión Sujeto Pasivo (Col V): 'SI' or 'NO'
        sheetReceived.getCell(`V${rowIdxRec}`).value = (item.isIsp === 'S' || item.isIsp === 'SI' || item.isIsp === true) ? 'SI' : 'NO';
        
        // Deducible periodo posterior (Col W): 'S' or 'N'
        const isDeductPosterior = (item.isDeductiblePosterior === 'S' || item.isDeductiblePosterior === 'SI' || item.isDeductiblePosterior === true);
        sheetReceived.getCell(`W${rowIdxRec}`).value = isDeductPosterior ? 'S' : 'N';
        
        sheetReceived.getCell(`X${rowIdxRec}`).value = isDeductPosterior ? item.year : null;
        sheetReceived.getCell(`Y${rowIdxRec}`).value = isDeductPosterior ? (item.period || getQuarterFromDate(item.dateExp || item.dateReceipt)) : null;

        const cellZ = sheetReceived.getCell(`Z${rowIdxRec}`);
        cellZ.value = item.total;
        cellZ.style = { ...cellZ.style, numFmt: '0.00' };

        const cellAA = sheetReceived.getCell(`AA${rowIdxRec}`);
        cellAA.value = item.base;
        cellAA.style = { ...cellAA.style, numFmt: '0.00' };

        const cellAB = sheetReceived.getCell(`AB${rowIdxRec}`);
        cellAB.value = item.vatPercent || 0;
        cellAB.style = { ...cellAB.style, numFmt: '0.00' };

        const cellAC = sheetReceived.getCell(`AC${rowIdxRec}`);
        cellAC.value = item.vatQuota || 0;
        cellAC.style = { ...cellAC.style, numFmt: '0.00' };

        const cellAD = sheetReceived.getCell(`AD${rowIdxRec}`);
        cellAD.value = item.vatDeductibleQuota || item.vatQuota || 0;
        cellAD.style = { ...cellAD.style, numFmt: '0.00' };

        const cellAK = sheetReceived.getCell(`AK${rowIdxRec}`);
        cellAK.value = item.irpfPercent || 0;
        cellAK.style = { ...cellAK.style, numFmt: '0.00' };

        const cellAL = sheetReceived.getCell(`AL${rowIdxRec}`);
        cellAL.value = item.irpfQuota || 0;
        cellAL.style = { ...cellAL.style, numFmt: '0.00' };

        sheetReceived.getCell(`AP${rowIdxRec}`).value = item.id;
        rowIdxRec++;
      }

      // Delete trailing unused/explanatory rows bottom-up
      const totalRowsReceived = sheetReceived.rowCount;
      for (let i = totalRowsReceived; i >= rowIdxRec; i--) {
        sheetReceived.spliceRows(i, 1);
      }
    }

    // 4b. Clear BIENES-INVERSIÓN sheet completely to avoid trailing notes parsing
    if (sheetAssets) {
      const totalRowsAssets = sheetAssets.rowCount;
      for (let i = totalRowsAssets; i >= 10; i--) {
        sheetAssets.spliceRows(i, 1);
      }
    }

    // 5. Generate output buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = `llibre_registre_${owner}_${filterYear}_${filterPeriod}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (err) {
    console.error("Error generating Excel:", err);
    return NextResponse.json({ error: `Error generant el fitxer Excel: ${err.message}` }, { status: 500 });
  }
}
