import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import signpdf from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';

export async function POST(req) {
  try {
    const { pdfBase64, issuerNif } = await req.json();

    if (!pdfBase64 || !issuerNif) {
      return NextResponse.json({ error: 'Missing pdfBase64 or issuerNif' }, { status: 400 });
    }

    let p12FileName = '';
    let certPassword = '';

    // Choose the certificate based on the issuer's NIF
    if (issuerNif === '40936132L') {
      p12FileName = 'BONILLA_JULIA_JORDI___40936132L.p12';
      certPassword = process.env.CERT_PASSWORD_JORDI || '';
    } else if (issuerNif === '78582484V') {
      p12FileName = 'MARTI_FANDOS_PAULA___78582484V.p12';
      certPassword = process.env.CERT_PASSWORD_PAULA || '';
    } else {
      return NextResponse.json({ error: 'Certificat no trobat per a aquest NIF emissor.' }, { status: 404 });
    }

    if (!certPassword) {
      return NextResponse.json({ error: 'No s\'ha configurat la contrasenya del certificat a .env.local' }, { status: 500 });
    }

    const certPath = path.join(process.cwd(), 'certs', p12FileName);
    
    if (!fs.existsSync(certPath)) {
      return NextResponse.json({ error: `No s'ha trobat l'arxiu del certificat a ${certPath}` }, { status: 500 });
    }

    // Convert PDF from Base64 to Buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Load PDF Document with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Add signature placeholder
    pdflibAddPlaceholder({
      pdfDoc,
      reason: 'Aprovacio de pressupost Hemiolia',
      contactInfo: 'info@hemiolia.cat',
      name: issuerNif === '40936132L' ? 'Jordi Bonilla Julia' : 'Paula Marti Fandos',
      location: 'Tortosa, Espanya',
      signatureLength: 16384 // Ensure signature placeholder is big enough for large certificate chains (e.g. FNMT)
    });

    // Save PDF Document with placeholder
    const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

    // Load P12 Certificate
    const p12Buffer = fs.readFileSync(certPath);

    // Initialize signer
    const signer = new P12Signer(p12Buffer, { passphrase: certPassword });

    // Sign the PDF
    const signedPdfBuffer = await signpdf.sign(pdfWithPlaceholder, signer);

    // Convert signed PDF to Base64
    const signedPdfBase64 = Buffer.from(signedPdfBuffer).toString('base64');

    return NextResponse.json({ signedPdfBase64 }, { status: 200 });
  } catch (error) {
    console.error('Error signing PDF:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
