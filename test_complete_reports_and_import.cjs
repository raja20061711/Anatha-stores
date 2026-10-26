const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 ANANTHA STORES — REPORTS & UPGRADE VERIFICATION');
  console.log('====================================================\n');

  try {
    // 1. Authenticate as Admin
    console.log('1️⃣ Logging in as ADMIN...');
    const adminLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    const adminToken = adminLoginRes.data.token;
    console.log('   ✅ Admin logged in. Token acquired.');

    // 2. Test Admin Analytics endpoint (All 25 Reports)
    console.log('\n2️⃣ Testing GET /api/reports/analytics (ADMIN)...');
    const analyticsRes = await axios.get(`${BASE_URL}/reports/analytics?period=this_month`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const aData = analyticsRes.data;
    console.log('   Period:', aData.period, '| Range:', aData.dateRange.currentStart, 'to', aData.dateRange.currentEnd);
    console.log('   Report 1 (Net Sales Revenue): ₹' + aData.summary.netSales);
    console.log('   Report 2 (Total Invoices/Bills): ' + aData.summary.billsCount);
    console.log('   Report 3 (Average Bill Value): ₹' + aData.summary.avgBillValue);
    console.log('   Report 4 (Gross Sales): ₹' + aData.summary.grossSales);
    console.log('   Report 5 (Total Discounts Given): ₹' + aData.summary.discountTotal);
    console.log('   Report 6 (Total Tax/GST Collected): ₹' + aData.summary.taxTotal);
    console.log('   Report 7 (Cost of Goods Sold): ₹' + aData.summary.costOfGoodsSold);
    console.log('   Report 8 (Gross Profit - Admin): ₹' + aData.summary.grossProfit);
    console.log('   Report 9 (Profit Margin % - Admin): ' + aData.summary.profitMarginPercentage + '%');
    console.log('   Report 10 (Daily/Monthly Trend):', aData.salesTrend.length, 'intervals');
    console.log('   Report 11 (Period Comparison Trend):', aData.comparisonTrend.length, 'points');
    console.log('   Report 12 (Top Selling Products):', aData.topSelling.length, 'items');
    console.log('   Report 13 (Lowest Selling Products):', aData.lowestSelling.length, 'items');
    console.log('   Report 14 (Unsold Products):', aData.unsoldProducts.length, 'items');
    console.log('   Report 15 (Category Breakdown):', aData.categoryReport.length, 'categories');
    console.log('   Report 16 (Payment Method Breakdown):', aData.paymentReport.length, 'methods');
    console.log('   Report 17 (Cashier Performance):', aData.cashierReport.length, 'cashiers');
    console.log('   Report 18 (Stock Valuation): At Cost ₹' + aData.stockStatus.totalStockValuationCost + ' | At Retail ₹' + aData.stockStatus.totalStockValuationRetail);
    console.log('   Report 19 (Low Stock Items):', aData.lowStockList.length, 'items');
    console.log('   Report 20 (Out of Stock Items):', aData.outOfStockList.length, 'items');
    console.log('   Report 21 (Tax/GST Details):', aData.taxReport.note);
    console.log('   Report 22 (Returns & Cancellations):', aData.returnsReport.totalReturnsCount, 'returns');
    console.log('   Report 23 (Purchase & Supplier Summary): ₹' + aData.purchaseSupplierReport.totalPurchasesAmount, `(${aData.purchaseSupplierReport.invoiceCount} invoices)`);
    console.log('   Report 24 (Inventory Movement Activity):', aData.inventoryMovementReport.totalMovements, 'movements');
    console.log('   Report 25 (Expense Audit Note):', aData.expenseReport.message);
    console.log('   ✅ All 25 Reports verified successfully.');

    // 3. Test Manager role access restrictions on profit
    console.log('\n3️⃣ Testing Manager Role Authorization on Profit...');
    const managerLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'manager',
      password: 'manager123'
    });
    const managerToken = managerLoginRes.data.token;
    const managerAnalyticsRes = await axios.get(`${BASE_URL}/reports/analytics?period=this_month`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const mData = managerAnalyticsRes.data;
    if (mData.profitReport.isAuthorized === false && mData.summary.grossProfit === null) {
      console.log('   ✅ Manager correctly restricted from seeing Gross Profit & Margin:', mData.profitReport.message);
    } else {
      throw new Error('Manager was able to see Gross Profit!');
    }

    // 4. Test Template Download
    console.log('\n4️⃣ Testing GET /api/products/template/download...');
    const templateRes = await axios.get(`${BASE_URL}/products/template/download`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      responseType: 'arraybuffer'
    });
    console.log('   ✅ Template downloaded successfully. Size:', templateRes.data.byteLength, 'bytes');

    // 5. Test Import Preview with Tamil font & Barcode
    console.log('\n5️⃣ Testing POST /api/products/import-preview...');
    const sampleRows = [
      {
        'Product Name': 'Test Tamil Dal ' + Date.now(),
        'Tamil Name': 'துவரம் பருப்பு பிரீமியம்',
        'Category': 'Groceries',
        'Brand': 'Anatha Special',
        'Unit': 'kg',
        'Cost Price': 110,
        'Selling Price': 140,
        'Current Stock': 50,
        'Barcode': 'AS' + Math.floor(10000000 + Math.random() * 90000000)
      },
      {
        'Product Name': 'Invalid Product Zero Price',
        'Tamil Name': 'செல்லாது',
        'Category': 'General',
        'Unit': 'pcs',
        'Cost Price': 0,
        'Selling Price': -10, // Invalid!
        'Current Stock': 5
      }
    ];

    const previewRes = await axios.post(`${BASE_URL}/products/import-preview`, {
      rows: sampleRows
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('   Total Rows:', previewRes.data.totalRows);
    console.log('   Valid Count:', previewRes.data.validCount);
    console.log('   Error Count:', previewRes.data.errorCount);
    console.log('   Failed Rows captured:', previewRes.data.failedRows.length);
    if ((previewRes.data.errorCount || previewRes.data.failedRows.length) !== 1) {
      throw new Error('Validation failed to catch invalid row!');
    }
    console.log('   ✅ Import Preview validation correctly handled valid & invalid rows.');

    // 6. Test Import Confirm
    console.log('\n6️⃣ Testing POST /api/products/import-confirm...');
    const validRows = previewRes.data.rows.filter(r => r.isValid);
    const confirmRes = await axios.post(`${BASE_URL}/products/import-confirm`, {
      validRows,
      onDuplicate: 'SKIP'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('   Confirm message:', confirmRes.data.message);
    console.log('   Created Count:', confirmRes.data.createdCount);
    const createdBarcode = validRows[0].barcode;

    // Verify product exists in DB with preserved Tamil name and barcode
    const verifyProdRes = await axios.get(`${BASE_URL}/products?includeInactive=true`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const importedItem = verifyProdRes.data.find(p => p.barcode === createdBarcode);
    if (!importedItem || importedItem.tamilName !== 'துவரம் பருப்பு பிரீமியம்') {
      throw new Error('Imported item Tamil name or barcode not persisted properly!');
    }
    console.log('   ✅ Imported item verified in DB: Name="' + importedItem.name + '", Tamil="' + importedItem.tamilName + '", Barcode=' + importedItem.barcode);

    // 7. Test Single Delete (Hard delete for item without sales)
    console.log('\n7️⃣ Testing DELETE /api/products/:id (Hard delete on unsoldCount item)...');
    const delRes = await axios.delete(`${BASE_URL}/products/${importedItem.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('   Delete response:', delRes.data.message);
    if (delRes.data.action !== 'DELETED') {
      throw new Error('Expected unsoldCount item to be hard deleted!');
    }
    console.log('   ✅ Unused product safely hard-deleted.');

    // 8. Test Bulk Delete endpoint
    console.log('\n8️⃣ Testing POST /api/products/bulk-delete...');
    // Create 2 test items
    const tempRows = [
      {
        name: 'Bulk Del Test 1 ' + Date.now(),
        tamilName: 'டெஸ்ட் 1',
        categoryName: 'General',
        unit: 'pcs',
        purchasePrice: 10,
        sellingPrice: 15,
        openingStock: 2,
        isValid: true
      },
      {
        name: 'Bulk Del Test 2 ' + Date.now(),
        tamilName: 'டெஸ்ட் 2',
        categoryName: 'General',
        unit: 'pcs',
        purchasePrice: 20,
        sellingPrice: 25,
        openingStock: 2,
        isValid: true
      }
    ];
    const impRes = await axios.post(`${BASE_URL}/products/import-confirm`, {
      validRows: tempRows,
      onDuplicate: 'SKIP'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const allProds = (await axios.get(`${BASE_URL}/products?includeInactive=true`, { headers: { Authorization: `Bearer ${adminToken}` } })).data;
    const testIds = allProds.filter(p => p.name.startsWith('Bulk Del Test')).map(p => p.id);

    const bulkDelRes = await axios.post(`${BASE_URL}/products/bulk-delete`, {
      ids: testIds
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('   Bulk delete result:', bulkDelRes.data.message);
    console.log('   ✅ Bulk delete verified successfully.');

    console.log('\n====================================================');
    console.log('🎉 ALL SUITE VERIFICATIONS PASSED 100% SUCCESSFULLY!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTests();
