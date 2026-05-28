const fs = require('fs');
const path = require('path');
const https = require('https');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');
const { computeRegistroAlta } = require('@kreyo/verifactu-hash-calculator');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function formatDateToAEAT(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

function getFormattedTimestamp() {
  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  
  const offset = -now.getTimezoneOffset();
  const offsetSign = offset >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMinutes = pad(Math.abs(offset) % 60);
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
}

function postSOAP(xmlPayload, config, p12Buffer) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({
      pfx: p12Buffer,
      passphrase: config.password,
      rejectUnauthorized: false
    });

    const reqOptions = {
      hostname: 'prewww1.aeat.es',
      port: 443,
      path: '/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(xmlPayload),
        'SOAPAction': 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SistemaFacturacion/altaRegistroFactura'
      },
      agent: agent
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(xmlPayload);
    req.end();
  });
}

async function run() {
  const invoiceId = 'tLfMDXdgNo9ljD612FIv';
  console.log('Fetching invoice:', invoiceId);
  const docSnap = await getDoc(doc(db, 'invoices', invoiceId));
  if (!docSnap.exists()) {
    console.error('Invoice not found!');
    return;
  }
  const invoice = docSnap.data();

  // Config certificat
  const certsDir = '/Volumes/ARXIUS/jordibonilla/Documents Jordi Bonilla/PERSONAL/DOCUMENTS/CERTIFICATS DIGITALS';
  const certConfigs = {
    JB: {
      filename: 'BONILLA_JULIA_JORDI___40936132L.p12',
      password: 'Garret1n',
      name: 'Jordi Bonilla Julià'
    },
    PM: {
      filename: 'MARTI_FANDOS_PAULA___78582484V.p12',
      password: '=na&Pau1a',
      name: 'Paula Martí Fandos'
    }
  };

  const config = certConfigs[invoice.issuerId];
  const certPath = path.join(certsDir, config.filename);
  const p12Buffer = fs.readFileSync(certPath);

  // 3. Obtenir la darrera factura enviada per al mateix emissor
  const snapshot = await getDocs(collection(db, 'invoices'));
  const allInvoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const issuerInvoices = allInvoices.filter(inv => 
    inv.issuerId === invoice.issuerId && 
    inv.status === 'Enviada' && 
    inv.huella &&
    inv.id !== invoiceId // Exclude self
  );

  issuerInvoices.sort((a, b) => {
    const timeA = a.sentAt ? new Date(a.sentAt).getTime() : (a.fechaHoraHusoGenRegistro ? new Date(a.fechaHoraHusoGenRegistro).getTime() : 0);
    const timeB = b.sentAt ? new Date(b.sentAt).getTime() : (b.fechaHoraHusoGenRegistro ? new Date(b.fechaHoraHusoGenRegistro).getTime() : 0);
    return timeB - timeA;
  });

  const lastSentInvoice = issuerInvoices[0];

  // details
  const detailsXmlChunks = [];
  const taxableGroups = {};
  const exemptGroups = {};

  for (const line of (invoice.lines || [])) {
    const amount = parseFloat(line.amount) || 0;
    const isExempt = line.isVatExempt === true || line.isVatExempt === 'true';

    if (isExempt) {
      const cause = line.exemptionCause || 'E1';
      if (!exemptGroups[cause]) {
        exemptGroups[cause] = 0;
      }
      exemptGroups[cause] += amount;
    } else {
      const vatPercent = parseFloat(line.vatPercent) || 0;
      if (!taxableGroups[vatPercent]) {
        taxableGroups[vatPercent] = { base: 0, cuota: 0 };
      }
      taxableGroups[vatPercent].base += amount;
      taxableGroups[vatPercent].cuota += amount * (vatPercent / 100);
    }
  }

  let cuotaTotalNum = 0;
  let baseTotalNum = 0;

  for (const [vatPercent, group] of Object.entries(taxableGroups)) {
    const base = group.base.toFixed(2);
    const cuota = group.cuota.toFixed(2);
    cuotaTotalNum += group.cuota;
    baseTotalNum += group.base;

    detailsXmlChunks.push(`
                  <sf:DetalleDesglose>
                     <sf:Impuesto>01</sf:Impuesto>
                     <sf:ClaveRegimen>${invoice.claveRegimen || '01'}</sf:ClaveRegimen>
                     <sf:CalificacionOperacion>S1</sf:CalificacionOperacion>
                     <sf:TipoImpositivo>${parseFloat(vatPercent).toFixed(2)}</sf:TipoImpositivo>
                     <sf:BaseImponibleOimporteNoSujeto>${base}</sf:BaseImponibleOimporteNoSujeto>
                     <sf:CuotaRepercutida>${cuota}</sf:CuotaRepercutida>
                  </sf:DetalleDesglose>`);
  }

  for (const [cause, baseAmount] of Object.entries(exemptGroups)) {
    baseTotalNum += baseAmount;

    detailsXmlChunks.push(`
                  <sf:DetalleDesglose>
                     <sf:Impuesto>01</sf:Impuesto>
                     <sf:ClaveRegimen>${invoice.claveRegimen || '01'}</sf:ClaveRegimen>
                     <sf:OperacionExenta>${cause}</sf:OperacionExenta>
                     <sf:BaseImponibleOimporteNoSujeto>${baseAmount.toFixed(2)}</sf:BaseImponibleOimporteNoSujeto>
                  </sf:DetalleDesglose>`);
  }

  const detailsXml = detailsXmlChunks.join('').trim();
  const cuotaTotal = cuotaTotalNum.toFixed(2);
  const importeTotal = (baseTotalNum + cuotaTotalNum).toFixed(2);

  let encadenamientoXml = '';
  if (lastSentInvoice) {
    encadenamientoXml = `
                     <sf:RegistroAnterior>
                        <sf:IDEmisorFactura>${lastSentInvoice.issuerData.nif}</sf:IDEmisorFactura>
                        <sf:NumSerieFactura>${lastSentInvoice.invoiceNumber}</sf:NumSerieFactura>
                        <sf:FechaExpedicionFactura>${formatDateToAEAT(lastSentInvoice.date)}</sf:FechaExpedicionFactura>
                        <sf:Huella>${lastSentInvoice.huella}</sf:Huella>
                     </sf:RegistroAnterior>`;
  } else {
    encadenamientoXml = `
                     <sf:PrimerRegistro>S</sf:PrimerRegistro>`;
  }

  const currentDateFormatted = formatDateToAEAT(invoice.date);
  const fechaHoraHusoGenRegistro = getFormattedTimestamp();

  // compute huella
  const huella = computeRegistroAlta({
    idEmisorFactura: invoice.issuerData.nif,
    numSerieFactura: invoice.invoiceNumber,
    fechaExpedicionFactura: currentDateFormatted,
    tipoFactura: invoice.tipoFactura || 'F1',
    cuotaTotal: cuotaTotal,
    importeTotal: importeTotal,
    huellaAnterior: lastSentInvoice ? lastSentInvoice.huella : null,
    fechaHoraHusoGenRegistro: fechaHoraHusoGenRegistro
  });

  let rectificativaXml = '';
  let fechaOperacionXml = '';
  if (invoice.operationDate && invoice.operationDate !== invoice.date) {
    fechaOperacionXml = `
               <sf:FechaOperacion>${formatDateToAEAT(invoice.operationDate)}</sf:FechaOperacion>`;
  }

  let destinatarioXml = '';
  const clientNifType = invoice.clientNifType || 'NIF';
  const clientCountryCode = invoice.clientCountryCode || 'ES';

  if (clientNifType === 'NIF') {
    destinatarioXml = `
                  <sf:IDDestinatario>
                     <sf:NombreRazon>${invoice.clientName}</sf:NombreRazon>
                     <sf:NIF>${invoice.clientNif}</sf:NIF>
                  </sf:IDDestinatario>`;
  } else {
    destinatarioXml = `
                  <sf:IDDestinatario>
                     <sf:NombreRazon>${invoice.clientName}</sf:NombreRazon>
                     <sf:IDOtro>
                        <sf:CodigoPais>${clientCountryCode}</sf:CodigoPais>
                        <sf:IDType>${clientNifType}</sf:IDType>
                        <sf:ID>${invoice.clientNif}</sf:ID>
                     </sf:IDOtro>
                  </sf:IDDestinatario>`;
  }

  const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:sf="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd"
                  xmlns:sfLR="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd">
   <soapenv:Header/>
   <soapenv:Body>
      <sfLR:RegFactuSistemaFacturacion>
         <sfLR:Cabecera>
            <sf:ObligadoEmision>
               <sf:NombreRazon>${invoice.issuerData.name}</sf:NombreRazon>
               <sf:NIF>${invoice.issuerData.nif}</sf:NIF>
            </sf:ObligadoEmision>
         </sfLR:Cabecera>
         <sfLR:RegistroFactura>
            <sf:RegistroAlta>
               <sf:IDVersion>1.0</sf:IDVersion>
               <sf:IDFactura>
                  <sf:IDEmisorFactura>${invoice.issuerData.nif}</sf:IDEmisorFactura>
                  <sf:NumSerieFactura>${invoice.invoiceNumber}</sf:NumSerieFactura>
                  <sf:FechaExpedicionFactura>${currentDateFormatted}</sf:FechaExpedicionFactura>
               </sf:IDFactura>
               <sf:NombreRazonEmisor>${invoice.issuerData.name}</sf:NombreRazonEmisor>
               <sf:TipoFactura>${invoice.tipoFactura || 'F1'}</sf:TipoFactura>${rectificativaXml}${fechaOperacionXml}
               <sf:DescripcionOperacion>${invoice.notes || 'Prestació de serveis musicals/artístics'}</sf:DescripcionOperacion>
               <sf:Destinatarios>
                  ${destinatarioXml}
               </sf:Destinatarios>
               <sf:Desglose>
                  ${detailsXml}
               </sf:Desglose>
               <sf:CuotaTotal>${cuotaTotal}</sf:CuotaTotal>
               <sf:ImporteTotal>${importeTotal}</sf:ImporteTotal>
               <sf:Encadenamiento>
                  ${encadenamientoXml}
               </sf:Encadenamiento>
               <sf:SistemaInformatico>
                  <sf:NombreRazon>Jordi Bonilla Julia</sf:NombreRazon>
                  <sf:NIF>40936132L</sf:NIF>
                  <sf:NombreSistemaInformatico>Hemiolia App</sf:NombreSistemaInformatico>
                  <sf:IdSistemaInformatico>01</sf:IdSistemaInformatico>
                  <sf:Version>1.0</sf:Version>
                  <sf:NumeroInstalacion>01</sf:NumeroInstalacion>
                  <sf:TipoUsoPosibleSoloVerifactu>S</sf:TipoUsoPosibleSoloVerifactu>
                  <sf:TipoUsoPosibleMultiOT>N</sf:TipoUsoPosibleMultiOT>
                  <sf:IndicadorMultiplesOT>N</sf:IndicadorMultiplesOT>
               </sf:SistemaInformatico>
               <sf:FechaHoraHusoGenRegistro>${fechaHoraHusoGenRegistro}</sf:FechaHoraHusoGenRegistro>
               <sf:TipoHuella>01</sf:TipoHuella>
               <sf:Huella>${huella}</sf:Huella>
            </sf:RegistroAlta>
         </sfLR:RegistroFactura>
      </sfLR:RegFactuSistemaFacturacion>
   </soapenv:Body>
</soapenv:Envelope>`.trim();

  console.log('--- XML Payload ---');
  console.log(xmlPayload);
  console.log('-------------------');

  console.log('Sending SOAP request...');
  const res = await postSOAP(xmlPayload, config, p12Buffer);
  console.log('Response Status:', res.statusCode);
  console.log('--- SOAP Response Body ---');
  console.log(res.body);
  console.log('--------------------------');
}

run().catch(console.error);
