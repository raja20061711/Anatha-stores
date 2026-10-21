import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE POS BRANDING & 100 PRODUCTS TEST');
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

  // TEST 1: Check Database Application Settings Branding
  console.log('--- TEST 1: Database Application Settings Branding ---');
  try {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const settingsRes = await fetch(`${BASE_URL}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const settingsData = await settingsRes.json();
    assert(settingsData.appSettings.shopName === 'ANANTHA STORES' || settingsData.appSettings.shopName === 'ANANTHA STORE', `Database shopName is "ANANTHA STORES" (actual: "${settingsData.appSettings.shopName}")`);
  } catch (err) {
    assert(false, `Settings test failed: ${err.message}`);
  }

  // TEST 2: Check 100-Product Excel File Content & Exact Columns
  console.log('\n--- TEST 2: Validate 100-Product Excel File ---');
  try {
    const excelPath = 'anantha_store_100_products.xlsx';
    assert(fs.existsSync(excelPath), `Excel file exists: ${excelPath}`);

    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    assert(rows.length === 100, `Excel contains exactly 100 records (actual: ${rows.length})`);

    const requiredColumns = [
      'product_name',
      'tamil_name',
      'brand',
      'category',
      'unit',
      'purchase_price',
      'selling_price',
      'opening_stock',
      'minimum_stock',
      'image_filename',
      'status',
    ];

    const firstRow = rows[0];
    const hasAllCols = requiredColumns.every((col) => col in firstRow);
    assert(hasAllCols, `Excel contains all 11 required columns`);

    // Verify sensible prices: selling_price >= purchase_price
    const invalidPriceRows = rows.filter((r) => Number(r.selling_price) < Number(r.purchase_price));
    assert(invalidPriceRows.length === 0, `All 100 products have selling_price >= purchase_price (actual invalid: ${invalidPriceRows.length})`);
  } catch (err) {
    assert(false, `Excel validation failed: ${err.message}`);
  }

  // TEST 3: Check Sample Product Images in public/product-images/
  console.log('\n--- TEST 3: Validate Sample Product Images ---');
  try {
    const wb = XLSX.readFile('anantha_store_100_products.xlsx');
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    let allImagesFound = true;
    let missingImages = [];

    for (const r of rows) {
      const imgPath = path.resolve('public/product-images', r.image_filename);
      if (!fs.existsSync(imgPath)) {
        allImagesFound = false;
        missingImages.push(r.image_filename);
      }
    }

    assert(allImagesFound, `All 100 images referenced in Excel exist in public/product-images/`);
    if (missingImages.length > 0) {
      console.log(`    Missing: ${missingImages.slice(0, 5).join(', ')}...`);
    }

    // Verify static serving via HTTP
    const imgHttpRes = await fetch(`http://localhost:5000/product-images/${rows[0].image_filename}`);
    assert(imgHttpRes.status === 200, `Static image endpoint serves 200 OK for ${rows[0].image_filename}`);
  } catch (err) {
    assert(false, `Product images validation failed: ${err.message}`);
  }

  // TEST 4: Excel Import Preview API (/api/products/import-preview)
  console.log('\n--- TEST 4: Excel Import Preview API ---');
  let adminToken = '';
  try {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const loginData = await loginRes.json();
    adminToken = loginData.token;

    const wb = XLSX.readFile('anantha_store_100_products.xlsx');
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const previewRes = await fetch(`${BASE_URL}/products/import-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ rows }),
    });

    const previewData = await previewRes.json();
    assert(previewRes.status === 200, `Preview API returns 200 OK`);
    assert(previewData.totalRows === 100, `Preview returned 100 total rows`);
    assert(previewData.validCount === 100, `Preview validated 100 rows as valid for import`);
    assert(previewData.rows[0].imageExists === true, `Preview verified image exists on disk`);
  } catch (err) {
    assert(false, `Preview API test failed: ${err.message}`);
  }

  // TEST 5: Excel Import Confirm API (/api/products/import-confirm)
  console.log('\n--- TEST 5: Excel Import Confirm API into MySQL ---');
  try {
    const wb = XLSX.readFile('anantha_store_100_products.xlsx');
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const previewRes = await fetch(`${BASE_URL}/products/import-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ rows }),
    });
    const previewData = await previewRes.json();

    const confirmRes = await fetch(`${BASE_URL}/products/import-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        validRows: previewData.rows,
        onDuplicate: 'UPDATE',
      }),
    });

    const confirmData = await confirmRes.json();
    assert(confirmRes.status === 201, `Confirm API returns 201 Created`);
    assert(confirmData.totalSaved >= 90, `Saved/updated products into database (totalSaved: ${confirmData.totalSaved})`);
    console.log(`    Breakdown: ${confirmData.createdCount} created, ${confirmData.updatedCount} updated, ${confirmData.skippedCount} skipped`);

    // TEST 5B: Duplicate Test with 'SKIP' option
    const duplicateRes = await fetch(`${BASE_URL}/products/import-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        validRows: previewData.rows.slice(0, 5),
        onDuplicate: 'SKIP',
      }),
    });
    const duplicateData = await duplicateRes.json();
    assert(duplicateData.skippedCount === 5, `Duplicate resolution 'SKIP' safely preserved existing records without duplicates (skipped: ${duplicateData.skippedCount})`);
  } catch (err) {
    assert(false, `Import confirm test failed: ${err.message}`);
  }

  // TEST 6: Cashier Billing - Product Search & Images
  console.log('\n--- TEST 6: Cashier Billing Search & Product Cards ---');
  let cashierToken = '';
  try {
    const cashLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    const cashLoginData = await cashLoginRes.json();
    cashierToken = cashLoginData.token;

    const prodRes = await fetch(`${BASE_URL}/products`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    const productsList = await prodRes.json();

    assert(productsList.length >= 100, `Cashier has access to at least 100 products (actual: ${productsList.length})`);

    const sampleProductWithImage = productsList.find((p) => p.imageUrl && p.imageUrl.includes('/product-images/'));
    assert(Boolean(sampleProductWithImage), `Imported products contain valid image URLs (${sampleProductWithImage?.imageUrl})`);

    const hasTamilNames = productsList.some((p) => p.tamilName && p.tamilName.length > 0);
    assert(hasTamilNames, `Imported products contain Tamil names`);
  } catch (err) {
    assert(false, `Cashier billing test failed: ${err.message}`);
  }

  // TEST 7: Cashier Sale Checkout & Tamil Receipt Labels
  console.log('\n--- TEST 7: Cashier Checkout & Tamil Receipt Data ---');
  try {
    const prodRes = await fetch(`${BASE_URL}/products`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    const prods = await prodRes.json();
    const inStock = prods.filter((p) => Number(p.currentStock) >= 5);
    const item1 = inStock[0] || prods[0];
    const item2 = inStock[1] || prods[1];

    const saleRes = await fetch(`${BASE_URL}/sales/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        items: [
          { productId: item1.id, quantity: 2 },
          { productId: item2.id, quantity: 1 },
        ],
        paymentMethod: 'CASH',
        amountReceived: 1000,
        discountAmount: 0,
      }),
    });

    const saleData = await saleRes.json();
    const sale = saleData.sale || saleData;
    assert(saleRes.status === 201, `Cashier sale checkout returns 201 Created (Bill No: ${sale.billNumber})`);
    assert(Number(sale.grandTotal) > 0, `Sale calculated valid grandTotal: ₹${Number(sale.grandTotal).toFixed(2)}`);
  } catch (err) {
    assert(false, `Checkout test failed: ${err.message}`);
  }

  // TEST 8: Download Endpoints for Templates
  console.log('\n--- TEST 8: Verify Template Download Endpoints ---');
  try {
    const tplRes = await fetch(`${BASE_URL}/products/template/download`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(tplRes.status === 200, `Template download endpoint returns 200 OK`);

    const sample100Res = await fetch(`${BASE_URL}/products/sample-100/download`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(sample100Res.status === 200, `Sample 100 products download endpoint returns 200 OK`);

    const zipRes = await fetch(`${BASE_URL}/products/images-zip/download`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(zipRes.status === 200, `Images ZIP download endpoint returns 200 OK`);
  } catch (err) {
    assert(false, `Download endpoints test failed: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
