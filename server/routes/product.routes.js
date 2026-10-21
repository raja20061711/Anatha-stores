import express from 'express';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/products - Available to all authenticated users
router.get('/', verifyToken, async (req, res) => {
  try {
    const { category, search, includeInactive } = req.query;

    const where = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    if (category && category !== 'All') {
      where.category = { name: category };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { tamilName: { contains: q } },
        { brand: { contains: q } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    return res.json(products);
  } catch (err) {
    console.error('Fetch products error:', err);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/categories - List categories
router.get('/categories', verifyToken, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json(categories);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/products/categories - Add category (Admin only)
router.post('/categories', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const category = await prisma.category.upsert({
      where: { name: name.trim() },
      update: { description: description?.trim(), isActive: true },
      create: { name: name.trim(), description: description?.trim() },
    });

    return res.status(201).json(category);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save category' });
  }
});

// POST /api/products - Add product (Admin only)
router.post('/', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const {
      name,
      tamilName,
      brand,
      barcode,
      sku,
      categoryId,
      measurementType,
      baseUnit,
      unit = 'pcs',
      purchaseCost = 0,
      sellingPrice,
      pricePerKg,
      packSize,
      currentStock = 0,
      minStock = 5,
      imageUrl,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required.' });
    }

    let normMt = (measurementType || '').toUpperCase().trim();
    if (!normMt) {
      const u = (unit || '').toLowerCase().trim();
      if (u === 'kg' || u === 'g') normMt = 'KG';
      else if (u === 'l' || u === 'ml') normMt = 'L';
      else if (u === 'pack') normMt = 'PACK';
      else if (u === 'box') normMt = 'BOX';
      else normMt = 'PCS';
    }

    let normBaseUnit = (baseUnit || '').toLowerCase().trim();
    if (!normBaseUnit) {
      if (normMt === 'KG' || normMt === 'G') normBaseUnit = 'kg';
      else if (normMt === 'L' || normMt === 'ML') normBaseUnit = 'l';
      else if (normMt === 'PACK') normBaseUnit = 'pack';
      else if (normMt === 'BOX') normBaseUnit = 'box';
      else normBaseUnit = (unit || 'pcs').toLowerCase().trim();
    }

    // Determine final selling price and price per kg
    let price = parseFloat(sellingPrice);
    let finalPricePerKg = null;

    if (normMt === 'KG' || normMt === 'G') {
      const pkg = parseFloat(pricePerKg);
      if (!isNaN(pkg) && pkg >= 0) {
        finalPricePerKg = pkg;
        if (isNaN(price)) price = pkg;
      } else if (!isNaN(price) && price >= 0) {
        finalPricePerKg = price;
      }
    } else if (pricePerKg !== undefined && pricePerKg !== null && !isNaN(parseFloat(pricePerKg))) {
      finalPricePerKg = parseFloat(pricePerKg);
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Valid selling price or price per KG is required.' });
    }

    const cost = parseFloat(purchaseCost) || 0;
    const stock = parseFloat(currentStock) || 0;
    const min = parseFloat(minStock) || 5;

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: name.trim(),
          tamilName: tamilName?.trim() || null,
          brand: brand?.trim() || null,
          barcode: barcode?.trim() || null,
          sku: sku?.trim() || null,
          categoryId: categoryId ? parseInt(categoryId) : null,
          measurementType: normMt,
          baseUnit: normBaseUnit,
          unit: normBaseUnit || unit || 'pcs',
          purchaseCost: cost,
          sellingPrice: price,
          pricePerKg: finalPricePerKg,
          packSize: packSize?.trim() || null,
          currentStock: stock,
          minStock: min,
          imageUrl: imageUrl || null,
          isActive: true,
        },
      });

      if (stock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: p.id,
            type: 'ADJUSTMENT',
            quantityChange: stock,
            previousStock: 0,
            newStock: stock,
            reason: 'Initial stock on product creation',
            userId: req.user.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'PRODUCT_CREATED',
          entity: 'PRODUCT',
          entityId: String(p.id),
          details: `Created product "${p.name}" with selling price ₹${price.toFixed(2)}, unit: ${normBaseUnit}, and stock ${stock}`,
        },
      });

      return p;
    });

    return res.status(201).json(product);
  } catch (err) {
    console.error('Create product error:', err);
    return res.status(500).json({ error: 'Failed to create product: ' + err.message });
  }
});

// PUT /api/products/:id - Edit product details (Admin only)
router.put('/:id', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      name,
      tamilName,
      brand,
      barcode,
      sku,
      categoryId,
      measurementType,
      baseUnit,
      unit,
      purchaseCost,
      sellingPrice,
      pricePerKg,
      packSize,
      minStock,
      currentStock,
      imageUrl,
      isActive,
    } = req.body;

    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    let normMt = measurementType !== undefined ? String(measurementType).toUpperCase().trim() : current.measurementType;
    let normBaseUnit = baseUnit !== undefined ? String(baseUnit).toLowerCase().trim() : (unit || current.baseUnit || current.unit);

    let finalPrice = sellingPrice !== undefined ? parseFloat(sellingPrice) : parseFloat(current.sellingPrice);
    let finalPricePerKg = pricePerKg !== undefined ? (pricePerKg === null ? null : parseFloat(pricePerKg)) : current.pricePerKg ? parseFloat(current.pricePerKg) : null;

    if (normMt === 'KG' || normMt === 'G') {
      if (pricePerKg !== undefined && !isNaN(parseFloat(pricePerKg))) {
        finalPricePerKg = parseFloat(pricePerKg);
        if (sellingPrice === undefined) finalPrice = finalPricePerKg;
      } else if (sellingPrice !== undefined && !isNaN(parseFloat(sellingPrice))) {
        finalPricePerKg = finalPrice;
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name?.trim() : undefined,
        tamilName: tamilName !== undefined ? tamilName?.trim() : undefined,
        brand: brand !== undefined ? brand?.trim() : undefined,
        barcode: barcode !== undefined ? barcode?.trim() : undefined,
        sku: sku !== undefined ? sku?.trim() : undefined,
        categoryId: categoryId !== undefined ? (categoryId ? parseInt(categoryId) : null) : undefined,
        measurementType: normMt || undefined,
        baseUnit: normBaseUnit || undefined,
        unit: normBaseUnit || unit || undefined,
        purchaseCost: purchaseCost !== undefined ? parseFloat(purchaseCost) : undefined,
        sellingPrice: !isNaN(finalPrice) ? finalPrice : undefined,
        pricePerKg: finalPricePerKg,
        packSize: packSize !== undefined ? packSize?.trim() : undefined,
        minStock: minStock !== undefined ? parseFloat(minStock) : undefined,
        currentStock: currentStock !== undefined ? parseFloat(currentStock) : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    // If default selling price or pricePerKg changed, record price history
    if (!isNaN(finalPrice) && finalPrice !== parseFloat(current.sellingPrice)) {
      await prisma.priceHistory.create({
        data: {
          productId: id,
          oldPrice: current.sellingPrice,
          newPrice: finalPrice,
          changedById: req.user.id,
          reason: 'Admin updated selling price in product edit',
        },
      });
    }

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update product: ' + err.message });
  }
});

// PUT /api/products/:id/price - Change default selling price (ADMIN ONLY)
router.put('/:id/price', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { newSellingPrice, newPricePerKg, reason } = req.body;

    const rawTarget = newSellingPrice !== undefined && newSellingPrice !== null && !isNaN(Number(newSellingPrice))
      ? newSellingPrice
      : newPricePerKg;

    if (rawTarget === undefined || rawTarget === null || isNaN(rawTarget) || Number(rawTarget) < 0) {
      return res.status(400).json({ error: 'Valid positive selling price required.' });
    }

    const targetPrice = parseFloat(rawTarget);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const oldPrice = product.sellingPrice;
    const isWeight = product.measurementType === 'KG' || product.measurementType === 'G' || product.unit?.toLowerCase() === 'kg' || product.unit?.toLowerCase() === 'g';

    const updateData = { sellingPrice: targetPrice };
    if (isWeight || newPricePerKg !== undefined) {
      updateData.pricePerKg = targetPrice;
    }

    const updated = await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: updateData,
      }),
      prisma.priceHistory.create({
        data: {
          productId: id,
          oldPrice,
          newPrice: targetPrice,
          changedById: req.user.id,
          reason: reason || (isWeight ? 'Admin updated default price per KG' : 'Admin updated default selling price'),
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'PRICE_CHANGE_DEFAULT',
          entity: 'PRODUCT',
          entityId: String(id),
          details: `Changed ${product.name} default price from ₹${oldPrice} to ₹${targetPrice}. Reason: ${reason || 'N/A'}`,
        },
      }),
    ]);

    return res.json({
      message: 'Selling price updated successfully',
      product: updated[0],
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update selling price: ' + err.message });
  }
});

// GET /api/products/template/download - Download clean Excel import template
router.get('/template/download', verifyToken, requireRole(['ADMIN']), (req, res) => {
  try {
    const templateFilePath = path.resolve('public/anantha_store_products_template.xlsx');
    if (fs.existsSync(templateFilePath)) {
      return res.download(templateFilePath, 'anantha_store_products_template.xlsx');
    }

    // Fallback in-memory generation if file is missing
    const sampleData = [
      {
        product_name: 'Parle-G Glucose Biscuit 250g',
        tamil_name: 'பார்லே-ஜி குளுக்கோஸ் பிஸ்கட் 250கி',
        brand: 'Parle',
        category: 'Biscuits',
        unit: 'pack',
        purchase_price: 22.0,
        selling_price: 25.0,
        opening_stock: 100,
        minimum_stock: 15,
        image_filename: 'biscuit-001.png',
        status: 'active',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products_Template');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="anantha_store_products_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to download template: ' + err.message });
  }
});

// GET /api/products/sample-100/download - Download the 100-product sample dataset
router.get('/sample-100/download', verifyToken, requireRole(['ADMIN']), (req, res) => {
  try {
    const sampleFilePath = path.resolve('public/anantha_store_100_products.xlsx');
    if (fs.existsSync(sampleFilePath)) {
      return res.download(sampleFilePath, 'anantha_store_100_products.xlsx');
    }
    return res.status(404).json({ error: 'Sample 100-product Excel file not found.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to download sample dataset: ' + err.message });
  }
});

// GET /api/products/images-zip/download - Download ZIP of product images
router.get('/images-zip/download', verifyToken, requireRole(['ADMIN']), (req, res) => {
  try {
    const zipPath = path.resolve('public/anantha_store_product_images.zip');
    if (fs.existsSync(zipPath)) {
      return res.download(zipPath, 'anantha_store_product_images.zip');
    }
    return res.status(404).json({ error: 'Product images ZIP archive not found.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to download images ZIP: ' + err.message });
  }
});

// POST /api/products/import-preview - Preview & Validate Excel/CSV rows (11 columns & duplicate check)
router.post('/import-preview', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No data rows provided for import preview.' });
    }

    const categories = await prisma.category.findMany();
    const catMap = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

    const existingProducts = await prisma.product.findMany({
      select: { id: true, name: true, sellingPrice: true, purchaseCost: true, currentStock: true },
    });
    const existingMap = new Map(existingProducts.map((p) => [p.name.trim().toLowerCase(), p]));

    const seenNamesInSheet = new Set();
    const validatedRows = [];
    let validCount = 0;
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // Normalize column names
      const name = r['product_name'] || r['Product Name'] || r.name;
      const tamilName = r['tamil_name'] || r['Tamil Name'] || r.tamilName || null;
      const brand = r['brand'] || r['Brand'] || null;
      const categoryName = r['category'] || r['Category'] || 'Groceries';
      const unit = r['unit'] || r['Unit'] || 'pcs';
      const purchasePrice = parseFloat(r['purchase_price'] || r['Purchase Cost'] || r.purchaseCost || r['cost'] || 0);
      const sellingPrice = parseFloat(r['selling_price'] || r['Selling Price'] || r.sellingPrice || r['price']);
      const openingStock = parseFloat(r['opening_stock'] || r['Initial Stock'] || r.currentStock || r['stock'] || 0);
      const minStock = parseFloat(r['minimum_stock'] || r['Min Stock'] || r.minStock || 5);
      const imageFilename = r['image_filename'] || r['Image Filename'] || r['image'] || r.imageUrl || null;
      const status = (r['status'] || r['Status'] || 'active').toLowerCase() === 'inactive' ? false : true;

      const errors = [];
      const warnings = [];

      // 1. Validate Product Name
      const cleanName = name ? String(name).trim() : '';
      if (!cleanName) {
        errors.push('Missing product name');
      }

      // Check duplicates in Excel sheet itself
      if (cleanName) {
        const lowerName = cleanName.toLowerCase();
        if (seenNamesInSheet.has(lowerName)) {
          warnings.push('Duplicate row inside this spreadsheet');
        } else {
          seenNamesInSheet.add(lowerName);
        }
      }

      // 2. Validate Selling Price
      if (isNaN(sellingPrice) || sellingPrice <= 0) {
        errors.push('Invalid or non-positive selling price');
      }

      // 3. Validate Purchase Price
      if (isNaN(purchasePrice) || purchasePrice < 0) {
        errors.push('Invalid purchase price');
      } else if (!isNaN(sellingPrice) && sellingPrice < purchasePrice) {
        warnings.push('Warning: Selling price is lower than purchase cost');
      }

      // 4. Validate Category
      const catLower = String(categoryName).trim().toLowerCase();
      const existingCatId = catMap.get(catLower) || null;

      // 5. Check Image Filename
      let cleanImageFilename = null;
      let imageUrl = null;
      let imageExists = false;
      if (imageFilename) {
        cleanImageFilename = String(imageFilename).trim().replace(/^\/product-images\//, '');
        imageUrl = `/product-images/${cleanImageFilename}`;
        const localImgPath = path.resolve('public/product-images', cleanImageFilename);
        imageExists = fs.existsSync(localImgPath);
      }

      // 6. Check Database Duplicate
      const isExistingInDb = cleanName ? existingMap.has(cleanName.toLowerCase()) : false;
      const existingDbProduct = isExistingInDb ? existingMap.get(cleanName.toLowerCase()) : null;

      const isValid = errors.length === 0;
      let rowStatus = 'NEW';
      if (!isValid) {
        rowStatus = 'INVALID';
        errorCount++;
      } else if (isExistingInDb) {
        rowStatus = 'DUPLICATE';
        duplicateCount++;
        validCount++;
      } else {
        rowStatus = 'NEW';
        newCount++;
        validCount++;
      }

      validatedRows.push({
        rowNumber: i + 1,
        name: cleanName,
        tamilName: tamilName ? String(tamilName).trim() : '',
        brand: brand ? String(brand).trim() : '',
        categoryName: String(categoryName).trim(),
        categoryId: existingCatId,
        unit: String(unit).trim(),
        purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice,
        sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
        openingStock: isNaN(openingStock) ? 0 : openingStock,
        minimumStock: isNaN(minStock) ? 5 : minStock,
        imageFilename: cleanImageFilename,
        imageUrl,
        imageExists,
        status: status ? 'active' : 'inactive',
        isActive: status,
        isDuplicate: isExistingInDb,
        existingId: existingDbProduct?.id || null,
        existingPrice: existingDbProduct?.sellingPrice || null,
        existingStock: existingDbProduct?.currentStock || null,
        rowStatus,
        isValid,
        errors,
        warnings,
      });
    }

    return res.json({
      totalRows: rows.length,
      validCount,
      newCount,
      duplicateCount,
      errorCount,
      rows: validatedRows,
    });
  } catch (err) {
    console.error('Import preview error:', err);
    return res.status(500).json({ error: 'Failed to process import preview: ' + err.message });
  }
});

// POST /api/products/import-confirm - Save valid records into MySQL with explicit duplicate resolution
router.post('/import-confirm', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { validRows, onDuplicate = 'SKIP' } = req.body; // onDuplicate: 'SKIP' | 'UPDATE'
    if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
      return res.status(400).json({ error: 'No valid rows provided to import.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const row of validRows) {
        if (!row.isValid) continue;

        // Ensure category exists
        let catId = row.categoryId;
        if (!catId && row.categoryName) {
          let cat = await tx.category.findUnique({ where: { name: row.categoryName } });
          if (!cat) {
            cat = await tx.category.create({ data: { name: row.categoryName } });
          }
          catId = cat.id;
        }

        // Check if product already exists
        const existing = await tx.product.findFirst({
          where: { name: { equals: row.name } },
        });

        const unitStr = String(row.unit || 'pcs').toLowerCase().trim();
        let rowMt = 'PCS';
        let rowBaseUnit = unitStr || 'pcs';
        if (unitStr === 'kg' || unitStr === 'g') {
          rowMt = 'KG';
          rowBaseUnit = 'kg';
        } else if (unitStr === 'l' || unitStr === 'ml') {
          rowMt = 'L';
          rowBaseUnit = 'l';
        } else if (unitStr === 'pack') {
          rowMt = 'PACK';
          rowBaseUnit = 'pack';
        } else if (unitStr === 'box') {
          rowMt = 'BOX';
          rowBaseUnit = 'box';
        }

        const rowPrice = parseFloat(row.sellingPrice);
        const rowPricePerKg = (rowMt === 'KG') ? rowPrice : null;

        if (existing) {
          if (onDuplicate === 'UPDATE') {
            const oldPrice = existing.sellingPrice;
            const newStock = Number(existing.currentStock) + Number(row.openingStock || 0);

            await tx.product.update({
              where: { id: existing.id },
              data: {
                tamilName: row.tamilName || existing.tamilName,
                brand: row.brand || existing.brand,
                categoryId: catId || existing.categoryId,
                unit: row.unit || existing.unit,
                measurementType: existing.measurementType || rowMt,
                baseUnit: existing.baseUnit || rowBaseUnit,
                pricePerKg: (existing.measurementType === 'KG' || rowMt === 'KG') ? rowPrice : existing.pricePerKg,
                purchaseCost: row.purchasePrice,
                sellingPrice: row.sellingPrice,
                currentStock: newStock,
                minStock: row.minimumStock,
                imageUrl: row.imageUrl || existing.imageUrl,
                isActive: row.isActive !== undefined ? row.isActive : existing.isActive,
              },
            });

            if (Number(row.openingStock) > 0) {
              await tx.stockMovement.create({
                data: {
                  productId: existing.id,
                  type: 'ADJUSTMENT',
                  quantityChange: row.openingStock,
                  previousStock: existing.currentStock,
                  newStock,
                  reason: 'Excel bulk import stock addition (update)',
                  userId: req.user.id,
                },
              });
            }

            if (parseFloat(row.sellingPrice) !== parseFloat(oldPrice)) {
              await tx.priceHistory.create({
                data: {
                  productId: existing.id,
                  oldPrice,
                  newPrice: row.sellingPrice,
                  changedById: req.user.id,
                  reason: 'Excel bulk import price update',
                },
              });
            }

            updatedCount++;
          } else {
            // onDuplicate === 'SKIP'
            skippedCount++;
          }
        } else {
          // Create brand new product
          const p = await tx.product.create({
            data: {
              name: row.name,
              tamilName: row.tamilName || null,
              brand: row.brand || null,
              categoryId: catId,
              unit: row.unit || rowBaseUnit || 'pcs',
              measurementType: rowMt,
              baseUnit: rowBaseUnit,
              pricePerKg: rowPricePerKg,
              purchaseCost: row.purchasePrice || 0,
              sellingPrice: row.sellingPrice,
              currentStock: row.openingStock || 0,
              minStock: row.minimumStock || 5,
              imageUrl: row.imageUrl || null,
              isActive: row.isActive !== undefined ? row.isActive : true,
            },
          });

          if (Number(row.openingStock) > 0) {
            await tx.stockMovement.create({
              data: {
                productId: p.id,
                type: 'ADJUSTMENT',
                quantityChange: row.openingStock,
                previousStock: 0,
                newStock: row.openingStock,
                reason: 'Excel bulk import initial opening stock',
                userId: req.user.id,
              },
            });
          }

          createdCount++;
        }
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'EXCEL_PRODUCTS_IMPORTED',
          entity: 'PRODUCT',
          details: `Excel bulk import: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped. Mode: ${onDuplicate}`,
        },
      });

      return { createdCount, updatedCount, skippedCount };
    });

    return res.status(201).json({
      message: `Excel import complete! ${result.createdCount} products created, ${result.updatedCount} updated, ${result.skippedCount} skipped.`,
      ...result,
      totalSaved: result.createdCount + result.updatedCount,
    });
  } catch (err) {
    console.error('Import confirm error:', err);
    return res.status(500).json({ error: 'Failed to import products: ' + err.message });
  }
});

export default router;
