const fs = require('fs');
const path = require('path');

const dotenvLocalPath = './.env.local';
if (fs.existsSync(dotenvLocalPath)) {
  const envConfig = fs.readFileSync(dotenvLocalPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && !key.startsWith('#')) {
        process.env[key] = val;
      }
    }
  }
}

const { signFacturaeXML } = require('./src/lib/facturaeSigner');

async function main() {
  const xmlString = fs.readFileSync('test_invoice_4.xml', 'utf8');
  const p12Buffer = fs.readFileSync('certs/BONILLA_JULIA_JORDI___40936132L.p12');
  const password = process.env.CERT_PASSWORD_JORDI;

  try {
    const signedXml = await signFacturaeXML(xmlString, p12Buffer, password);
    fs.writeFileSync('test_invoice_4_signed.xml', signedXml);
    console.log('Successfully signed XML. Saved to test_invoice_4_signed.xml');
  } catch (err) {
    console.error('Error signing:', err);
  }
}

main();
