import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { verifySessionOrToken } from '@/lib/serverAuth';

export async function GET(request) {
  // Verify authorization (only admins are allowed to test certificates)
  const session = await verifySessionOrToken(request, ['admin']);
  if (!session) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const issuer = searchParams.get('issuer'); // 'JB' o 'PM'

  if (!issuer || (issuer !== 'JB' && issuer !== 'PM')) {
    return NextResponse.json({ error: "S'ha d'especificar un emissor vàlid ('JB' o 'PM') a la query (?issuer=...)" }, { status: 400 });
  }

  // Configuració de rutes i contrasenyes
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

  const config = certConfigs[issuer];
  const filePath = path.join(certsDir, config.filename);

  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ 
        error: `No s'ha trobat el fitxer de certificat a la ruta especificada.`, 
        path: filePath 
      }, { status: 404 });
    }

    // Llegir fitxer .p12
    const p12Buffer = fs.readFileSync(filePath);
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'), false);
    
    // Intentar desxifrar amb la contrasenya proveïda
    let p12;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, config.password);
    } catch (passwordErr) {
      return NextResponse.json({ 
        error: `La contrasenya per al certificat de ${config.name} és incorrecta.`,
        details: passwordErr.message
      }, { status: 401 });
    }

    // Extreure el certificat i comprovar-ne la validesa i propietari
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = bags[forge.pki.oids.certBag]?.[0];

    if (!certBag || !certBag.cert) {
      return NextResponse.json({ error: "No s'ha trobat cap certificat vàlid dins de l'arxiu PKCS#12." }, { status: 400 });
    }

    const cert = certBag.cert;
    
    // Generar informació útil
    const subject = cert.subject.attributes.map(a => `${a.shortName || a.name || a.type}=${a.value}`).join(', ');
    const issuerInfo = cert.issuer.attributes.map(a => `${a.shortName || a.name || a.type}=${a.value}`).join(', ');
    const validFrom = cert.validity.notBefore;
    const validTo = cert.validity.notAfter;
    
    // Obtenir número de sèrie
    const serialNumber = cert.serialNumber;

    return NextResponse.json({
      success: true,
      titular: config.name,
      certificatsTrobat: true,
      subject,
      emissorCertificat: issuerInfo,
      serialNumber,
      validesa: {
        desDe: validFrom,
        finsA: validTo,
        actiu: new Date() >= new Date(validFrom) && new Date() <= new Date(validTo)
      }
    }, { status: 200 });

  } catch (error) {
    console.error(`Error provant el certificat de ${issuer}:`, error);
    return NextResponse.json({ 
      error: `Error intern en llegir o obrir el certificat.`, 
      details: error.message 
    }, { status: 500 });
  }
}
