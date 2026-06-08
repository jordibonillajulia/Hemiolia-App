'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../../lib/AuthContext';
import { 
  getInvoices, 
  getLedgersIssued, 
  addLedgerIssued, 
  updateLedgerIssued, 
  deleteLedgerIssued, 
  getLedgersReceived, 
  addLedgerReceived, 
  updateLedgerReceived, 
  deleteLedgerReceived,
  formatDisplayInvoiceNumber,
  formatClientName
} from '../../../../lib/firestoreUtils';
import Link from 'next/link';
import Papa from 'papaparse';
import { storage, auth } from '../../../../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';


// Helper to format a date string as DD/MM/YYYY with zero-padding
const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return '';
  
  const cleanDate = dateStr.split(/[ T]/)[0];
  
  if (cleanDate.includes('-')) {
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
    }
  }
  
  if (cleanDate.includes('/')) {
    const parts = cleanDate.split('/');
    if (parts.length === 3) {
      let day, month, year;
      if (parts[2].length === 4) {
        [day, month, year] = parts;
      } else if (parts[0].length === 4) {
        [year, month, day] = parts;
      } else {
        [day, month, year] = parts;
      }
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper to check if a URL represents a PDF file (supporting query params and Firebase Storage URLs)
const isPdf = (url) => {
  if (!url) return false;
  try {
    const decodedUrl = decodeURIComponent(url);
    return decodedUrl.toLowerCase().split('?')[0].endsWith('.pdf');
  } catch (e) {
    return url.toLowerCase().includes('.pdf');
  }
};

const GASTO_CONCEPTS = [
  { code: '', label: '-- Sense concepte especial --' },
  { code: 'G01', label: 'G01 - Consums d\'explotació (compres, materials)' },
  { code: 'G02', label: 'G02 - Sous i salaris' },
  { code: 'G03', label: 'G03 - Seguretat social a càrrec de l\'empresa' },
  { code: 'G04', label: 'G04 - Altres despeses de personal' },
  { code: 'G05', label: 'G05 - Arrendaments i cànons' },
  { code: 'G06', label: 'G06 - Reparacions i conservació' },
  { code: 'G07', label: 'G07 - Serveis de professionals independents' },
  { code: 'G08', label: 'G08 - Subministraments (aigua, llum, gas, telèfon)' },
  { code: 'G09', label: 'G09 - Tributs fiscalment deducibles' },
  { code: 'G10', label: 'G10 - Despeses financeres' },
  { code: 'G11', label: 'G11 - Amortitzacions de l\'immobilitzat' },
  { code: 'G12', label: 'G12 - Altres despeses fiscalment deducibles' }
];

const INGRESO_CONCEPTS = [
  { code: 'I08', label: 'I08 - Prestació de serveis professionals (Artístics)' },
  { code: 'I01', label: 'I01 - Arrendaments d\'immobles' },
  { code: 'I02', label: 'I02 - Drets de propietat intel·lectual / industrial' },
  { code: 'I09', label: 'I09 - Altres ingressos de l\'activitat' }
];

export default function LedgersPage() {
  const { user, loading, isAdmin } = useAuth();
  
  // Data State
  const [issued, setIssued] = useState([]);
  const [received, setReceived] = useState([]);
  const [appInvoices, setAppInvoices] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Filters State
  const [owner, setOwner] = useState('Jordi'); // Jordi o Paula
  const [type, setType] = useState('issued'); // issued (Ingressos) o received (Despeses)
  const [filterYear, setFilterYear] = useState('2026'); // Anys
  const [filterPeriod, setFilterPeriod] = useState('Tots'); // Tots, 1T, 2T, 3T, 4T

  // Form State for Add/Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form fields
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState('1T');
  const [dateExp, setDateExp] = useState(new Date().toISOString().split('T')[0]);
  const [dateOp, setDateOp] = useState(new Date().toISOString().split('T')[0]);
  const [dateReceipt, setDateReceipt] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [nif, setNif] = useState('');
  const [name, setName] = useState('');
  const [base, setBase] = useState('0');
  const [vatPercent, setVatPercent] = useState('10');
  const [vatQuota, setVatQuota] = useState('0');
  const [irpfPercent, setIrpfPercent] = useState('15');
  const [irpfQuota, setIrpfQuota] = useState('0');
  const [total, setTotal] = useState('0');
  const [concept, setConcept] = useState('I08');
  
  // Sync state
  const [syncStatus, setSyncStatus] = useState('');

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanFile, setScanFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedFilePath, setScannedFilePath] = useState('');

  // View/Preview state
  const [viewedItem, setViewedItem] = useState(null);
  const [previewFileUrl, setPreviewFileUrl] = useState(null);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [issuedData, receivedData, invoicesData] = await Promise.all([
        getLedgersIssued(),
        getLedgersReceived(),
        getInvoices()
      ]);
      setIssued(issuedData);
      setReceived(receivedData);
      setAppInvoices(invoicesData);
    } catch (err) {
      console.error("Error loading ledgers:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Initial Data Load
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Auto Calculations in Form
  useEffect(() => {
    const b = parseFloat(base) || 0;
    const v = parseFloat(vatPercent) || 0;
    const i = parseFloat(irpfPercent) || 0;

    const computedVatQuota = parseFloat((b * (v / 100)).toFixed(2));
    const computedIrpfQuota = parseFloat((b * (i / 100)).toFixed(2));
    const computedTotal = parseFloat((b + computedVatQuota).toFixed(2));

    setVatQuota(computedVatQuota.toString());
    setIrpfQuota(computedIrpfQuota.toString());
    setTotal(computedTotal.toString());
  }, [base, vatPercent, irpfPercent]);

  // Determine Quarter based on date
  const getQuarterFromDate = (dateStr) => {
    if (!dateStr) return '1T';
    const month = new Date(dateStr).getMonth() + 1;
    if (month >= 1 && month <= 3) return '1T';
    if (month >= 4 && month <= 6) return '2T';
    if (month >= 7 && month <= 9) return '3T';
    return '4T';
  };

  // Sync Invoices from App Invoices Collection
  const handleSyncInvoices = async () => {
    setSyncStatus('Sincronitzant...');
    try {
      // Filter app invoices matching the current owner
      const currentOwnerNif = owner === 'Jordi' ? '40936132L' : '78582484V';
      const ownerPrefix = owner === 'Jordi' ? 'JB' : 'PM';
      
      const filteredAppInvoices = appInvoices.filter(inv => 
        inv.issuerId === ownerPrefix && 
        inv.invoiceNumber && 
        inv.totals
      );

      // Get current list of issued ledgers for this owner
      const existingLedgers = issued.filter(l => l.owner === owner);
      const existingLedgerNumbers = new Set(existingLedgers.map(l => l.invoiceNumber));

      // 1. Delete ledgers that were previously synced but no longer exist in app invoices (deleted or cancelled)
      const activeAppInvoiceNumbers = new Set(filteredAppInvoices.map(inv => inv.invoiceNumber));
      const ledgersToDelete = existingLedgers.filter(l => 
        (l.source === 'sync' || /^(?:R\d)?\d{12}$/.test(l.invoiceNumber)) &&
        !activeAppInvoiceNumbers.has(l.invoiceNumber)
      );

      let deletedCount = 0;
      for (const l of ledgersToDelete) {
        await deleteLedgerIssued(l.id);
        deletedCount++;
      }

      // 2. Import any new app invoices
      let importedCount = 0;

      for (const inv of filteredAppInvoices) {
        if (!existingLedgerNumbers.has(inv.invoiceNumber)) {
          const invDate = inv.date;
          const invYear = new Date(invDate).getFullYear();
          const invQuarter = getQuarterFromDate(invDate);

          const ledgerRecord = {
            owner: owner,
            sheet: "EXPEDIDAS_INGRESOS",
            year: invYear,
            period: invQuarter,
            activityCode: 'A',
            activityType: 4,
            activityIae: 32,
            invoiceType: inv.tipoFactura || 'F1',
            incomeConcept: 'I08',
            incomeAmount: parseFloat(inv.totals.baseImposable || 0),
            dateExp: invDate,
            dateOp: inv.operationDate || invDate,
            invoiceSerie: null,
            invoiceNumber: inv.invoiceNumber,
            clientNifType: inv.clientNifType || '2',
            clientCountryCode: inv.clientCountryCode || 'ES',
            clientNif: inv.clientNif,
            clientName: formatClientName(inv.clientName),
            operationKey: 1,
            operationType: 'S1',
            exemptReason: null,
            total: parseFloat((parseFloat(inv.totals.baseImposable || 0) + parseFloat(inv.totals.totalIva || 0)).toFixed(2)),
            base: parseFloat(inv.totals.baseImposable || 0),
            vatPercent: inv.lines && inv.lines.length > 0 ? parseFloat(inv.lines[0].vatPercent || 0) : 10,
            vatQuota: parseFloat(inv.totals.totalIva || 0),
            eqTaxPercent: null,
            eqTaxQuota: null,
            irpfPercent: parseFloat(inv.irpfPercent || 0),
            irpfQuota: parseFloat(inv.totals.totalIrpf || 0),
            source: 'sync' // Tag to identify records imported via sync
          };

          await addLedgerIssued(ledgerRecord);
          importedCount++;
        }
      }

      // 3. Clean up orphaned files in Firebase Storage for received invoices (expenses)
      let cleanedStorageFilesCount = 0;
      try {
        const latestReceived = await getLedgersReceived();
        const currentYear = new Date().getFullYear();
        const yearsToClean = new Set([currentYear]);
        if (filterYear !== 'Tots') {
          yearsToClean.add(parseInt(filterYear, 10));
        }
        
        const quarters = ['1T', '2T', '3T', '4T'];
        for (const y of yearsToClean) {
          for (const q of quarters) {
            const folderPath = `expenses/${owner}/${y}-${q}`;
            const folderRef = ref(storage, folderPath);
            try {
              const res = await listAll(folderRef);
              for (const itemRef of res.items) {
                const filename = itemRef.name;
                const isReferenced = latestReceived.some(r => 
                  r.scannedFile && 
                  r.scannedFile.includes(encodeURIComponent(filename))
                );
                if (!isReferenced) {
                  await deleteObject(itemRef);
                  cleanedStorageFilesCount++;
                  console.log(`Orphaned file deleted during sync: ${itemRef.fullPath}`);
                }
              }
            } catch (err) {
              if (err.code !== 'storage/object-not-found') {
                console.error(`Error listing folder ${folderPath} during sync:`, err);
              }
            }
          }
        }
      } catch (storageErr) {
        console.error("Error during storage cleanup:", storageErr);
      }

      await loadData();
      
      let msg = `Sincronitzat correctament!`;
      if (importedCount > 0) {
        msg += ` S'han importat ${importedCount} factures noves.`;
      }
      if (deletedCount > 0) {
        msg += ` S'han suprimit ${deletedCount} registres de factures esborrades/cancel·lades.`;
      }
      if (cleanedStorageFilesCount > 0) {
        msg += ` S'han eliminat ${cleanedStorageFilesCount} fitxers orfes del servidor.`;
      }
      if (importedCount === 0 && deletedCount === 0 && cleanedStorageFilesCount === 0) {
        msg += ` Tots els registres estan al dia i el servidor net.`;
      }
      
      setSyncStatus(msg);
      setTimeout(() => setSyncStatus(''), 6000);
    } catch (err) {
      console.error(err);
      setSyncStatus('Error en la sincronització.');
    }
  };
  const handleScanFile = async (e) => {
    e.preventDefault();
    if (!scanFile) return;

    setIsScanning(true);
    setScanError('');

    const formData = new FormData();
    formData.append('file', scanFile);
    formData.append('owner', owner);
    formData.append('year', filterYear === 'Tots' ? new Date().getFullYear().toString() : filterYear);
    formData.append('period', filterPeriod === 'Tots' ? '1T' : filterPeriod);

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/billing/expenses/scan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Error desconegut al processar la factura.');
      }

      // Prefill manual form fields with extracted data
      setYear(resData.detectedYear || (filterYear === 'Tots' ? new Date().getFullYear().toString() : filterYear));
      setPeriod(resData.detectedPeriod || (filterPeriod === 'Tots' ? '1T' : filterPeriod));
      setDateExp(resData.data.dateExp || new Date().toISOString().split('T')[0]);
      setDateOp(resData.data.dateExp || new Date().toISOString().split('T')[0]);
      setDateReceipt(resData.data.dateExp || new Date().toISOString().split('T')[0]);
      setInvoiceNumber(resData.data.invoiceNumber || '');
      setNif(resData.data.supplierNif || '');
      setName(resData.data.supplierName || '');
      setBase((resData.data.base || 0).toString());
      setVatPercent((resData.data.vatPercent !== undefined ? resData.data.vatPercent : 21).toString());
      setIrpfPercent((resData.data.irpfPercent !== undefined ? resData.data.irpfPercent : 0).toString());
      setConcept(resData.data.expenseConcept || 'G08');

      // Upload file to Firebase Storage
      if (resData.savedFilename) {
        const ownerFolder = owner;
        const periodFolder = `${resData.detectedYear || year}-${resData.detectedPeriod || period}`;
        const storageRef = ref(storage, `expenses/${ownerFolder}/${periodFolder}/${resData.savedFilename}`);
        
        setSyncStatus('Arxivant fitxer al núvol (Firebase Storage)...');
        const uploadResult = await uploadBytes(storageRef, scanFile);
        const downloadUrl = await getDownloadURL(uploadResult.ref);
        
        setScannedFilePath(downloadUrl);
        setSyncStatus('Factura arxivada correctament al núvol!');
        setTimeout(() => setSyncStatus(''), 5000);
      } else {
        setScannedFilePath('');
      }

      setIsFormOpen(true);
      setIsScannerOpen(false);
      setScanFile(null);
      const mainInput = document.getElementById('main-file-input');
      if (mainInput) mainInput.value = '';
      const camInput = document.getElementById('camera-capture-input');
      if (camInput) camInput.value = '';
    } catch (err) {
      console.error(err);
      setScanError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Form Submit (Add / Edit)

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSave = {
      owner,
      year: parseInt(year),
      period,
      dateExp,
      dateOp,
      invoiceNumber,
      clientNif: nif,
      clientName: formatClientName(name),
      supplierNif: nif,
      supplierName: formatClientName(name),
      base: parseFloat(base) || 0,
      vatPercent: parseFloat(vatPercent) || 0,
      vatQuota: parseFloat(vatQuota) || 0,
      irpfPercent: parseFloat(irpfPercent) || 0,
      irpfQuota: parseFloat(irpfQuota) || 0,
      total: parseFloat(total) || 0,
      activityCode: 'A',
      activityType: 4,
      activityIae: 32,
      operationKey: 1,
      invoiceType: 'F1',
      scannedFile: scannedFilePath || null
    };

    if (type === 'issued') {
      dataToSave.sheet = "EXPEDIDAS_INGRESOS";
      dataToSave.incomeConcept = concept;
      dataToSave.incomeAmount = dataToSave.base;
      dataToSave.clientNifType = '2';
      dataToSave.clientCountryCode = 'ES';
      dataToSave.operationType = 'S1';
      
      if (editingId) {
        await updateLedgerIssued(editingId, dataToSave);
      } else {
        await addLedgerIssued(dataToSave);
      }
    } else {
      dataToSave.sheet = "RECIBIDAS_GASTOS";
      dataToSave.expenseConcept = concept || null;
      dataToSave.expenseAmount = dataToSave.base;
      dataToSave.dateReceipt = dateReceipt;
      dataToSave.supplierNifType = '2';
      dataToSave.supplierCountryCode = 'ES';
      dataToSave.vatDeductibleQuota = dataToSave.vatQuota;
      dataToSave.isInvestmentGood = 'N';
      dataToSave.isIsp = 'N';

      if (editingId) {
        await updateLedgerReceived(editingId, dataToSave);
      } else {
        await addLedgerReceived(dataToSave);
      }
    }

    resetForm();
    loadData();
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setYear(item.year || new Date().getFullYear());
    setPeriod(item.period || '1T');
    setDateExp(item.dateExp || '');
    setDateOp(item.dateOp || '');
    setDateReceipt(item.dateReceipt || '');
    setInvoiceNumber(item.invoiceNumber || '');
    setNif(type === 'issued' ? (item.clientNif || '') : (item.supplierNif || ''));
    setName(type === 'issued' ? (item.clientName || '') : (item.supplierName || ''));
    setBase((item.base || 0).toString());
    setVatPercent((item.vatPercent || 0).toString());
    setVatQuota((item.vatQuota || 0).toString());
    setIrpfPercent((item.irpfPercent || 0).toString());
    setIrpfQuota((item.irpfQuota || 0).toString());
    setTotal((item.total || 0).toString());
    setConcept(type === 'issued' ? (item.incomeConcept || 'I08') : (item.expenseConcept || ''));
    setScannedFilePath(item.scannedFile || '');
    setIsFormOpen(true);
  };

  const handleDelete = async (item) => {
    const displayNum = item.invoiceNumber || 'sense número';
    if (confirm(`Segur que vols esborrar el registre ${displayNum}?`)) {
      // 1. If there's an associated file uploaded to Firebase Storage, delete it first
      if (item.scannedFile && item.scannedFile.startsWith('http')) {
        try {
          const fileRef = ref(storage, item.scannedFile);
          await deleteObject(fileRef);
          console.log("File deleted successfully from Storage:", item.scannedFile);
        } catch (err) {
          console.error("Error deleting file from Storage:", err);
        }
      }

      // 2. Delete database entry from Firestore
      if (type === 'issued') {
        await deleteLedgerIssued(item.id);
      } else {
        await deleteLedgerReceived(item.id);
      }
      loadData();
    }
  };

  const resetForm = () => {
    // If we were creating a new record and scanned a file, but are cancelling the form, clean up the file
    if (!editingId && scannedFilePath && scannedFilePath.startsWith('http')) {
      const fileRef = ref(storage, scannedFilePath);
      deleteObject(fileRef).catch(err => console.error("Error deleting cancelled file:", err));
    }
    setEditingId(null);
    setYear(new Date().getFullYear());
    setPeriod('1T');
    setDateExp(new Date().toISOString().split('T')[0]);
    setDateOp(new Date().toISOString().split('T')[0]);
    setDateReceipt(new Date().toISOString().split('T')[0]);
    setInvoiceNumber('');
    setNif('');
    setName('');
    setBase('0');
    setVatPercent('10');
    setVatQuota('0');
    setIrpfPercent('15');
    setIrpfQuota('0');
    setTotal('0');
    setConcept(type === 'issued' ? 'I08' : '');
    setIsFormOpen(false);
    setScannedFilePath('');
  };

  // Filtered List Memo
  const currentList = useMemo(() => {
    const list = type === 'issued' ? issued : received;
    return list.filter(item => {
      const matchOwner = item.owner === owner;
      const matchYear = filterYear === 'Tots' || item.year?.toString() === filterYear;
      const matchPeriod = filterPeriod === 'Tots' || item.period === filterPeriod;
      return matchOwner && matchYear && matchPeriod;
    }).sort((a, b) => {
      const dateCompare = (a.dateExp || '').localeCompare(b.dateExp || '');
      if (dateCompare !== 0) return dateCompare;
      return String(a.invoiceNumber || '').localeCompare(String(b.invoiceNumber || ''), undefined, { numeric: true });
    });
  }, [issued, received, owner, type, filterYear, filterPeriod]);

  // Totals Calculations for filtered list
  const currentTotals = useMemo(() => {
    let tBase = 0;
    let tVat = 0;
    let tIrpf = 0;
    let tTotal = 0;
    
    currentList.forEach(item => {
      tBase += parseFloat(item.base) || 0;
      tVat += parseFloat(item.vatQuota) || 0;
      tIrpf += parseFloat(item.irpfQuota) || 0;
      tTotal += parseFloat(item.total) || 0;
    });

    return { base: tBase, vat: tVat, irpf: tIrpf, total: tTotal };
  }, [currentList]);

  // Export to unified AEAT Excel Template (.xlsx)
  const handleExportAEAT = async () => {
    const token = await auth.currentUser?.getIdToken();
    // Generate the URL with query parameters for the Excel export API including the auth token
    const url = `/api/billing/ledgers/export?owner=${owner}&year=${filterYear}&period=${filterPeriod}&token=${token}`;
    // Trigger download in the current window
    window.location.href = url;
  };

  // Download file helper
  const handleDownloadFile = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      let filename = 'factura.pdf';
      try {
        const decodedUrl = decodeURIComponent(url);
        const pathPart = decodedUrl.split('?')[0];
        const parts = pathPart.split('/');
        filename = parts[parts.length - 1] || 'factura';
      } catch (e) {}
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading file:", err);
      alert("No s'ha pogut descarregar el document. És possible que el fitxer hagi estat eliminat del servidor de Firebase Storage.");
    }
  };

  // Print file helper
  const handlePrintFile = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        }, 1000);
      };
    } catch (err) {
      console.error("Error printing file:", err);
      alert("No s'ha pogut imprimir el document. És possible que el fitxer hagi estat eliminat del servidor de Firebase Storage.");
    }
  };

  // View invoice helper (resolves local filename to storage URL if necessary)
  const handleViewInvoice = async (item) => {
    if (!item.scannedFile) return;
    
    if (item.scannedFile.startsWith('http') || item.scannedFile.includes('://')) {
      setPreviewFileUrl(item.scannedFile);
    } else {
      // It's a local filename, resolve it from Firebase Storage
      setSyncStatus('Obtenint enllaç segur de la factura...');
      try {
        const itemPeriod = item.period || getQuarterFromDate(item.dateExp || item.dateReceipt);
        const fileRef = ref(storage, `expenses/${item.owner}/${item.year}-${itemPeriod}/${item.scannedFile}`);
        const downloadUrl = await getDownloadURL(fileRef);
        setPreviewFileUrl(downloadUrl);
        setSyncStatus('');
      } catch (err) {
        console.error("Error resolving storage file URL:", err);
        setSyncStatus("Error: No s'ha pogut trobar el fitxer al servidor.");
        setTimeout(() => setSyncStatus(''), 5000);
      }
    }
  };

  if (loading || !user) return <div className="container mt-xl text-center">Carregant...</div>;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>
      {/* HEADER */}
      <div className="header-bar-responsive">
        <div>
          <Link href="/dashboard/billing" className="btn-back no-print" title="Tornar a Facturació" style={{ marginRight: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>Llibres de registre</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {type === 'issued' && isAdmin && (
            <button className="btn btn-glass" onClick={handleSyncInvoices}>
              🔄 Sincronitzar Factures
            </button>
          )}
          {type === 'received' && isAdmin && (
            <button className="btn btn-glass" onClick={() => setIsScannerOpen(!isScannerOpen)}>
              📷 Escanejar Factura
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setIsFormOpen(!isFormOpen)}>
              {isFormOpen ? 'Cancel·lar' : '+ Afegir Registre'}
            </button>
          )}
        </div>
      </div>

      {syncStatus && (
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '4px solid var(--color-accent)', color: 'var(--color-accent)' }}>
          {syncStatus}
        </div>
      )}

      {/* SCANNER MODAL / PANEL */}
      {isScannerOpen && (
        <div className="glass-panel animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)', border: '1px solid var(--color-accent)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--color-accent)' }}>
            📷 Lector de Factures de Despesa (IA)
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
            Puja una factura en format PDF o imatge (JPG, PNG) o <strong>fes una foto directament amb la càmera</strong> des de la teva tauleta o mòbil. El lector de Gemini extraurà automàticament les dades de facturació i arxivarà el document a la carpeta:
            <br />
            <code style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.5rem', fontFamily: 'monospace' }}>
              despeses {owner}/{filterYear === 'Tots' ? new Date().getFullYear() : filterYear}-{filterPeriod === 'Tots' ? '1T' : filterPeriod}/
            </code>
          </p>
          
          <form onSubmit={handleScanFile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group">
              <label>Selecciona la Factura (PDF, PNG, JPG) o fes una Foto</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input 
                  type="file" 
                  id="main-file-input"
                  className="input-field" 
                  style={{ flex: '1', minWidth: '200px' }}
                  accept="application/pdf, image/*" 
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setScanFile(e.target.files[0]);
                      const camInput = document.getElementById('camera-capture-input');
                      if (camInput) camInput.value = '';
                    }
                  }} 
                />
                
                <input 
                  type="file" 
                  id="camera-capture-input"
                  accept="image/*" 
                  capture="environment" 
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setScanFile(e.target.files[0]);
                      const mainInput = document.getElementById('main-file-input');
                      if (mainInput) mainInput.value = '';
                    }
                  }} 
                />
                
                <button
                  type="button"
                  className="btn btn-glass"
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    padding: '0.75rem 1.2rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    color: 'var(--color-accent)',
                    background: 'rgba(212, 175, 55, 0.05)',
                    fontWeight: '500'
                  }}
                  onClick={() => {
                    const camInput = document.getElementById('camera-capture-input');
                    if (camInput) camInput.click();
                  }}
                >
                  📷 Fer Foto
                </button>
              </div>

              {scanFile && (
                <div style={{ fontSize: '0.85rem', color: 'var(--color-success)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>✓ Fitxer seleccionat: <strong>{scanFile.name}</strong> ({ (scanFile.size / 1024 / 1024).toFixed(2) } MB)</span>
                </div>
              )}
            </div>

            {scanError && (
              <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                ❌ {scanError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isScanning || !scanFile} 
                style={{ flex: 1 }}
              >
                {isScanning ? '⏳ Processant amb Intel·ligència Artificial...' : '🔎 Llegir i Arxivar Factura'}
              </button>
              <button 
                type="button" 
                className="btn btn-glass" 
                onClick={() => {
                  setIsScannerOpen(false);
                  setScanFile(null);
                  setScanError('');
                  const mainInput = document.getElementById('main-file-input');
                  if (mainInput) mainInput.value = '';
                  const camInput = document.getElementById('camera-capture-input');
                  if (camInput) camInput.value = '';
                }}
                disabled={isScanning}
                style={{ flex: 0.3 }}
              >
                Tancar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MANUAL ROW ADD/EDIT FORM */}
      {isFormOpen && (
        <div className="glass-panel animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)', border: '1px solid var(--color-accent)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--color-accent)' }}>
            {editingId ? '✏️ Editar Registre del Llibre' : '➕ Afegir Nou Registre al Llibre'}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {scannedFilePath && (
              <div className="grid-span-2-desktop" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(46, 204, 113, 0.1)', padding: '0.6rem 1rem', borderRadius: '4px', border: '1px solid var(--color-success)', color: 'var(--color-success)', fontSize: '0.85rem' }}>
                <span>📁 <strong>Factura arxivada:</strong> {scannedFilePath.startsWith('http') ? <a href={scannedFilePath} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-success)', textDecoration: 'underline' }}>Veure document al núvol</a> : scannedFilePath}</span>
              </div>
            )}
            <div className="input-group">
              <label>Exercici Autoliquidació</label>
              <input type="number" className="input-field" value={year} onChange={e => setYear(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Període</label>
              <select className="input-field" value={period} onChange={e => setPeriod(e.target.value)}>
                <option value="1T">1r Trimestre (1T)</option>
                <option value="2T">2n Trimestre (2T)</option>
                <option value="3T">3r Trimestre (3T)</option>
                <option value="4T">4t Trimestre (4T)</option>
              </select>
            </div>
            <div className="input-group">
              <label>Fecha Expedició</label>
              <input type="date" className="input-field" value={dateExp} onChange={e => {
                setDateExp(e.target.value);
                setYear(new Date(e.target.value).getFullYear());
                setPeriod(getQuarterFromDate(e.target.value));
              }} required />
            </div>
            <div className="input-group">
              <label>Fecha Operació</label>
              <input type="date" className="input-field" value={dateOp} onChange={e => setDateOp(e.target.value)} required />
            </div>
            
            {type === 'received' && (
              <div className="input-group">
                <label>Fecha Recepció</label>
                <input type="date" className="input-field" value={dateReceipt} onChange={e => setDateReceipt(e.target.value)} required />
              </div>
            )}

            <div className="input-group">
              <label>{type === 'issued' ? 'Nº Factura' : 'Identificació Factura (Nº/Serie)'}</label>
              <input type="text" className="input-field" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex: JB-2026-024 o 145/26" required />
            </div>

            <div className="input-group">
              <label>{type === 'issued' ? 'NIF Client' : 'NIF Proveïdor'}</label>
              <input type="text" className="input-field" value={nif} onChange={e => setNif(e.target.value.toUpperCase().trim())} placeholder="Ex: P4315700G" required />
            </div>

            <div className="input-group grid-span-2-desktop">
              <label>{type === 'issued' ? 'Nom / Raó Social Client' : 'Nom Proveïdor'}</label>
              <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Ajuntament de..." required />
            </div>

            <div className="input-group">
              <label>Concepte AEAT</label>
              <select className="input-field" value={concept} onChange={e => setConcept(e.target.value)}>
                {type === 'issued' 
                  ? INGRESO_CONCEPTS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)
                  : GASTO_CONCEPTS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)
                }
              </select>
            </div>

            <div className="input-group">
              <label>Base Imposable (€)</label>
              <input type="number" step="0.01" className="input-field" value={base} onChange={e => setBase(e.target.value)} required />
            </div>

            <div className="input-group">
              <label>IVA (%)</label>
              <select className="input-field" value={vatPercent} onChange={e => setVatPercent(e.target.value)}>
                <option value="21">21 %</option>
                <option value="10">10 %</option>
                <option value="4">4 %</option>
                <option value="0">0 % (Exempt)</option>
              </select>
            </div>

            <div className="input-group">
              <label>Cuota IVA Repercutit (€)</label>
              <input type="number" className="input-field" value={vatQuota} disabled readOnly />
            </div>

            <div className="input-group">
              <label>IRPF (%)</label>
              <select className="input-field" value={irpfPercent} onChange={e => setIrpfPercent(e.target.value)}>
                <option value="15">15 % (Retenció Professional)</option>
                <option value="7">7 % (Nous Autònoms)</option>
                <option value="0">Sense IRPF</option>
              </select>
            </div>

            <div className="input-group">
              <label>Import Retingut IRPF (€)</label>
              <input type="number" className="input-field" value={irpfQuota} disabled readOnly />
            </div>

            <div className="input-group">
              <label>Total Factura (Base+IVA) (€)</label>
              <input type="number" className="input-field" value={total} disabled readOnly />
            </div>

            <div className="grid-span-all-desktop" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: '1 1 200px' }}>
                {editingId ? 'Guardar Canvis' : 'Afegir al Llibre de Registre'}
              </button>
              <button type="button" className="btn btn-glass" onClick={resetForm} style={{ flex: '1 1 100px' }}>
                Cancel·lar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & OPTION CONTROLS BAR */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ marginBottom: 0, minWidth: '130px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Titular</label>
              <select className="input-field" value={owner} onChange={e => setOwner(e.target.value)} style={{ padding: '0.4rem 0.8rem' }}>
                <option value="Jordi">Jordi Bonilla (40936132L)</option>
                <option value="Paula">Paula Martí (78582484V)</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0, minWidth: '150px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Tipus de Llibre</label>
              <select className="input-field" value={type} onChange={e => setType(e.target.value)} style={{ padding: '0.4rem 0.8rem' }}>
                <option value="issued">Factures Emitides (Ingressos)</option>
                <option value="received">Factures Rebudes (Despeses)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 200px' }}>
              <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '80px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Exercici</label>
                <select className="input-field" value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ padding: '0.4rem 0.8rem', width: '100%' }}>
                  <option value="Tots">Tots els anys</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '100px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Període</label>
                <select className="input-field" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={{ padding: '0.4rem 0.8rem', width: '100%' }}>
                  <option value="Tots">Tots els trimestres</option>
                  <option value="1T">1r Trimestre (1T)</option>
                  <option value="2T">2n Trimestre (2T)</option>
                  <option value="3T">3r Trimestre (3T)</option>
                  <option value="4T">4t Trimestre (4T)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <button 
              className="btn btn-primary" 
              onClick={handleExportAEAT} 
              disabled={currentList.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              📥 Exportar Excel (AEAT)
            </button>
          </div>

        </div>
      </div>

      <details className="glass-panel" style={{ 
        padding: '1rem 1.5rem', 
        marginBottom: '1.5rem', 
        borderLeft: '4px solid #f1c40f', 
        background: 'rgba(241, 196, 15, 0.05)',
        fontSize: '0.9rem',
        cursor: 'pointer'
      }}>
        <summary style={{ 
          color: '#f1c40f', 
          fontWeight: 'bold',
          userSelect: 'none',
          outline: 'none',
          display: 'list-item'
        }}>
          ⚠️ Requisit d&apos;importació AEAT (Llibre Acumulatiu des de 2023)
        </summary>
        <div style={{ color: 'var(--color-text-secondary)', lineHeight: '1.5', marginTop: '1rem', paddingLeft: '1.2rem', cursor: 'default' }}>
          Perquè la importació dels Llibres de Registre funcioni al portal de l&apos;AEAT, cal pujar el llibre complet acumulat fins al període actual (ex: en el 3T s&apos;inclouen automàticament les dades de 1T, 2T i 3T). L&apos;exportació en Excel (`.xlsx`) de l&apos;aplicació ja gestiona aquesta acumulació de forma automàtica segons el trimestre triat.
        </div>
      </details>

      {/* TOTALS COMPUTATION BOX FOR THE DECLARATION */}
      <div className="glass-panel ledgers-totals-grid" style={{ 
        marginBottom: '2rem', 
        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
        borderLeft: '4px solid var(--color-accent)',
        padding: '1.2rem'
      }}>
        <div>
          <div className="ledgers-total-title">Total Base Imposable</div>
          <div className="ledgers-total-value value-primary">{currentTotals.base.toFixed(2)} €</div>
        </div>
        <div>
          <div className="ledgers-total-title">
            {type === 'issued' ? 'Total IVA Repercutit' : 'Total IVA Soportat'}
          </div>
          <div className="ledgers-total-value value-success">{currentTotals.vat.toFixed(2)} €</div>
        </div>
        <div>
          <div className="ledgers-total-title">Total Retenció IRPF</div>
          <div className="ledgers-total-value value-error">{currentTotals.irpf.toFixed(2)} €</div>
        </div>
        <div>
          <div className="ledgers-total-title">Total Factura (Base+IVA)</div>
          <div className="ledgers-total-value value-accent">{currentTotals.total.toFixed(2)} €</div>
        </div>
        <div>
          <div className="ledgers-total-title">Nombre de Registres</div>
          <div className="ledgers-total-value">{currentList.length}</div>
        </div>
      </div>

      {/* LEDGER DATA TABLE */}
      <div className="glass-panel table-container-responsive" style={{ padding: 0 }}>
        {isLoadingData ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Carregant dades del llibre de registre...</div>
        ) : currentList.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No hi ha registres que coincideixin amb els filtres seleccionats.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>Ex / Per</th>
                <th style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>Data Expedició</th>
                <th style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>Nº Factura</th>
                <th style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>{type === 'issued' ? 'Client' : 'Proveïdor'}</th>
                <th style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>Base Imposable</th>
                <th style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>IVA (%)</th>
                <th style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>IRPF (%)</th>
                <th style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>Total Factura</th>
                <th style={{ padding: '0.8rem 1rem', fontSize: '0.85rem', textAlign: 'center' }}>Accions</th>
              </tr>
            </thead>
            <tbody>
              {currentList.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td data-label="Ex / Per" style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    <strong>{item.year} ({item.period || getQuarterFromDate(item.dateExp || item.dateReceipt)})</strong>
                  </td>
                  <td data-label="Data Expedició" style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    {formatDateDDMMYYYY(item.dateExp)}
                  </td>
                  <td data-label="Nº Factura" style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {type === 'issued'
                      ? formatDisplayInvoiceNumber(item.invoiceNumber, item.owner === 'Jordi' ? 'JB' : 'PM')
                      : item.invoiceNumber
                    }
                  </td>
                  <td data-label={type === 'issued' ? 'Client' : 'Proveïdor'} style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    <div className="client-cell-container">
                      <div className="client-name-container" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="text-right-mobile">
                          {type === 'issued' ? formatClientName(item.clientName) : formatClientName(item.supplierName)}
                        </span>
                        {item.scannedFile && (
                          item.scannedFile.startsWith('http') ? (
                            <a href={item.scannedFile} target="_blank" rel="noopener noreferrer" title="Veure factura arxivada al núvol" style={{ fontSize: '0.95rem', textDecoration: 'none' }}>
                              📁
                            </a>
                          ) : (
                            <span title={`Factura arxivada localment: ${item.scannedFile}`} style={{ cursor: 'help', fontSize: '0.95rem' }}>
                              📁
                            </span>
                          )
                        )}
                      </div>
                      <div className="client-nif-container" style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                        {type === 'issued' ? item.clientNif : item.supplierNif}
                      </div>
                    </div>
                  </td>
                  <td data-label="Base Imposable" style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    {(item.base || 0).toFixed(2)} €
                  </td>
                  <td data-label={`IVA (${item.vatPercent !== undefined && item.vatPercent !== null ? item.vatPercent : 10}%)`} style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    {(item.vatQuota || 0).toFixed(2)} €
                    <span className="hide-mobile" style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '0.4rem' }}>
                      ({item.vatPercent !== undefined && item.vatPercent !== null ? item.vatPercent : 10}%)
                    </span>
                  </td>
                  <td data-label={`IRPF (${item.irpfPercent !== undefined && item.irpfPercent !== null ? item.irpfPercent : 15}%)`} style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', color: (item.irpfQuota || 0) > 0 ? '#ff6b6b' : 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {(item.irpfQuota || 0).toFixed(2)} €
                    <span className="hide-mobile" style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '0.4rem' }}>
                      ({item.irpfPercent !== undefined && item.irpfPercent !== null ? item.irpfPercent : 15}%)
                    </span>
                  </td>
                  <td data-label="Total Factura" style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', fontWeight: '500', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                    {(item.total || 0).toFixed(2)} €
                  </td>
                  <td data-label="Accions" style={{ padding: '0.8rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <button 
                      onClick={() => setViewedItem(item)} 
                      className="btn btn-glass" 
                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', marginRight: '0.4rem' }}
                      title="Visualitzar registre complet"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => handleEdit(item)} 
                          className="btn btn-glass" 
                          style={{ padding: '0.3rem 0.5rem', marginRight: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Editar"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                            <path d="m15 5 4 4"></path>
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(item)} 
                          className="btn btn-glass" 
                          style={{ padding: '0.3rem 0.5rem', color: '#ff6b6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Esborrar"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* DETAILED VIEW MODAL */}
      {viewedItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(5px)'
        }} className="no-print">
          <div className="glass-panel animate-fade-in-up" style={{
            width: '90%',
            maxWidth: '600px',
            padding: '2rem',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--color-accent)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👁️ Detalls del Registre
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Exercici / Període</span>
                  <strong>{viewedItem.year} - {viewedItem.period || getQuarterFromDate(viewedItem.dateExp || viewedItem.dateReceipt)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Tipus de registre</span>
                  <strong>{viewedItem.sheet === 'EXPEDIDAS_INGRESOS' ? 'Factura Emesa (Ingressos)' : 'Factura Rebuda (Despeses)'}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Data Expedició</span>
                  <span>{formatDateDDMMYYYY(viewedItem.dateExp)}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Data Operació</span>
                  <span>{formatDateDDMMYYYY(viewedItem.dateOp)}</span>
                </div>
              </div>

              {viewedItem.sheet !== 'EXPEDIDAS_INGRESOS' && viewedItem.dateReceipt && (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Data Recepció</span>
                  <span>{formatDateDDMMYYYY(viewedItem.dateReceipt)}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Nº Factura / Identificació</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {viewedItem.sheet === 'EXPEDIDAS_INGRESOS'
                      ? formatDisplayInvoiceNumber(viewedItem.invoiceNumber, viewedItem.owner === 'Jordi' ? 'JB' : 'PM')
                      : viewedItem.invoiceNumber
                    }
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>NIF {viewedItem.sheet === 'EXPEDIDAS_INGRESOS' ? 'Client' : 'Proveïdor'}</span>
                  <span style={{ fontFamily: 'monospace' }}>{viewedItem.sheet === 'EXPEDIDAS_INGRESOS' ? viewedItem.clientNif : viewedItem.supplierNif}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Nom / Raó Social</span>
                <span>{viewedItem.sheet === 'EXPEDIDAS_INGRESOS' ? formatClientName(viewedItem.clientName) : formatClientName(viewedItem.supplierName)}</span>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Concepte AEAT</span>
                <span>
                  {(() => {
                    const conceptCode = viewedItem.sheet === 'EXPEDIDAS_INGRESOS' ? viewedItem.incomeConcept : viewedItem.expenseConcept;
                    const conceptList = viewedItem.sheet === 'EXPEDIDAS_INGRESOS' ? INGRESO_CONCEPTS : GASTO_CONCEPTS;
                    const found = conceptList.find(c => c.code === conceptCode);
                    return found ? found.label : (conceptCode || 'Sense especificar');
                  })()}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Base Imposable</span>
                  <span>{(viewedItem.base || 0).toFixed(2)} €</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>IVA ({viewedItem.vatPercent ?? 0}%)</span>
                  <span>{(viewedItem.vatQuota || 0).toFixed(2)} €</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>IRPF ({viewedItem.irpfPercent ?? 0}%)</span>
                  <span>{(viewedItem.irpfQuota || 0).toFixed(2)} €</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Total Factura</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>{(viewedItem.total || 0).toFixed(2)} €</span>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Factura digital (Document)</span>
                  <span>{viewedItem.scannedFile ? 'Disponible' : 'Sense document adjunt'}</span>
                </div>
                {viewedItem.scannedFile && (
                  <button
                    onClick={() => handleViewInvoice(viewedItem)}
                    className="btn btn-glass"
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.8rem', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.4rem', 
                      color: 'var(--color-accent)', 
                      borderColor: 'var(--color-accent)' 
                    }}
                    title="Visualitzar factura"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span>Visualitzar Factura</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button 
                onClick={() => setViewedItem(null)}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.5rem' }}
              >
                Tancar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewFileUrl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          backdropFilter: 'blur(8px)'
        }} className="no-print">
          <div className="glass-panel animate-fade-in-up" style={{
            width: '95%',
            maxWidth: '900px',
            padding: '1.5rem',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--color-accent)',
            maxHeight: '95vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>
              <h3 style={{ margin: 0, color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📄 Vista Prèvia de la Factura
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a 
                  href={previewFileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-glass"
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    padding: '0.4rem 0.8rem', 
                    fontSize: '0.85rem',
                    color: 'var(--color-text-primary)',
                    textDecoration: 'none'
                  }}
                >
                  🔗 Obrir en pestanya nova
                </a>
                <button 
                  onClick={() => handlePrintFile(previewFileUrl)}
                  className="btn btn-glass"
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    padding: '0.4rem 0.8rem', 
                    fontSize: '0.85rem',
                    color: 'var(--color-accent)',
                    borderColor: 'var(--color-accent)'
                  }}
                >
                  🖨️ Imprimir
                </button>
                <button 
                  onClick={() => handleDownloadFile(previewFileUrl)}
                  className="btn btn-glass"
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    padding: '0.4rem 0.8rem', 
                    fontSize: '0.85rem',
                    color: 'var(--color-success)',
                    borderColor: 'var(--color-success)'
                  }}
                >
                  📥 Descarregar
                </button>
                <button 
                  onClick={() => setPreviewFileUrl(null)}
                  className="btn btn-glass"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  Tancar
                </button>
              </div>
            </div>
            
            <div style={{ flex: 1, minHeight: '350px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {isPdf(previewFileUrl) ? (
                <iframe 
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewFileUrl)}&embedded=true`} 
                  style={{ width: '100%', height: '60vh', border: 'none' }} 
                  title="Vista prèvia factura"
                />
              ) : (
                <img 
                  src={previewFileUrl} 
                  style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} 
                  alt="Vista prèvia factura"
                />
              )}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>
              ℹ️ Si visualitzes un error <strong>403 (Permission denied)</strong> o el document no es carrega, vol dir que el fitxer original ja no existeix o s&apos;ha esborrat del servidor de Firebase Storage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
