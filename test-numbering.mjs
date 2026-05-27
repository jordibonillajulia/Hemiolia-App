import { formatDisplayInvoiceNumber } from './src/lib/firestoreUtils.js';

console.log('Testing formatDisplayInvoiceNumber:');

const testCases = [
  // ordinary invoice numbers
  { input: '202600000001', issuer: 'JB', expected: 'JB-2026-001' },
  { input: '202600000012', issuer: 'PM', expected: 'PM-2026-012' },
  { input: '202600000123', issuer: 'JB', expected: 'JB-2026-123' },
  // rectifying invoice numbers
  { input: 'REC202600000001', issuer: 'JB', expected: 'JB-REC-2026-001' },
  { input: 'REC202600000025', issuer: 'PM', expected: 'PM-REC-2026-025' },
  // already formatted or invalid numbers
  { input: 'JB-2026-001', issuer: 'JB', expected: 'JB-2026-001' },
  { input: '12345', issuer: 'JB', expected: '12345' },
];

let failed = false;
for (const tc of testCases) {
  const result = formatDisplayInvoiceNumber(tc.input, tc.issuer);
  if (result === tc.expected) {
    console.log(`  ✅ OK: Input: ${tc.input}, Issuer: ${tc.issuer} => ${result}`);
  } else {
    console.error(`  ❌ FAIL: Input: ${tc.input}, Issuer: ${tc.issuer} => Expected: ${tc.expected}, Got: ${result}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('\nAll format tests passed successfully!');
  process.exit(0);
}
