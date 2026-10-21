import { calculateLineTotal, roundMoney } from '../server/utils/unitCalc.js';

function assert(condition, message) {
  if (condition) {
    console.log(`✔ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('Running 12 Unit & Weight Calculation Verification Tests:');

// TEST 1: Product price = ₹200/kg, Quantity = 1 kg, Expected amount = ₹200.00
const p1 = { measurementType: 'KG', pricePerKg: 200, sellingPrice: 200 };
const r1 = calculateLineTotal(p1, 1, 'kg');
assert(r1.lineTotal === 200.00, `TEST 1: 1 kg @ ₹200/kg = ₹${r1.lineTotal} (expected: 200.00)`);

// TEST 2: Product price = ₹200/kg, Quantity = 500 g, Expected amount = ₹100.00
const r2 = calculateLineTotal(p1, 500, 'g');
assert(r2.lineTotal === 100.00, `TEST 2: 500 g @ ₹200/kg = ₹${r2.lineTotal} (expected: 100.00)`);

// TEST 3: Product price = ₹200/kg, Quantity = 250 g, Expected amount = ₹50.00
const r3 = calculateLineTotal(p1, 250, 'g');
assert(r3.lineTotal === 50.00, `TEST 3: 250 g @ ₹200/kg = ₹${r3.lineTotal} (expected: 50.00)`);

// TEST 4: Product price = ₹200/kg, Quantity = 150 g, Expected amount = ₹30.00
const r4 = calculateLineTotal(p1, 150, 'g');
assert(r4.lineTotal === 30.00, `TEST 4: 150 g @ ₹200/kg = ₹${r4.lineTotal} (expected: 30.00)`);

// TEST 5: Product price = ₹360/kg, Quantity = 150 g, Expected amount = ₹54.00
const p5 = { measurementType: 'KG', pricePerKg: 360, sellingPrice: 360 };
const r5 = calculateLineTotal(p5, 150, 'g');
assert(r5.lineTotal === 54.00, `TEST 5: 150 g @ ₹360/kg = ₹${r5.lineTotal} (expected: 54.00)`);

// TEST 6: Product price = ₹50/kg, Quantity = 250 g, Expected amount = ₹12.50
const p6 = { measurementType: 'KG', pricePerKg: 50, sellingPrice: 50 };
const r6 = calculateLineTotal(p6, 250, 'g');
assert(r6.lineTotal === 12.50, `TEST 6: 250 g @ ₹50/kg = ₹${r6.lineTotal} (expected: 12.50)`);

// TEST 7: Product price = ₹200/kg, Quantity = 1.25 kg, Expected amount = ₹250.00
const r7 = calculateLineTotal(p1, 1.25, 'kg');
assert(r7.lineTotal === 250.00, `TEST 7: 1.25 kg @ ₹200/kg = ₹${r7.lineTotal} (expected: 250.00)`);

// TEST 8: Piece-based product price = ₹25 per piece, Quantity = 2 pieces, Expected amount = ₹50.00
const p8 = { measurementType: 'PCS', sellingPrice: 25, pricePerKg: null };
const r8 = calculateLineTotal(p8, 2, 'pcs');
assert(r8.lineTotal === 50.00, `TEST 8: 2 pieces @ ₹25/piece = ₹${r8.lineTotal} (expected: 50.00)`);
assert(r8.canonicalQty === 2, `TEST 8: canonicalQty is 2, not divided by 1000`);

// Custom quantities:
// 75 g @ 200/kg = 15.00
const rCustom1 = calculateLineTotal(p1, 75, 'g');
assert(rCustom1.lineTotal === 15.00, `Custom 75g: ${rCustom1.lineTotal} (expected: 15.00)`);

// 125 g @ 200/kg = 25.00
const rCustom2 = calculateLineTotal(p1, 125, 'g');
assert(rCustom2.lineTotal === 25.00, `Custom 125g: ${rCustom2.lineTotal} (expected: 25.00)`);

// 175 g @ 200/kg = 35.00
const rCustom3 = calculateLineTotal(p1, 175, 'g');
assert(rCustom3.lineTotal === 35.00, `Custom 175g: ${rCustom3.lineTotal} (expected: 35.00)`);

// 225 g @ 200/kg = 45.00
const rCustom4 = calculateLineTotal(p1, 225, 'g');
assert(rCustom4.lineTotal === 45.00, `Custom 225g: ${rCustom4.lineTotal} (expected: 45.00)`);

// 350 g @ 200/kg = 70.00
const rCustom5 = calculateLineTotal(p1, 350, 'g');
assert(rCustom5.lineTotal === 70.00, `Custom 350g: ${rCustom5.lineTotal} (expected: 70.00)`);

// 750 g @ 200/kg = 150.00
const rCustom6 = calculateLineTotal(p1, 750, 'g');
assert(rCustom6.lineTotal === 150.00, `Custom 750g: ${rCustom6.lineTotal} (expected: 150.00)`);

// 2.5 kg @ 200/kg = 500.00
const rCustom7 = calculateLineTotal(p1, 2.5, 'kg');
assert(rCustom7.lineTotal === 500.00, `Custom 2.5kg: ${rCustom7.lineTotal} (expected: 500.00)`);

console.log('\nAll formula calculations passed with 100% precision!');
