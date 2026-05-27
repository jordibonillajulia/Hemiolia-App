import { NextResponse } from 'next/server';
import { signFacturaeXML } from '../../../../../lib/facturaeSigner';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const { xmlString, issuerNif } = await req.json();

    if (!xmlString || !issuerNif) {
      return NextResponse.json({ error: 'Missing xmlString or issuerNif' }, { status: 400 });
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

    const p12Buffer = fs.readFileSync(certPath);

    const signedXml = await signFacturaeXML(xmlString, p12Buffer, certPassword);

    return NextResponse.json({ signedXml }, { status: 200 });
  } catch (error) {
    console.error('Error signing Facturae:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
