import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { getInvoiceById, updateInvoiceStatus } from '@/lib/firestoreUtils';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { computeRegistroAlta } from '@kreyo/verifactu-hash-calculator';
import { verifySessionOrToken } from '@/lib/serverAuth';

function formatDateToAEAT(dateStr) {
  // input is YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
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
  
  // Get timezone offset in format +HH:MM or -HH:MM
  const offset = -now.getTimezoneOffset();
  const offsetSign = offset >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMinutes = pad(Math.abs(offset) % 60);
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
}

function postSOAP(xmlPayload, config, p12Buffer, isProduction = false) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({
      pfx: p12Buffer,
      passphrase: config.password,
      rejectUnauthorized: false
    });

    const reqOptions = {
      hostname: isProduction ? 'www1.agenciatributaria.gob.es' : 'prewww1.aeat.es',
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

export async function POST(request) {
  try {
    // Verify authorization (only admins are allowed to send invoices to AEAT)
    const session = await verifySessionOrToken(request, ['admin']);
    if (!session) {
      return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceId, isProduction } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: "Falta el camp 'invoiceId' al cos de la petició." }, { status: 400 });
    }

    // 1. Obtenir la factura a enviar de Firestore
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: `No s'ha trobat cap factura amb ID ${invoiceId}.` }, { status: 404 });
    }

    if (invoice.status === 'Enviada') {
      return NextResponse.json({ error: "Aquesta factura ja ha estat enviada i validada correctament per l'AEAT." }, { status: 400 });
    }

    // 2. Determinar emissor i configurar certificat digital
    const certConfigs = {
      JB: {
        filename: 'BONILLA_JULIA_JORDI___40936132L.p12',
        password: process.env.CERT_PASSWORD_JORDI || 'Garret1n',
        name: 'Jordi Bonilla Julià'
      },
      PM: {
        filename: 'MARTI_FANDOS_PAULA___78582484V.p12',
        password: process.env.CERT_PASSWORD_PAULA || '=na&Pau1a',
        name: 'Paula Martí Fandos'
      }
    };

    const config = certConfigs[invoice.issuerId];
    if (!config) {
      return NextResponse.json({ error: `Emissor '${invoice.issuerId}' no configurat.` }, { status: 400 });
    }

    // Local cert path first, then external disk fallback
    let certPath = path.join(process.cwd(), 'certs', config.filename);
    if (!fs.existsSync(certPath)) {
      certPath = path.join('/Volumes/ARXIUS/jordibonilla/Documents Jordi Bonilla/PERSONAL/DOCUMENTS/CERTIFICATS DIGITALS', config.filename);
    }
    if (!fs.existsSync(certPath)) {
      return NextResponse.json({ 
        error: `No s'ha pogut trobar el certificat digital de ${config.name} a la ruta externa. Si us plau, comprova que el disc extern /Volumes/ARXIUS estigui connectat.`,
        path: certPath
      }, { status: 500 });
    }

    let p12Buffer;
    try {
      p12Buffer = fs.readFileSync(certPath);
    } catch (readErr) {
      return NextResponse.json({ 
        error: `Error en llegir el fitxer del certificat a la ruta: ${certPath}`,
        details: readErr.message
      }, { status: 500 });
    }

    // 3. Obtenir la darrera factura enviada per al mateix emissor (Encadenament)
    const snapshot = await getDocs(collection(db, 'invoices'));
    const allInvoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const targetEnv = isProduction ? 'production' : 'test';
    const issuerInvoices = allInvoices.filter(inv => 
      inv.issuerId === invoice.issuerId && 
      inv.status === 'Enviada' && 
      inv.huella &&
      (inv.verifactuEnv === targetEnv || (!inv.verifactuEnv && targetEnv === 'production'))
    );

    // Ordenar per data de tramesa (sentAt) descendent per agafar la darrera enviada cronològicament
    issuerInvoices.sort((a, b) => {
      const timeA = a.sentAt ? new Date(a.sentAt).getTime() : (a.fechaHoraHusoGenRegistro ? new Date(a.fechaHoraHusoGenRegistro).getTime() : 0);
      const timeB = b.sentAt ? new Date(b.sentAt).getTime() : (b.fechaHoraHusoGenRegistro ? new Date(b.fechaHoraHusoGenRegistro).getTime() : 0);
      return timeB - timeA;
    });

    const lastSentInvoice = issuerInvoices[0];

    // 4. Agrupar línies per IVA o Exempció per generar el Desglose XML
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
    const importeTotal = (baseTotalNum + cuotaTotalNum).toFixed(2); // strictly Base + IVA

    // 5. Preparar dades d'encadenament
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

    // 6. Calcular petjada (huella) de la factura actual
    let huella;
    try {
      huella = computeRegistroAlta({
        idEmisorFactura: invoice.issuerData.nif,
        numSerieFactura: invoice.invoiceNumber,
        fechaExpedicionFactura: currentDateFormatted,
        tipoFactura: invoice.tipoFactura || 'F1',
        cuotaTotal: cuotaTotal,
        importeTotal: importeTotal,
        huellaAnterior: lastSentInvoice ? lastSentInvoice.huella : null,
        fechaHoraHusoGenRegistro: fechaHoraHusoGenRegistro
      });
    } catch (hashErr) {
      console.error('Error calculant la petjada hash:', hashErr);
      return NextResponse.json({ 
        error: "Error intern calculant la signatura petjada de la factura.",
        details: hashErr.message 
      }, { status: 500 });
    }

    // Define dynamic rectificativa block
    let rectificativaXml = '';
    const tipoFactura = invoice.tipoFactura || 'F1';
    if (tipoFactura.startsWith('R')) {
      rectificativaXml = `
               <sf:TipoRectificativa>${invoice.rectificationType || 'I'}</sf:TipoRectificativa>
               <sf:FacturasRectificadas>
                  <sf:IDFacturaRectificada>
                     <sf:IDEmisorFactura>${invoice.issuerData.nif}</sf:IDEmisorFactura>
                     <sf:NumSerieFactura>${invoice.rectifiedInvoiceNumber}</sf:NumSerieFactura>
                     <sf:FechaExpedicionFactura>${formatDateToAEAT(invoice.rectifiedInvoiceDate)}</sf:FechaExpedicionFactura>
                  </sf:IDFacturaRectificada>
               </sf:FacturasRectificadas>`;
    }

    // Define dynamic FechaOperacion block
    let fechaOperacionXml = '';
    if (invoice.operationDate && invoice.operationDate !== invoice.date) {
      fechaOperacionXml = `
               <sf:FechaOperacion>${formatDateToAEAT(invoice.operationDate)}</sf:FechaOperacion>`;
    }

    // Define dynamic destinatario block
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

    // 7. Construir SOAP XML Payload
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
               <sf:TipoFactura>${tipoFactura}</sf:TipoFactura>${rectificativaXml}${fechaOperacionXml}
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

    // 8. Enviar per HTTPS amb TLS Mútua
    console.log(`[Verifactu] Envia factura ${invoice.invoiceNumber} a l'AEAT...`);
    console.log('XML Payload:\n', xmlPayload);
    const soapRes = await postSOAP(xmlPayload, config, p12Buffer, isProduction);
    console.log(`[Verifactu] Resposta AEAT rebuda amb estat ${soapRes.statusCode}`);
    
    // Parse resposta per validar correctament
    const responseBody = soapRes.body;
    const estadoMatch = responseBody.match(/<EstadoRegistro>([^<]+)<\/EstadoRegistro>/i) || responseBody.match(/<[^:]+:EstadoRegistro>([^<]+)<\/[^:]+:EstadoRegistro>/i);
    const estado = estadoMatch ? estadoMatch[1].trim() : null;

    console.log(`[Verifactu] EstadoRegistro AEAT: ${estado}`);

    if (estado === 'Correcto' || estado === 'AceptadoConErrores' || responseBody.includes('Correcto') || responseBody.includes('AceptadoConErrores')) {
      // Extreure CSV o IdPeticion si existeixen
      const csvMatch = responseBody.match(/<CSV>([^<]+)<\/CSV>/i) || responseBody.match(/<[^:]+:CSV>([^<]+)<\/[^:]+:CSV>/i);
      const idPeticionMatch = responseBody.match(/<IdPeticion>([^<]+)<\/IdPeticion>/i) || responseBody.match(/<[^:]+:IdPeticion>([^<]+)<\/[^:]+:IdPeticion>/i);
      const verifactuId = csvMatch ? csvMatch[1].trim() : (idPeticionMatch ? idPeticionMatch[1].trim() : `VF-${Date.now()}`);

      // 9. Actualitzar factura a Firestore
      await updateInvoiceStatus(invoiceId, {
        status: 'Enviada',
        verifactuId: verifactuId,
        sentAt: new Date().toISOString(),
        huella: huella,
        fechaHoraHusoGenRegistro: fechaHoraHusoGenRegistro,
        verifactuEnv: isProduction ? 'production' : 'test'
      });

      return NextResponse.json({
        success: true,
        status: 'Enviada',
        verifactuId,
        huella,
        fechaHoraHusoGenRegistro
      });
    } else {
      // Intentar obtenir detalls de l'error del SOAP
      const errorDescMatch = responseBody.match(/<DescripcionErrorRegistro>([^<]+)<\/DescripcionErrorRegistro>/i) || responseBody.match(/<[^:]+:DescripcionErrorRegistro>([^<]+)<\/[^:]+:DescripcionErrorRegistro>/i);
      const errorCodeMatch = responseBody.match(/<CodigoErrorRegistro>([^<]+)<\/CodigoErrorRegistro>/i) || responseBody.match(/<[^:]+:CodigoErrorRegistro>([^<]+)<\/[^:]+:CodigoErrorRegistro>/i);
      const errorDesc = errorDescMatch ? errorDescMatch[1].trim() : 'Error de validació de l\'AEAT.';
      const errorCode = errorCodeMatch ? errorCodeMatch[1].trim() : 'Desconegut';

      console.error(`[Verifactu] Error de l'AEAT: ${errorCode} - ${errorDesc}`);
      
      // Desar l'estat d'error a Firestore sense bloquejar
      await updateInvoiceStatus(invoiceId, {
        status: 'Error',
        lastError: `${errorCode}: ${errorDesc}`,
        lastAttemptAt: new Date().toISOString()
      });

      return NextResponse.json({
        error: `Hisenda ha rebutjat la factura: ${errorDesc} (Codi: ${errorCode})`,
        xmlResponse: responseBody
      }, { status: 400 });
    }

  } catch (err) {
    console.error('[Verifactu] Error intern general:', err);
    return NextResponse.json({ 
      error: "Error intern del servidor al processar l'enviament a Verifactu.",
      details: err.message 
    }, { status: 500 });
  }
}
