import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

console.log('====================================================');
console.log('🧪 VERIFYING ANANTHA STORES OFFICIAL LOGO & WATERMARK');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✖ [FAIL] ${message}`);
    failed++;
  }
}

// 1. Verify Image Asset files
console.log('--- TEST GROUP 1: Logo Asset Verification ---');
const publicLogo = path.resolve('public/anantha-stores-logo.png');
const publicLogoTransparent = path.resolve('public/anantha-stores-logo-transparent.png');
const srcLogo = path.resolve('src/assets/anantha-stores-logo.png');

assert(fs.existsSync(publicLogo), 'public/anantha-stores-logo.png exists');
assert(fs.existsSync(publicLogoTransparent), 'public/anantha-stores-logo-transparent.png exists');
assert(fs.existsSync(srcLogo), 'src/assets/anantha-stores-logo.png exists');

const buf = fs.readFileSync(srcLogo);
const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
assert(isPng, 'Asset has valid PNG signature (<Buffer 89 50 4E 47>)');

const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
assert(width === 1024 && height === 682, `Dimensions are high-res 1024x682 (actual: ${width}x${height})`);

// 2. Verify Reusable Component
console.log('\n--- TEST GROUP 2: Reusable AnanthaLogo Component ---');
const componentPath = path.resolve('src/components/AnanthaLogo.jsx');
assert(fs.existsSync(componentPath), 'src/components/AnanthaLogo.jsx exists');

const componentCode = fs.readFileSync(componentPath, 'utf8');
assert(componentCode.includes('ANANTHA_LOGO_SRC'), 'Exports ANANTHA_LOGO_SRC constant');
assert(componentCode.includes('variant'), 'Supports variant prop for flexible styling');
assert(!componentCode.includes('crossOrigin="anonymous"'), 'Does not use problematic crossOrigin="anonymous"');

// 3. Verify All 4 Locations in Code
console.log('\n--- TEST GROUP 3: Four Logo Locations in POS Application ---');

// Location 1: Main Application Headers
const cashierCode = fs.readFileSync(path.resolve('src/pages/CashierBilling.jsx'), 'utf8');
assert(cashierCode.includes('<AnanthaLogo variant="header"'), 'Location 1a: CashierBilling header uses AnanthaLogo');

const adminCode = fs.readFileSync(path.resolve('src/pages/AdminDashboard.jsx'), 'utf8');
assert(adminCode.includes('<AnanthaLogo variant="header"'), 'Location 1b: AdminDashboard header uses AnanthaLogo');

const managerCode = fs.readFileSync(path.resolve('src/pages/ManagerDashboard.jsx'), 'utf8');
assert(managerCode.includes('<AnanthaLogo variant="header"'), 'Location 1c: ManagerDashboard header uses AnanthaLogo');

// Location 2: Login Page Header & Card
const loginCode = fs.readFileSync(path.resolve('src/pages/Login.jsx'), 'utf8');
assert(loginCode.includes('<AnanthaLogo variant="header"'), 'Location 1d: Login top header uses AnanthaLogo');
assert(loginCode.includes('<AnanthaLogo variant="login"'), 'Location 2: Login card uses AnanthaLogo above "Sign In to Terminal"');

// Location 3: Billing Receipt Header
const receiptCode = fs.readFileSync(path.resolve('src/components/Receipt.jsx'), 'utf8');
assert(receiptCode.includes('<AnanthaLogo'), 'Location 3: Receipt header imports and renders AnanthaLogo');
assert(receiptCode.includes('variant="receipt"'), 'Location 3: Receipt header uses variant="receipt"');
assert(!receiptCode.includes('crossOrigin="anonymous"'), 'Location 3: Receipt removed crossOrigin="anonymous" to eliminate CORS errors');

// Location 4: Receipt Watermark
assert(receiptCode.includes('variant="watermark"'), 'Location 4: Receipt watermark renders AnanthaLogo with variant="watermark"');
assert(receiptCode.includes('pointer-events-none'), 'Location 4: Watermark has pointer-events-none');
assert(receiptCode.includes('opacity: 0.05'), 'Location 4: Watermark uses subtle 0.05 opacity');
assert(receiptCode.includes('showWatermark &&'), 'Location 4: Watermark is controlled by showWatermark checkbox');

// 4. Test SSR Component Rendering for Receipt & Watermark
console.log('\n--- TEST GROUP 4: Receipt SSR Render & Watermark Toggle ---');
const viteServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

const { default: Receipt } = await viteServer.ssrLoadModule('./src/components/Receipt.jsx');

const testBill = {
  billNumber: 'AS000099',
  subtotal: 100.0,
  grandTotal: 100.0,
  paymentMethod: 'CASH',
  createdAt: new Date().toISOString(),
  items: [
    {
      productName: 'Sample Tea 250g',
      quantity: 1,
      billedRate: 100.0,
      lineTotal: 100.0,
    },
  ],
};

// Render with watermark ON
const htmlWithWatermark = ReactDOMServer.renderToString(
  React.createElement(Receipt, { bill: testBill, showWatermark: true })
);
assert(htmlWithWatermark.includes('receipt-watermark'), 'Watermark container renders when showWatermark=true');
assert(htmlWithWatermark.includes('opacity:0.05') || htmlWithWatermark.includes('opacity: 0.05'), 'Watermark rendered with 5% opacity');

// Count rendered logo img tags when watermark is ON
const imgMatchesWithWm = htmlWithWatermark.match(/<img[^>]+anantha-stores-logo[^>]*>/g) || [];
assert(imgMatchesWithWm.length === 2, `Renders exactly 2 logo images when watermark is ON (Header + Watermark) - actual: ${imgMatchesWithWm.length}`);

// Render with watermark OFF
const htmlWithoutWatermark = ReactDOMServer.renderToString(
  React.createElement(Receipt, { bill: testBill, showWatermark: false })
);
assert(!htmlWithoutWatermark.includes('receipt-watermark'), 'Watermark container is completely removed when showWatermark=false');

const imgMatchesWithoutWm = htmlWithoutWatermark.match(/<img[^>]+anantha-stores-logo[^>]*>/g) || [];
assert(imgMatchesWithoutWm.length === 1, `Renders exactly 1 logo image when watermark is OFF (Header only) - actual: ${imgMatchesWithoutWm.length}`);

await viteServer.close();

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL LOGO AND WATERMARK CHECKS PASSED PERFECTLY!');
}
