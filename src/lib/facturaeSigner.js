import { Crypto } from '@peculiar/webcrypto';
import * as xmldsigjs from 'xmldsigjs';
import * as xadesjs from 'xadesjs';
import * as forge from 'node-forge';
import crypto from 'crypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const webcrypto = new Crypto();
xadesjs.Application.setEngine('NodeJS', webcrypto);

// Register DOMParser globally so all instances of xml-core (xadesjs and xmldsigjs) can find it
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = DOMParser;
  globalThis.XMLSerializer = XMLSerializer;
}

/**
 * Parses a PKCS#12 buffer and returns the private key (CryptoKey) and certificate (Base64 string).
 */
async function loadP12(p12Buffer, password) {
  // Convert Node Buffer to binary string for node-forge
  const p12Der = p12Buffer.toString('binary');
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  
  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  } catch (e) {
    throw new Error('La contrasenya del certificat és incorrecta o el fitxer està corrupte.');
  }

  let privateKeyForge;
  let certForge;

  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.keyBag || safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        privateKeyForge = safeBag.key;
      } else if (safeBag.type === forge.pki.oids.certBag) {
        certForge = safeBag.cert;
      }
    }
  }

  if (!privateKeyForge || !certForge) {
    throw new Error('No s\'ha pogut extreure la clau privada o el certificat del .p12');
  }

  // Convert forge private key to PEM, then to DER for WebCrypto
  const privateKeyPem = forge.pki.privateKeyToPem(privateKeyForge);
  const privateKeyDer = crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem'
  }).export({ type: 'pkcs8', format: 'der' });

  const cryptoKey = await webcrypto.subtle.importKey(
    'pkcs8',
    privateKeyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['sign']
  );

  // Convert cert to Base64 (DER format)
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certForge)).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  return { cryptoKey, certBase64 };
}

/**
 * Signs a Facturae XML string using XAdES-EPES.
 */
export async function signFacturaeXML(xmlString, p12Buffer, password) {
  const { cryptoKey, certBase64 } = await loadP12(p12Buffer, password);

  const xmlDoc = new DOMParser().parseFromString(xmlString, 'application/xml');

  // Set up XAdES signer
  const signedXml = new xadesjs.SignedXml();
  
  // Define signature policy (Facturae 3.1)
  const policyId = 'http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf';
  const policyHashBase64 = 'Ohixl6upD6av8N7pEvDABhEL6hM='; // SHA-1 of the PDF policy
  
  // Create XAdES-EPES properties
  const xadesProps = signedXml.Properties;
  xadesProps.Target = '#Signature'; // Will match the signature ID
  
  const signedProps = new xadesjs.xml.SignedProperties();
  signedProps.Id = 'SignedPropertiesID';
  xadesProps.SignedProperties = signedProps;

  const sigProps = new xadesjs.xml.SignedSignatureProperties();
  signedProps.SignedSignatureProperties = sigProps;
  
  sigProps.SigningTime = new xadesjs.xml.XadesDateTime();
  sigProps.SigningTime.Value = new Date();

  // Add policy identifier
  const policy = new xadesjs.xml.SignaturePolicyIdentifier();
  const policyIdElem = new xadesjs.xml.SignaturePolicyId();
  policyIdElem.SigPolicyId = new xadesjs.xml.ObjectIdentifier();
  policyIdElem.SigPolicyId.Identifier = new xadesjs.xml.Identifier();
  policyIdElem.SigPolicyId.Identifier.Value = policyId;
  policyIdElem.SigPolicyHash = new xadesjs.xml.DigestAlgAndValueType();
  policyIdElem.SigPolicyHash.DigestMethod = new xmldsigjs.DigestMethod();
  policyIdElem.SigPolicyHash.DigestMethod.Algorithm = 'http://www.w3.org/2000/09/xmldsig#sha1';
  policyIdElem.SigPolicyHash.DigestValue = new Uint8Array(Buffer.from(policyHashBase64, 'base64'));
  policy.SignaturePolicyId = policyIdElem;
  sigProps.SignaturePolicyIdentifier = policy;

  // Properties are already attached to signedXml

  // Set signature algorithm
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

  await signedXml.Sign(
    alg,
    cryptoKey,
    xmlDoc,
    {
      keyValue: cryptoKey,
      x509: [certBase64],
      signingCertificate: certBase64,
      references: [
        { hash: 'SHA-256', transforms: ['enveloped'] }
      ],
      id: 'Signature'
    }
  );

  // Inject signature into XML document
  xmlDoc.documentElement.appendChild(signedXml.GetXml());

  // Serialize back to string
  const signedXmlString = new XMLSerializer().serializeToString(xmlDoc);
  
  // Ensure the XML declaration is present
  if (!signedXmlString.startsWith('<?xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${signedXmlString}`;
  }
  return signedXmlString;
}
