import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

const viteServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
});
const { default: Receipt } = await viteServer.ssrLoadModule('./src/components/Receipt.jsx');

async function runReceiptTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPACT RECEIPT SPECIFICATION TESTS');
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

  // Base test transaction (Bill AS000028 data)
  const testBill = {
    billNumber: 'AS000028',
    subtotal: 347.0,
    grandTotal: 347.0,
    paymentMethod: 'CASH',
    amountReceived: 500.0,
    changeAmount: 153.0,
    createdAt: '2026-10-15T07:27:09.312Z',
    cashier: { fullName: 'Murugan (Billing Cashier)' },
    customer: { name: 'Maharaja T' },
    items: [
      {
        productName: 'Aashirvaad Shudh Chakki Atta 5kg',
        quantity: 1,
        billedRate: 275.0,
        lineTotal: 275.0,
        product: { tamilName: 'ஆசீர்வாத் கோதுமை மாவு' },
      },
      {
        productName: 'Aachi Pure Red Chilli Powder 200g',
        quantity: 1,
        billedRate: 72.0,
        lineTotal: 72.0,
        product: { tamilName: 'ஆச்சி தூய தனி மிளகாய் தூள் 200கி' },
      },
    ],
  };

  const html = ReactDOMServer.renderToString(
    React.createElement(Receipt, { bill: testBill, receiptFormat: '85mm', showWatermark: true })
  );

  console.log('--- TEST GROUP 1: Removal of Unnecessary Details ---');
  assert(!html.includes('AS000028'), 'Bill Number AS000028 is NOT displayed on the receipt');
  assert(!html.includes('Bill No') && !html.includes('ரசீது எண்'), 'Bill Number label is NOT displayed on the receipt');
  assert(!html.includes('Murugan') && !html.includes('Cashier') && !html.includes('பில் போட்டவர்'), 'Cashier/Biller name is NOT displayed on the receipt');

  console.log('\n--- TEST GROUP 2: Store Header Branding ---');
  assert(html.includes('ANANTHA STORES'), 'Displays English Shop Name: ANANTHA STORES');
  assert(html.includes('ஆனந்தா ஸ்டோர்ஸ்'), 'Displays Tamil Shop Name: ஆனந்தா ஸ்டோர்ஸ்');
  assert(html.includes('கிழக்கு ரத வீதி, குருவிகுளம், தமிழ்நாடு - 627754'), 'Displays official Tamil address');
  assert(html.includes('8072339369'), 'Displays Phone: 8072339369');
  assert(html.includes('தரம் • நியாயமான விலை • சிறந்த சேவை'), 'Displays Tagline');
  assert(html.includes('#FFF5D6'), 'Tagline is in pale-yellow banner');
  assert(html.includes('anantha-stores-logo'), 'Displays official store logo');
  assert(!html.includes('crossorigin="anonymous"'), 'Logo renders cleanly without CORS/crossorigin blocking');

  console.log('\n--- TEST GROUP 3: Bill Details (Date/Time & Customer) ---');
  assert(html.includes('Date &amp; Time:') || html.includes('Date & Time:'), 'Displays Date & Time');
  assert(html.includes('Customer:') && html.includes('Maharaja T'), 'Displays Customer Name when available');

  // Verify walk-in customer suppresses Customer label
  const walkInBill = { ...testBill, customer: null, customerName: 'Walk-in' };
  const htmlWalkIn = ReactDOMServer.renderToString(
    React.createElement(Receipt, { bill: walkInBill, receiptFormat: '85mm' })
  );
  assert(!htmlWalkIn.includes('Customer:'), 'Omits Customer label completely for walk-in / empty customer');

  console.log('\n--- TEST GROUP 4: Compact Product Table ---');
  assert(html.includes('<table'), 'Product details rendered in HTML table');
  assert(html.includes('Product Name'), 'Table header has Product Name');
  assert(html.includes('Qty'), 'Table header has Qty');
  assert(html.includes('Price'), 'Table header has Price');
  assert(html.includes('Amount'), 'Table header has Amount');
  assert(html.includes('Aashirvaad Shudh Chakki Atta 5kg'), 'Item 1 name displayed');
  assert(html.includes('₹275.00'), 'Item 1 line total displayed');
  assert(html.includes('Aachi Pure Red Chilli Powder 200g'), 'Item 2 name displayed');
  assert(html.includes('₹72.00'), 'Item 2 line total displayed');

  console.log('\n--- TEST GROUP 5: Bill Totals ---');
  assert(html.includes('Subtotal:') && html.includes('₹347.00'), 'Displays Subtotal ₹347.00');
  assert(html.includes('Grand Total') && html.includes('செலுத்த வேண்டிய மொத்தம்:'), 'Displays Grand Total and Tamil label');
  assert(html.includes('bg-[#EAF4FF]') || html.includes('border-[#B9DCFF]'), 'Grand Total has prominent styling');

  console.log('\n--- TEST GROUP 6: Payment Method - CASH ---');
  const cashBill = {
    ...testBill,
    paymentMethod: 'CASH',
    amountReceived: 500.0,
    changeAmount: 225.0,
    grandTotal: 275.0,
  };
  const htmlCash = ReactDOMServer.renderToString(
    React.createElement(Receipt, { bill: cashBill, receiptFormat: '85mm' })
  );
  assert(htmlCash.includes('Mode of Payment:') && htmlCash.includes('CASH'), 'Displays "Mode of Payment: CASH"');
  assert(htmlCash.includes('Cash Received:') && htmlCash.includes('₹500.00'), 'Displays "Cash Received: ₹500.00"');
  assert(htmlCash.includes('Change Returned:') && htmlCash.includes('₹225.00'), 'Displays "Change Returned: ₹225.00"');

  console.log('\n--- TEST GROUP 7: Payment Method - UPI ---');
  const upiBill = {
    ...testBill,
    paymentMethod: 'UPI',
    amountReceived: 347.0,
    changeAmount: 0.0,
  };
  const htmlUpi = ReactDOMServer.renderToString(
    React.createElement(Receipt, { bill: upiBill, receiptFormat: '85mm' })
  );
  assert(htmlUpi.includes('Mode of Payment:') && htmlUpi.includes('UPI'), 'Displays "Mode of Payment: UPI"');
  assert(!htmlUpi.includes('Cash Received:'), 'UPI does NOT display cash received');
  assert(!htmlUpi.includes('Change Returned:'), 'UPI does NOT display cash change');

  console.log('\n--- TEST GROUP 8: Payment Method - CARD ---');
  const cardBill = {
    ...testBill,
    paymentMethod: 'CARD',
    amountReceived: 347.0,
    changeAmount: 0.0,
  };
  const htmlCard = ReactDOMServer.renderToString(
    React.createElement(Receipt, { bill: cardBill, receiptFormat: '85mm' })
  );
  assert(htmlCard.includes('Mode of Payment:') && htmlCard.includes('CARD'), 'Displays "Mode of Payment: CARD"');
  assert(!htmlCard.includes('Cash Received:'), 'CARD does NOT display cash received');
  assert(!htmlCard.includes('Change Returned:'), 'CARD does NOT display cash change');

  console.log('\n--- TEST GROUP 9: Payment Method - CREDIT ---');
  const creditBill = {
    ...testBill,
    paymentMethod: 'CREDIT',
    outstandingBalance: 1450.0,
    amountReceived: 0.0,
    changeAmount: 0.0,
  };
  const htmlCredit = ReactDOMServer.renderToString(
    React.createElement(Receipt, { bill: creditBill, receiptFormat: '85mm' })
  );
  assert(htmlCredit.includes('Mode of Payment:') && htmlCredit.includes('CREDIT'), 'Displays "Mode of Payment: CREDIT"');
  assert(htmlCredit.includes('Outstanding Balance:') && htmlCredit.includes('₹1450.00'), 'Displays "Outstanding Balance: ₹1450.00"');
  assert(!htmlCredit.includes('Cash Received:'), 'CREDIT does NOT display cash received');
  assert(!htmlCredit.includes('Change Returned:'), 'CREDIT does NOT display cash change');

  console.log('\n--- TEST GROUP 10: Payment Method - SPLIT PAYMENT ---');
  const splitBill = {
    ...testBill,
    paymentMethod: 'SPLIT',
    payments: [
      { paymentMethod: 'CASH', amount: 200.0 },
      { paymentMethod: 'UPI', amount: 75.0 },
    ],
    amountReceived: 200.0,
    changeAmount: 0.0,
  };
  const htmlSplit = ReactDOMServer.renderToString(
    React.createElement(Receipt, { bill: splitBill, receiptFormat: '85mm' })
  );
  assert(htmlSplit.includes('Mode of Payment:') && htmlSplit.includes('SPLIT PAYMENT'), 'Displays "Mode of Payment: SPLIT PAYMENT"');
  assert(htmlSplit.includes('CASH:') && htmlSplit.includes('₹200.00'), 'Displays Cash ₹200.00 component');
  assert(htmlSplit.includes('UPI:') && htmlSplit.includes('₹75.00'), 'Displays UPI ₹75.00 component');
  assert(htmlSplit.includes('CASH ₹200.00 + UPI ₹75.00'), 'Displays inline split summary "CASH ₹200.00 + UPI ₹75.00"');

  console.log('\n--- TEST GROUP 11: Footer ---');
  assert(html.includes('🚚 வீட்டிற்கே டெலிவரி வசதி உண்டு!'), 'Displays delivery message');
  assert(html.includes('நன்றி! மீண்டும் வருக!'), 'Displays Tamil thank-you greeting');
  assert(html.includes('Thank You! Please Visit Again!'), 'Displays English thank-you greeting');

  console.log('\n--- TEST GROUP 12: Dedicated 85mm Thermal Printing Profile ---');
  const html85 = ReactDOMServer.renderToString(
    React.createElement(Receipt, { bill: testBill, receiptFormat: '85mm' })
  );
  assert(html85.includes('receipt-format-85mm'), 'Applies receipt-format-85mm class');
  assert(html85.includes('size: 85mm auto'), '@page rule specifies size: 85mm auto; margin: 0');
  assert(!html85.includes('receipt-format-50mm'), '50mm profile is eliminated');
  assert(!html85.includes('receipt-format-A4'), 'A4 profile is eliminated');

  // Verify that even if another format is passed, it safely defaults to 85mm
  const htmlLegacy = ReactDOMServer.renderToString(
    React.createElement(Receipt, { bill: testBill, receiptFormat: '50mm' })
  );
  assert(htmlLegacy.includes('receipt-format-85mm'), 'Permanent default locks to 85mm');
  assert(htmlLegacy.includes('size: 85mm auto'), 'Dynamic @page rule locks to 85mm auto');

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  await viteServer.close();

  if (failed > 0) {
    process.exit(1);
  }
}

await runReceiptTests();
