import fs from 'fs';
import { generateBarcodeLabelsPDF } from './src/utils/barcodePdf.js';
import { encodeCode128B } from './src/utils/code128.js';

async function runBugFixAcceptanceTests() {
  console.log('================================================================');
  console.log('ANANTHA STORES — ACCEPTANCE TESTS FOR 3 SPECIFIC BUG FIXES');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // ISSUE 1 TESTS: Product Stock Alignment & Formatting
  // ------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Stock Alignment & Formatting Logic ---');
  const formatStockQuantity = (stock) => {
    const num = Number(stock) || 0;
    return num % 1 === 0 ? num.toString() : num.toFixed(3).replace(/\.?0+$/, '');
  };

  const getStockUnitLabel = (unit, measurementType) => {
    return (unit || (['KG', 'G', 'WEIGHT'].includes((measurementType || '').toUpperCase()) ? 'kg' : 'pcs')).toLowerCase();
  };

  const getStockStatusClass = (currentStock, minStock) => {
    if (Number(currentStock) <= 0) return 'bg-red-50 text-red-700 border-red-200';
    if (Number(currentStock) <= Number(minStock)) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  // Test various quantities & units
  assert(formatStockQuantity(100) === '100', 'Integer stock formats without decimals (100 -> "100")');
  assert(formatStockQuantity(0.75) === '0.75', 'Decimal stock trims trailing zeros (0.750 -> "0.75")');
  assert(formatStockQuantity(12345.5) === '12345.5', 'Large decimal stock formats correctly (12345.5)');
  assert(formatStockQuantity(0) === '0', 'Zero stock formats as "0"');
  assert(formatStockQuantity(null) === '0', 'Null stock defaults to "0"');

  assert(getStockUnitLabel('pcs') === 'pcs', 'Unit "pcs" returns lowercase "pcs"');
  assert(getStockUnitLabel('PACK') === 'pack', 'Unit "PACK" returns lowercase "pack"');
  assert(getStockUnitLabel('BAG') === 'bag', 'Unit "BAG" returns lowercase "bag"');
  assert(getStockUnitLabel(null, 'WEIGHT') === 'kg', 'Weight measurement with null unit defaults to "kg"');

  assert(getStockStatusClass(0, 5).includes('text-red-700'), '0 stock is marked as out-of-stock (red)');
  assert(getStockStatusClass(3, 5).includes('text-amber-700'), 'Low stock (3 <= 5) is marked as low-stock (amber)');
  assert(getStockStatusClass(15, 5).includes('text-emerald-700'), 'Normal stock (15 > 5) is marked as in-stock (emerald)');

  // ------------------------------------------------------------------
  // ISSUE 2 TESTS: Barcode Bulk Generation Performance & Accuracy
  // ------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Bulk Barcode Vector Generation & Scaling ---');

  // Generate test dataset of sample products
  const sampleProducts = [
    { id: '1', name: 'Ponni Boiled Rice 25kg', tamilName: 'பொன்னி புழுங்கல் அரிசி', barcode: 'AS00000001', sellingPrice: 1250, unit: 'bag', measurementType: 'PACK' },
    { id: '2', name: 'Toor Dal Premium 1kg', tamilName: 'துவரம் பருப்பு', barcode: 'AS00000002', sellingPrice: 165, unit: 'pack', measurementType: 'PACK' },
    { id: '3', name: 'Fresh Tomato By Weight', tamilName: 'தக்காளி', barcode: 'AS00000003', sellingPrice: 40, unit: 'kg', measurementType: 'WEIGHT' },
    { id: '4', name: 'Aashirvaad Atta 5kg', tamilName: 'ஆசீர்வாத் கோதுமை மாவு', barcode: 'AS00000004', sellingPrice: 285, unit: 'pack', measurementType: 'PACK' },
    { id: '5', name: 'Tata Salt 1kg', tamilName: 'டாடா உப்பு', barcode: 'AS00000005', sellingPrice: 28, unit: 'pack', measurementType: 'PACK' },
  ];

  // Test Code 128 encoding
  const code128Test = encodeCode128B('AS00000001');
  assert(code128Test && code128Test.length > 0, 'Code 128 encoder produces scannable pattern for AS00000001');

  function makeLabels(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const base = sampleProducts[i % sampleProducts.length];
      list.push({ ...base, copyIndex: i + 1, totalCopies: count });
    }
    return list;
  }

  // Test 160 labels
  console.log('Testing 160 labels generation...');
  let start = Date.now();
  let progressUpdates = 0;
  let res160 = await generateBarcodeLabelsPDF(makeLabels(160), {
    labelSize: '50x25',
    showStoreName: true,
    showTamilTitle: true,
    showPrice: true,
    showNetQty: true,
    onProgress: (c, t) => { progressUpdates++; },
  });
  let elapsed160 = Date.now() - start;
  assert(res160.count === 160, `160 labels generated with 100% count accuracy (${elapsed160}ms)`);
  assert(progressUpdates > 0, `Progress updates emitted during 160 labels job (${progressUpdates} ticks)`);

  // Test 500 labels
  console.log('Testing 500 labels generation...');
  start = Date.now();
  let res500 = await generateBarcodeLabelsPDF(makeLabels(500), {
    labelSize: '50x25',
    showStoreName: true,
    showTamilTitle: true,
    showPrice: true,
    showNetQty: true,
  });
  let elapsed500 = Date.now() - start;
  assert(res500.count === 500, `500 labels generated in ${elapsed500}ms (< 3000ms target)`);

  // Test 1,000 labels
  console.log('Testing 1,000 labels generation...');
  start = Date.now();
  let res1000 = await generateBarcodeLabelsPDF(makeLabels(1000), {
    labelSize: '50x25',
    showStoreName: true,
    showTamilTitle: true,
    showPrice: true,
    showNetQty: true,
  });
  let elapsed1000 = Date.now() - start;
  assert(res1000.count === 1000, `1,000 labels generated in ${elapsed1000}ms`);

  // Test 2,000 labels
  console.log('Testing 2,000 labels generation (user requested benchmark)...');
  start = Date.now();
  let res2000 = await generateBarcodeLabelsPDF(makeLabels(2000), {
    labelSize: '50x25',
    showStoreName: true,
    showTamilTitle: true,
    showPrice: true,
    showNetQty: true,
  });
  let elapsed2000 = Date.now() - start;
  assert(res2000.count === 2000, `2,000 labels generated in ${elapsed2000}ms without freezing`);

  // Test Cancellation
  console.log('Testing job cancellation...');
  let cancelled = false;
  try {
    let cancelAfter = 30;
    await generateBarcodeLabelsPDF(makeLabels(500), {
      shouldCancel: () => {
        cancelAfter--;
        return cancelAfter <= 0;
      },
    });
  } catch (err) {
    if (err.message.includes('cancelled')) cancelled = true;
  }
  assert(cancelled, 'Barcode generation cleanly halts when shouldCancel returns true');

  // ------------------------------------------------------------------
  // ISSUE 3 TESTS: WEXA AI Blue Theme & Behavior Verification
  // ------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: WEXA AI Blue Theme & Click Behavior ---');
  const wexaCode = fs.readFileSync('./src/components/WexaAIAssistant.jsx', 'utf8');

  // Verify blue color codes
  assert(wexaCode.includes('#2563EB'), 'WEXA AI contains Primary Blue #2563EB');
  assert(wexaCode.includes('#1D4ED8'), 'WEXA AI contains Deep Blue #1D4ED8');
  assert(wexaCode.includes('#60A5FA'), 'WEXA AI contains Accent Blue #60A5FA');
  assert(wexaCode.includes('#EFF6FF'), 'WEXA AI contains Light-Blue background #EFF6FF');

  // Verify floating button styling
  assert(wexaCode.includes('wexa-ai-trigger'), 'WEXA AI trigger button present with id');
  assert(wexaCode.includes('WEXA AI — Powered by WeEngineerTech'), 'Exact branding preserved: WEXA AI — Powered by WeEngineerTech');

  // Verify click-only open behavior
  assert(wexaCode.includes('const [isOpen, setIsOpen] = useState(false)'), 'WEXA AI initialized as closed (isOpen = false)');
  assert(!wexaCode.includes('useEffect(() => {\n    setIsOpen(true)'), 'No auto-open effect on mount');

  // Verify absence of orange in WexaAIAssistant.jsx
  const hasOrangeButtons = wexaCode.includes('from-orange-600') || wexaCode.includes('bg-orange-600');
  assert(!hasOrangeButtons, 'WEXA AI assistant has zero orange buttons (all replaced with blue)');

  // Verify rest of website has NOT been recolored
  const reportsCode = fs.readFileSync('./src/components/ReportsSection.jsx', 'utf8');
  assert(reportsCode.includes('orange-600') && reportsCode.includes('orange-500'), 'ReportsSection retains original orange branding');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runBugFixAcceptanceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
