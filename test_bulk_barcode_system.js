import axios from 'axios';
import prisma from './server/db.js';
const API_BASE = 'http://localhost:5000/api';

async function runBarcodeSystemTests() {
  console.log('================================================================');
  console.log('ANANTHA STORES — BULK BARCODE GENERATION & PRINTING SYSTEM TESTS');
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

  let createdTestProductId = null;
  let originalProducts = [];
  let originalStats = null;

  try {
    // -------------------------------------------------------------
    // Test 0: Login as Admin
    // -------------------------------------------------------------
    console.log('--- TEST 0: Authenticate as Admin ---');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123',
    });
    const token = loginRes.data.token;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    assert(!!token, 'Admin authentication successful and JWT token set');

    // -------------------------------------------------------------
    // Test 1: Fetch Existing Products & Barcode Stats
    // -------------------------------------------------------------
    console.log('--- TEST 1: Retrieve Live Stats from Actual Database ---');
    const statsRes = await axios.get(`${API_BASE}/products/barcodes/stats`);
    originalStats = statsRes.data;
    console.log('Live Stats Received:', originalStats);

    assert(typeof originalStats.totalProducts === 'number', 'Stats returns numeric totalProducts');
    assert(typeof originalStats.withBarcode === 'number', 'Stats returns numeric withBarcode');
    assert(typeof originalStats.missingBarcode === 'number', 'Stats returns numeric missingBarcode');
    assert(typeof originalStats.eligibleForGeneration === 'number', 'Stats returns numeric eligibleForGeneration');
    assert(
      originalStats.totalProducts === originalStats.withBarcode + originalStats.missingBarcode,
      `totalProducts (${originalStats.totalProducts}) equals withBarcode (${originalStats.withBarcode}) + missingBarcode (${originalStats.missingBarcode})`
    );

    // -------------------------------------------------------------
    // Test 2: Fetch Products & Record Existing Barcodes
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Verify Existing Products & Barcode Integrity ---');
    const prodRes = await axios.get(`${API_BASE}/products`);
    originalProducts = prodRes.data;
    assert(Array.isArray(originalProducts) && originalProducts.length > 0, `Retrieved ${originalProducts.length} active products from database`);

    const existingBarcodesMap = new Map();
    originalProducts.forEach(p => {
      if (p.barcode) {
        existingBarcodesMap.set(p.id, p.barcode);
      }
    });
    console.log(`Recorded ${existingBarcodesMap.size} existing barcodes for change-prevention verification.`);

    // -------------------------------------------------------------
    // Test 3: Weight-Based Products Barcode Check
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Weight-Based Products (Rice, Sugar, Wheat, Dal) ---');
    const weightItems = originalProducts.filter(p => {
      const name = (p.name || '').toLowerCase();
      const unit = (p.unit || '').toLowerCase();
      const mType = (p.measurementType || '').toUpperCase();
      return mType === 'KG' || unit === 'kg' || name.includes('rice') || name.includes('sugar') || name.includes('dal') || name.includes('wheat');
    });
    console.log(`Found ${weightItems.length} weight-based products in database.`);

    assert(weightItems.length > 0, 'Weight-based products exist in store catalog');

    // Check each has exactly 1 barcode and NO sub-variants for 100g, 250g, 500g
    let multipleVariantFound = false;
    for (const item of weightItems) {
      if (item.barcode) {
        const duplicates = originalProducts.filter(p => p.barcode === item.barcode);
        if (duplicates.length > 1) multipleVariantFound = true;
      }
    }
    assert(!multipleVariantFound, 'Each weight product has a unique single barcode with NO separate records for 100g, 250g, 500g');

    // Verify lookup for a weight product returns KG price info for POS
    const sampleWeightItem = weightItems[0];
    if (sampleWeightItem && sampleWeightItem.barcode) {
      const posLookup = await axios.get(`${API_BASE}/products/barcode/${sampleWeightItem.barcode}`);
      assert(posLookup.data.id === sampleWeightItem.id, `POS lookup for weight product ${sampleWeightItem.name} succeeds`);
      assert(posLookup.data.pricePerKg !== undefined, 'Weight product response includes pricePerKg for POS weight selector');
    }

    // -------------------------------------------------------------
    // Test 4: Create Test Product without Barcode
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Create Eligible Product Missing Barcode ---');
    const newProdRes = await axios.post(`${API_BASE}/products`, {
      name: 'TEST BULK BARCODE ITEM (Temporary)',
      tamilName: 'பரிசோதனை பொருள்',
      categoryId: originalProducts[0].categoryId,
      purchaseCost: 45.0,
      sellingPrice: 60.0,
      currentStock: 25,
      minStock: 5,
      unit: 'pcs',
      measurementType: 'PCS',
      barcode: null, // explicitly missing
      sku: 'TEST-SKU-' + Date.now()
    });
    createdTestProductId = newProdRes.data.id;
    console.log(`Created test product with ID: ${createdTestProductId}, Barcode: ${newProdRes.data.barcode}`);
    assert(createdTestProductId, 'Test product created in SQLite database without barcode');

    // Verify stats updated
    const statsAfterAdd = (await axios.get(`${API_BASE}/products/barcodes/stats`)).data;
    assert(statsAfterAdd.missingBarcode === originalStats.missingBarcode + 1, 'Stats correctly incremented missingBarcode by 1');
    assert(statsAfterAdd.eligibleForGeneration === originalStats.eligibleForGeneration + 1, 'Stats correctly incremented eligibleForGeneration by 1');

    // -------------------------------------------------------------
    // Test 5: Execute Bulk Barcode Generation
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Execute Bulk Barcode Generation ---');
    const bulkGenRes = await axios.post(`${API_BASE}/products/barcodes/generate-missing`);
    console.log('Bulk Generation Result:', bulkGenRes.data);

    assert(bulkGenRes.data.success === true, 'Bulk generation API returned success: true');
    assert(bulkGenRes.data.generatedCount >= 1, `Generated barcodes count >= 1 (actual: ${bulkGenRes.data.generatedCount})`);
    assert(Array.isArray(bulkGenRes.data.results), 'Results array returned with generated items');

    const generatedForTest = bulkGenRes.data.results.find(r => r.id === createdTestProductId);
    assert(generatedForTest !== undefined, 'Test product was included in generated results');
    assert(generatedForTest && generatedForTest.barcode && generatedForTest.barcode.startsWith('AS'), `Generated barcode follows ANANTHA Code 128 format (${generatedForTest?.barcode})`);

    // -------------------------------------------------------------
    // Test 6: Verify Unchanged Existing Barcodes (CRITICAL SAFETY)
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Verify Zero Overwriting of Existing Barcodes ---');
    const refreshedProds = (await axios.get(`${API_BASE}/products`)).data;
    let anyExistingModified = false;
    for (const [id, originalBarcode] of existingBarcodesMap.entries()) {
      const current = refreshedProds.find(p => p.id === id);
      if (!current || current.barcode !== originalBarcode) {
        anyExistingModified = true;
        console.error(`Barcode mismatch for product ID ${id}: expected ${originalBarcode}, got ${current?.barcode}`);
      }
    }
    assert(!anyExistingModified, 'All existing barcodes remained 100% UNCHANGED and preserved');

    // -------------------------------------------------------------
    // Test 7: Verify Barcode Uniqueness at Database Level
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Verify Barcode Uniqueness Across All Products ---');
    const allBarcodes = refreshedProds.map(p => p.barcode).filter(Boolean);
    const uniqueBarcodes = new Set(allBarcodes);
    assert(allBarcodes.length === uniqueBarcodes.size, `All ${allBarcodes.length} saved barcodes are globally UNIQUE with 0 duplicates`);

    // -------------------------------------------------------------
    // Test 8: POS Scanner Fast-Path Lookup
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: POS Barcode Scanner Fast-Path Integration ---');
    const testBarcode = generatedForTest.barcode;
    const posScanRes = await axios.get(`${API_BASE}/products/barcode/${testBarcode}`);
    assert(posScanRes.data && posScanRes.data.id === createdTestProductId, `POS scanner lookup retrieves correct product (${posScanRes.data.name})`);
    assert(Number(posScanRes.data.sellingPrice) === 60.0, 'POS scanner retrieves correct selling price');
    assert(Number(posScanRes.data.currentStock) === 25, 'POS scanner retrieves correct stock level');

    // -------------------------------------------------------------
    // Test 9: Safe to Retry (Idempotency)
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Safe to Retry (When 0 Missing) ---');
    const retryRes = await axios.post(`${API_BASE}/products/barcodes/generate-missing`);
    console.log('Retry Result:', retryRes.data);
    assert(retryRes.data.success === true, 'Retry returned success');
    assert(retryRes.data.generatedCount === 0, 'Retry generated 0 new barcodes because none are missing');

    // -------------------------------------------------------------
    // Test 10: Single Product Barcode Generation
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Single Product Barcode Generation Endpoint ---');
    // If we call single generate on an already barcoded item, it safely returns existing barcode
    const singleGenRes = await axios.post(`${API_BASE}/products/${createdTestProductId}/generate-barcode`);
    assert(singleGenRes.data.success === true, 'Single generate endpoint succeeded');
    assert(singleGenRes.data.barcode === testBarcode, 'Single generate preserved existing barcode without regenerating');

  } catch (err) {
    console.error('Test execution failed with error:', err.response?.data || err.message);
    failed++;
  } finally {
    // -------------------------------------------------------------
    // Cleanup Test Product
    // -------------------------------------------------------------
    if (createdTestProductId) {
      console.log('\n--- CLEANUP: Deleting Temporary Test Product ---');
      try {
        await prisma.stockMovement.deleteMany({ where: { productId: createdTestProductId } });
        await prisma.auditLog.deleteMany({ where: { entityId: String(createdTestProductId) } });
        await prisma.product.delete({ where: { id: createdTestProductId } });
        console.log(`Deleted temporary test product ${createdTestProductId}`);
        const finalStats = (await axios.get(`${API_BASE}/products/barcodes/stats`)).data;
        assert(finalStats.totalProducts === originalStats.totalProducts, 'Database product count restored exactly to original state');
      } catch (cleanErr) {
        console.error('Cleanup error:', cleanErr.message);
      }
    }
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runBarcodeSystemTests();
