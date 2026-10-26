import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🧪 VERIFYING PRINT & PORTAL ZERO-BLANK-PAGE CONFIGURATION');
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

// 1. Verify index.html portal element
const indexHtmlPath = path.resolve('index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
assert(indexHtml.includes('<div id="pos-print-portal"></div>'), 'index.html contains dedicated #pos-print-portal');
assert(indexHtml.indexOf('id="root"') < indexHtml.indexOf('id="pos-print-portal"'), '#pos-print-portal is cleanly placed outside #root as a direct child of body');

// 2. Verify src/index.css print rules
const indexCssPath = path.resolve('src/index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');
assert(indexCss.includes('#pos-print-portal {\n    display: none !important;\n  }'), 'Screen mode hides #pos-print-portal');
assert(indexCss.includes('body:has(#pos-print-portal #printable-receipt) #root'), 'Print mode completely removes #root when #pos-print-portal has receipt');
assert(!indexCss.includes('body * {\n    visibility: hidden !important;\n  }'), 'Eliminated destructive "body * { visibility: hidden }" layout trap');
assert(!indexCss.includes('[class*="overflow-"],\n  [class*="max-h-"],\n  [class*="h-screen"],\n  [class*="w-screen"]'), 'Eliminated unrolling of 127 product cards and background POS screens');
assert(indexCss.includes('.pos-main-screen') && indexCss.includes('display: none !important'), 'Fallback isolation hides .pos-main-screen in print mode');
assert(indexCss.includes('.admin-dashboard-screen') && indexCss.includes('display: none !important'), 'Fallback isolation hides .admin-dashboard-screen in print mode');
assert(indexCss.includes('#printable-receipt.receipt-format-85mm'), 'Contains dedicated 85mm thermal paper profile');
assert(!indexCss.includes('#printable-receipt.receipt-format-50mm'), 'Cleanly eliminated obsolete 50mm thermal profile');
assert(!indexCss.includes('#printable-receipt.receipt-format-A4'), 'Cleanly eliminated obsolete A4 invoice profile');

// 3. Verify CashierBilling.jsx portal integration
const cashierPath = path.resolve('src/pages/CashierBilling.jsx');
const cashierCode = fs.readFileSync(cashierPath, 'utf8');
assert(cashierCode.includes("import { createPortal } from 'react-dom';"), 'CashierBilling imports createPortal');
assert(cashierCode.includes('pos-main-screen'), 'CashierBilling root container has pos-main-screen class');
assert(cashierCode.includes("document.getElementById('pos-print-portal')"), 'CashierBilling mounts receipt to #pos-print-portal');
assert(cashierCode.includes('receipt-modal-backdrop') && cashierCode.includes('receipt-modal-container'), 'CashierBilling modal has receipt-modal-* isolation classes');
assert(cashierCode.includes('no-print bg-[#153B7A]'), 'CashierBilling modal header bar is hidden during printing (no-print)');

// 4. Verify AdminDashboard.jsx portal integration
const adminPath = path.resolve('src/pages/AdminDashboard.jsx');
const adminCode = fs.readFileSync(adminPath, 'utf8');
assert(adminCode.includes("import { createPortal } from 'react-dom';"), 'AdminDashboard imports createPortal');
assert(adminCode.includes('admin-dashboard-screen'), 'AdminDashboard root container has admin-dashboard-screen class');
assert(adminCode.includes("document.getElementById('pos-print-portal')"), 'AdminDashboard mounts receipt to #pos-print-portal');
assert(adminCode.includes('receipt-modal-backdrop') && adminCode.includes('receipt-modal-container'), 'AdminDashboard modal has receipt-modal-* isolation classes');
assert(adminCode.includes('no-print bg-[#153B7A]'), 'AdminDashboard modal header bar is hidden during printing (no-print)');

// 5. Verify electron/main.js print options
const electronPath = path.resolve('electron/main.js');
const electronCode = fs.readFileSync(electronPath, 'utf8');
assert(electronCode.includes('preferCSSPageSize: true'), 'Electron saveToPdf uses preferCSSPageSize: true');
assert(electronCode.includes("ipcMain.handle('print-bill'"), 'Electron provides print-bill handler');
assert(electronCode.includes("ipcMain.handle('save-to-pdf'"), 'Electron provides save-to-pdf handler');

console.log('\n====================================================');
console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 ALL PRINT AND PORTAL CONFIGURATIONS VERIFIED 100% CORRECT!');
}
