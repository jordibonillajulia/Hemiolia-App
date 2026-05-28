const fs = require('fs');
const path = require('path');
const tls = require('tls');

const jordiCertPath = '/Volumes/ARXIUS/jordibonilla/Documents Jordi Bonilla/PERSONAL/DOCUMENTS/CERTIFICATS DIGITALS/BONILLA_JULIA_JORDI___40936132L.p12';
const paulaCertPath = '/Volumes/ARXIUS/jordibonilla/Documents Jordi Bonilla/PERSONAL/DOCUMENTS/CERTIFICATS DIGITALS/MARTI_FANDOS_PAULA___78582484V.p12';

console.log('Checking Jordi certificate...');
try {
  if (fs.existsSync(jordiCertPath)) {
    console.log('Jordi cert exists.');
    const buf = fs.readFileSync(jordiCertPath);
    console.log('Jordi cert size:', buf.length);
    // Test creating secure context
    const ctx = tls.createSecureContext({
      pfx: buf,
      passphrase: 'Garret1n'
    });
    console.log('Jordi cert loaded successfully into secure context!');
  } else {
    console.log('Jordi cert does NOT exist at path:', jordiCertPath);
  }
} catch (e) {
  console.error('Error with Jordi cert:', e.message);
}

console.log('\nChecking Paula certificate...');
try {
  if (fs.existsSync(paulaCertPath)) {
    console.log('Paula cert exists.');
    const buf = fs.readFileSync(paulaCertPath);
    console.log('Paula cert size:', buf.length);
    // Test creating secure context
    const ctx = tls.createSecureContext({
      pfx: buf,
      passphrase: '=na&Pau1a'
    });
    console.log('Paula cert loaded successfully into secure context!');
  } else {
    console.log('Paula cert does NOT exist at path:', paulaCertPath);
  }
} catch (e) {
  console.error('Error with Paula cert:', e.message);
}
