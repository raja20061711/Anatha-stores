import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import XLSX from 'xlsx';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { generateUniqueBarcode, generateBatchUniqueBarcodes, isValidBarcode } from '../utils/barcodeGenerator.js';

const router = express.Router();

const UPLOAD_DIR = path.resolve('public/product-images');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 5 MB maximum allowed file size
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * Validates raw image buffer by magic bytes and size, then writes to public/product-images/ with a unique filename.
 * @param {Buffer} buffer
 * @returns {{ imageUrl: string, filename: string }}
 */
function saveUploadedImageBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid image payload.');
  }

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error('File size exceeds 5 MB limit. Please upload an image under 5 MB.');
  }

  if (buffer.length < 12) {
    throw new Error('Invalid or empty image file.');
  }

  // Detect image type by magic bytes
  let ext = null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    ext = '.jpg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) {
    ext = '.png';
  }
  // WebP: RIFF .... WEBP
  else if (
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    ext = '.webp';
  }

  if (!ext) {
    throw new Error('Invalid file format. Only JPG, JPEG, PNG, and WebP images are allowed.');
  }

  const safeFilename = `prod_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const targetPath = path.join(UPLOAD_DIR, safeFilename);

  fs.writeFileSync(targetPath, buffer);

  return {
    imageUrl: `/product-images/${safeFilename}`,
    filename: safeFilename,
  };
}

/**
 * Decodes base64 string or data URI into a buffer and saves image.
 * @param {string} base64Str
 * @returns {{ imageUrl: string, filename: string }}
 */
function saveBase64Image(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') {
    throw new Error('No image data provided.');
  }

  // Already a permanent relative path
  if (base64Str.startsWith('/product-images/')) {
    return { imageUrl: base64Str, filename: path.basename(base64Str) };
  }

  let rawBase64 = base64Str;
  const match = base64Str.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/i);
  if (match) {
    rawBase64 = match[1];
  } else if (base64Str.startsWith('data:')) {
    const commaIndex = base64Str.indexOf(',');
    if (commaIndex !== -1) {
      rawBase64 = base64Str.slice(commaIndex + 1);
    }
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  return saveUploadedImageBuffer(buffer);
}

// POST /api/products/upload-image - Upload product image (Admin / Manager)
router.post('/upload-image', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';

    // Case 1: JSON payload with base64 data
    if (contentType.includes('application/json') || req.body?.image || req.body?.base64) {
      const imgData = req.body?.image || req.body?.base64;
      if (!imgData) {
        return res.status(400).json({ error: 'No image data provided in request body.' });
      }

      const result = saveBase64Image(imgData);
      return res.status(200).json({
        success: true,
        message: 'Product image uploaded successfully.',
        imageUrl: result.imageUrl,
        filename: result.filename,
      });
    }

    // Case 2: Multipart or raw stream body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const fullBuffer = Buffer.concat(chunks);

    if (fullBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty file upload.' });
    }

    let fileBuffer = fullBuffer;

    // If multipart/form-data, extract file part
    if (contentType.includes('multipart/form-data')) {
      const boundaryMatch = contentType.match(/boundary=(?:["']?)([^"';]+)(?:["']?)/i);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const separator = Buffer.from(`\r\n\r\n`);
        const headerIndex = fullBuffer.indexOf(separator);
        if (headerIndex !== -1) {
          const bodyStart = headerIndex + 4;
          const endBoundary = Buffer.from(`\r\n--${boundary}`);
          const endIndex = fullBuffer.indexOf(endBoundary, bodyStart);
          if (endIndex !== -1) {
            fileBuffer = fullBuffer.slice(bodyStart, endIndex);
          } else {
            fileBuffer = fullBuffer.slice(bodyStart);
          }
        }
      }
    }

    const result = saveUploadedImageBuffer(fileBuffer);
    return res.status(200).json({
      success: true,
      message: 'Product image uploaded successfully.',
      imageUrl: result.imageUrl,
      filename: result.filename,
    });
  } catch (err) {
    console.error('Upload product image error:', err);
    return res.status(400).json({ error: err.message || 'Failed to upload image.' });
  }
});

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
        { barcode: { contains: q } },
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

// GET /api/products/barcodes/stats - Real database barcode statistics
router.get('/barcodes/stats', verifyToken, async (req, res) => {
  try {
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        barcode: true,
        categoryId: true,
        measurementType: true,
      },
    });

    const totalProducts = allProducts.length;
    let withBarcode = 0;
    let missingBarcode = 0;

    for (const p of allProducts) {
      if (p.barcode && p.barcode.trim() !== '') {
        withBarcode++;
      } else {
        missingBarcode++;
      }
    }

    return res.json({
      totalProducts,
      withBarcode,
      missingBarcode,
      eligibleForGeneration: missingBarcode,
    });
  } catch (err) {
    console.error('Barcode stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch barcode statistics: ' + err.message });
  }
});

// POST /api/products/barcodes/generate-missing - Bulk generate unique Code 128 barcodes for products missing barcodes
router.post('/barcodes/generate-missing', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { productIds } = req.body || {};

    const where = {
      OR: [
        { barcode: null },
        { barcode: '' },
      ],
    };

    if (Array.isArray(productIds) && productIds.length > 0) {
      where.id = { in: productIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id)) };
    }

    const eligibleProducts = await prisma.product.findMany({
      where,
      select: { id: true, name: true, barcode: true },
      orderBy: { id: 'asc' },
    });

    if (eligibleProducts.length === 0) {
      return res.json({
        success: true,
        message: 'No eligible products missing barcodes found.',
        totalEligible: 0,
        generatedCount: 0,
        failedCount: 0,
        generated: [],
        results: [],
        failures: [],
      });
    }

    // Generate unique batch of barcodes sequentially
    const generatedCodes = await generateBatchUniqueBarcodes(eligibleProducts.length);

    const generated = [];
    const failures = [];

    for (let i = 0; i < eligibleProducts.length; i++) {
      const prod = eligibleProducts[i];
      const newBarcode = generatedCodes[i];

      try {
        const updated = await prisma.product.update({
          where: { id: prod.id },
          data: { barcode: newBarcode },
          select: { id: true, name: true, barcode: true },
        });

        // Audit log entry
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'BARCODE_GENERATED',
            entity: 'PRODUCT',
            entityId: String(prod.id),
            details: `Auto-generated unique barcode "${newBarcode}" for product "${prod.name}"`,
          },
        }).catch(() => {});

        generated.push(updated);
      } catch (err) {
        failures.push({
          id: prod.id,
          name: prod.name,
          error: err.message,
        });
      }
    }

    return res.json({
      success: true,
      message: `Successfully generated ${generated.length} barcode${generated.length === 1 ? '' : 's'}.${failures.length > 0 ? ` ${failures.length} failed.` : ''}`,
      totalEligible: eligibleProducts.length,
      generatedCount: generated.length,
      failedCount: failures.length,
      generated,
      results: generated,
      failures,
    });
  } catch (err) {
    console.error('Bulk generate barcodes error:', err);
    return res.status(500).json({ error: 'Failed to generate barcodes: ' + err.message });
  }
});

// POST /api/products/:id/generate-barcode - Generate single barcode for product missing barcode
router.post('/:id/generate-barcode', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const current = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, barcode: true },
    });

    if (!current) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (current.barcode && current.barcode.trim() !== '') {
      return res.json({
        success: true,
        message: `Product already has barcode "${current.barcode}". Existing barcodes are preserved.`,
        product: current,
        barcode: current.barcode,
      });
    }

    const newBarcode = await generateUniqueBarcode();
    const updated = await prisma.product.update({
      where: { id },
      data: { barcode: newBarcode },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'BARCODE_GENERATED',
        entity: 'PRODUCT',
        entityId: String(id),
        details: `Generated unique barcode "${newBarcode}" for product "${current.name}"`,
      },
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Barcode "${newBarcode}" generated successfully.`,
      product: updated,
      barcode: newBarcode,
    });
  } catch (err) {
    console.error('Single barcode generate error:', err);
    return res.status(500).json({ error: 'Failed to generate barcode: ' + err.message });
  }
});

// GET /api/products/barcode/:barcode - Exact barcode lookup (Scanner fast-path)
router.get('/barcode/:barcode', verifyToken, async (req, res) => {
  try {
    const code = req.params.barcode ? req.params.barcode.trim() : '';
    if (!code) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const product = await prisma.product.findUnique({
      where: { barcode: code },
      include: { category: true },
    });

    if (!product || (!product.isActive && req.query.includeInactive !== 'true')) {
      return res.status(404).json({ error: `Product not found with barcode "${code}".` });
    }

    return res.json(product);
  } catch (err) {
    console.error('Barcode lookup error:', err);
    return res.status(500).json({ error: 'Failed to lookup product by barcode' });
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
      image,
    } = req.body;

    let finalImageUrl = imageUrl && typeof imageUrl === 'string' ? imageUrl.trim() : null;
    if (image && typeof image === 'string' && image.trim()) {
      try {
        const imgRes = saveBase64Image(image);
        finalImageUrl = imgRes.imageUrl;
      } catch (imgErr) {
        return res.status(400).json({ error: imgErr.message });
      }
    }

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

    let finalBarcode = null;
    if (barcode && typeof barcode === 'string' && barcode.trim()) {
      const trimmed = barcode.trim();
      if (!isValidBarcode(trimmed)) {
        return res.status(400).json({ error: 'Invalid barcode format. Alphanumeric, dash, and underscore between 3 and 32 chars allowed.' });
      }
      const existing = await prisma.product.findUnique({ where: { barcode: trimmed } });
      if (existing) {
        return res.status(400).json({ error: `Barcode "${trimmed}" is already assigned to "${existing.name}".` });
      }
      finalBarcode = trimmed;
    } else if (barcode === null || req.body.autoGenerateBarcode === false) {
      // Explicitly created without barcode (eligible for Bulk Barcode Generation)
      finalBarcode = null;
    } else {
      // Default: generate unique Code 128 barcode
      finalBarcode = await generateUniqueBarcode();
    }

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: name.trim(),
          tamilName: tamilName?.trim() || null,
          brand: brand?.trim() || null,
          barcode: finalBarcode,
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
          imageUrl: finalImageUrl || null,
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
      image,
      isActive,
    } = req.body;

    let finalImageUrl = undefined;
    if (image && typeof image === 'string' && image.trim()) {
      try {
        const imgRes = saveBase64Image(image);
        finalImageUrl = imgRes.imageUrl;
      } catch (imgErr) {
        return res.status(400).json({ error: imgErr.message });
      }
    } else if (imageUrl !== undefined) {
      finalImageUrl = (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) ? imageUrl.trim() : null;
    }

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

    let finalBarcode = undefined;
    if (barcode !== undefined) {
      if (barcode === null || barcode.trim() === '') {
        // Preserve existing barcode, do not generate a new barcode when edited
        finalBarcode = current.barcode || null;
      } else {
        const trimmed = barcode.trim();
        if (!isValidBarcode(trimmed)) {
          return res.status(400).json({ error: 'Invalid barcode format.' });
        }
        const duplicate = await prisma.product.findFirst({
          where: {
            barcode: trimmed,
            NOT: { id },
          },
        });
        if (duplicate) {
          return res.status(400).json({ error: `Barcode "${trimmed}" is already assigned to "${duplicate.name}".` });
        }
        finalBarcode = trimmed;
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name?.trim() : undefined,
        tamilName: tamilName !== undefined ? tamilName?.trim() : undefined,
        brand: brand !== undefined ? brand?.trim() : undefined,
        barcode: finalBarcode !== undefined ? finalBarcode : undefined,
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
        imageUrl: finalImageUrl !== undefined ? finalImageUrl : undefined,
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
    const sampleData = [
      {
        product_name: 'Parle-G Glucose Biscuit 250g',
        tamil_name: 'பார்லே-ஜி குளுக்கோஸ் பிஸ்கட் 250கி',
        brand: 'Parle',
        category: 'Biscuits',
        barcode: 'AS00000001',
        unit: 'pack',
        purchase_price: 22.0,
        selling_price: 25.0,
        opening_stock: 100,
        minimum_stock: 15,
        image_filename: 'biscuit-001.png',
        status: 'active',
      },
      {
        product_name: 'Aashirvaad Shudh Chakki Whole Wheat Atta 5kg',
        tamil_name: 'ஆசிர்வாத் கோதுமை மாவு 5கிலோ',
        brand: 'Aashirvaad',
        category: 'Atta & Flours',
        barcode: 'AS00000002',
        unit: 'kg',
        purchase_price: 240.0,
        selling_price: 275.0,
        opening_stock: 45,
        minimum_stock: 10,
        image_filename: 'grocery-001.png',
        status: 'active',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [
      { wch: 42 }, // product_name
      { wch: 38 }, // tamil_name
      { wch: 18 }, // brand
      { wch: 18 }, // category
      { wch: 16 }, // barcode
      { wch: 10 }, // unit
      { wch: 15 }, // purchase_price
      { wch: 15 }, // selling_price
      { wch: 15 }, // opening_stock
      { wch: 15 }, // minimum_stock
      { wch: 22 }, // image_filename
      { wch: 10 }, // status
    ];
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

// GET /api/products/template-csv/download - Download clean CSV import template with UTF-8 BOM
router.get('/template-csv/download', verifyToken, requireRole(['ADMIN']), (req, res) => {
  try {
    const csvHeaders = 'product_name,tamil_name,brand,category,barcode,unit,purchase_price,selling_price,opening_stock,minimum_stock,image_filename,status\r\n';
    const sampleRow1 = '"Parle-G Glucose Biscuit 250g","பார்லே-ஜி குளுக்கோஸ் பிஸ்கட் 250கி","Parle","Biscuits","AS00000001","pack",22.00,25.00,100,15,"biscuit-001.png","active"\r\n';
    const sampleRow2 = '"Aashirvaad Whole Wheat Atta 5kg","ஆசிர்வாத் கோதுமை மாவு 5கிலோ","Aashirvaad","Atta & Flours","AS00000002","kg",240.00,275.00,45,10,"grocery-001.png","active"\r\n';
    const csvContent = '\uFEFF' + csvHeaders + sampleRow1 + sampleRow2;

    res.setHeader('Content-Disposition', 'attachment; filename="anantha_store_products_template.csv"');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(Buffer.from(csvContent, 'utf-8'));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to download CSV template: ' + err.message });
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
    return res.status(404).json({ error: 'Images archive not found.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to download images ZIP: ' + err.message });
  }
});

// POST /api/products/import-preview - Preview & Validate Excel/CSV rows with Barcode validation
router.post('/import-preview', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No data rows provided for import preview.' });
    }

    const categories = await prisma.category.findMany();
    const catMap = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

    const existingProducts = await prisma.product.findMany({
      select: { id: true, name: true, barcode: true, sellingPrice: true, purchaseCost: true, currentStock: true },
    });
    const existingNameMap = new Map(existingProducts.map((p) => [p.name.trim().toLowerCase(), p]));
    const existingBarcodeMap = new Map();
    existingProducts.forEach((p) => {
      if (p.barcode && p.barcode.trim()) {
        existingBarcodeMap.set(p.barcode.trim().toLowerCase(), p);
      }
    });

    const seenNamesInSheet = new Set();
    const seenBarcodesInSheet = new Set();
    const validatedRows = [];
    const failedRows = [];
    let validCount = 0;
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // Normalize column names across multiple formats
      const name = r['product_name'] || r['Product Name'] || r['name'] || r['Item Name'] || r['item_name'] || r['Product'];
      const tamilName = r['tamil_name'] || r['Tamil Name'] || r['tamilName'] || r['Tamil'] || null;
      const brand = r['brand'] || r['Brand'] || null;
      const categoryName = r['category'] || r['Category'] || r['category_name'] || r['Category Name'] || 'Groceries';
      const barcode = r['barcode'] || r['Barcode'] || r['barcode_number'] || r['Barcode Number'] || r['item_barcode'] || null;
      const unit = r['unit'] || r['Unit'] || r['measurement_type'] || 'pcs';
      const purchasePrice = parseFloat(r['purchase_price'] || r['Purchase Cost'] || r['purchase_cost'] || r['cost'] || r['Cost Price'] || 0);
      const sellingPrice = parseFloat(r['selling_price'] || r['Selling Price'] || r['price'] || r['sellingPrice'] || r['MRP'] || r['Rate']);
      const openingStock = parseFloat(r['opening_stock'] || r['Initial Stock'] || r['stock'] || r['Stock'] || r['currentStock'] || r['Quantity'] || 0);
      const minStock = parseFloat(r['minimum_stock'] || r['Min Stock'] || r['min_stock'] || r['minStock'] || r['Reorder Level'] || 5);
      const imageFilename = r['image_filename'] || r['Image Filename'] || r['image'] || r['imageUrl'] || null;
      const status = (r['status'] || r['Status'] || 'active').toLowerCase() === 'inactive' ? false : true;

      const errors = [];
      const warnings = [];

      // 1. Validate Product Name
      const cleanName = name ? String(name).trim() : '';
      if (!cleanName) {
        errors.push('Missing product name');
      } else {
        const lowerName = cleanName.toLowerCase();
        if (seenNamesInSheet.has(lowerName)) {
          warnings.push('Duplicate product name inside this spreadsheet');
        } else {
          seenNamesInSheet.add(lowerName);
        }
      }

      // 2. Validate Barcode (if supplied)
      let cleanBarcode = barcode ? String(barcode).trim() : null;
      if (cleanBarcode) {
        if (!isValidBarcode(cleanBarcode)) {
          errors.push(`Invalid barcode format "${cleanBarcode}" (only alphanumeric, dash, and underscore allowed)`);
        } else {
          const lowerCode = cleanBarcode.toLowerCase();
          if (seenBarcodesInSheet.has(lowerCode)) {
            errors.push(`Duplicate barcode "${cleanBarcode}" inside this spreadsheet`);
          } else {
            seenBarcodesInSheet.add(lowerCode);
          }

          if (existingBarcodeMap.has(lowerCode)) {
            const matchProd = existingBarcodeMap.get(lowerCode);
            if (cleanName && matchProd.name.toLowerCase() !== cleanName.toLowerCase()) {
              errors.push(`Barcode "${cleanBarcode}" is already assigned to "${matchProd.name}" in database`);
            }
          }
        }
      }

      // 3. Validate Selling Price
      if (isNaN(sellingPrice) || sellingPrice <= 0) {
        errors.push('Invalid or non-positive selling price');
      }

      // 4. Validate Purchase Price
      if (isNaN(purchasePrice) || purchasePrice < 0) {
        errors.push('Invalid purchase price');
      } else if (!isNaN(sellingPrice) && sellingPrice < purchasePrice) {
        warnings.push('Selling price is lower than purchase cost');
      }

      // 5. Category
      const catLower = String(categoryName).trim().toLowerCase();
      const existingCatId = catMap.get(catLower) || null;

      // 6. Check Image Filename
      let cleanImageFilename = null;
      let imageUrl = null;
      let imageExists = false;
      if (imageFilename) {
        cleanImageFilename = String(imageFilename).trim().replace(/^\/product-images\//, '');
        imageUrl = `/product-images/${cleanImageFilename}`;
        const localImgPath = path.resolve('public/product-images', cleanImageFilename);
        imageExists = fs.existsSync(localImgPath);
      }

      // 7. Check Database Duplicate by Name or Barcode
      const isExistingByName = cleanName ? existingNameMap.has(cleanName.toLowerCase()) : false;
      const isExistingByBarcode = cleanBarcode ? existingBarcodeMap.has(cleanBarcode.toLowerCase()) : false;
      const isExistingInDb = isExistingByName || isExistingByBarcode;
      const existingDbProduct = isExistingByName
        ? existingNameMap.get(cleanName.toLowerCase())
        : cleanBarcode
        ? existingBarcodeMap.get(cleanBarcode.toLowerCase())
        : null;

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

      const rowObj = {
        rowNumber: i + 1,
        name: cleanName,
        tamilName: tamilName ? String(tamilName).trim() : '',
        brand: brand ? String(brand).trim() : '',
        categoryName: String(categoryName).trim(),
        categoryId: existingCatId,
        barcode: cleanBarcode,
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
        errorMessage: errors.join('; '),
        warnings,
      };

      validatedRows.push(rowObj);
      if (!isValid) {
        failedRows.push(rowObj);
      }
    }

    return res.json({
      totalRows: rows.length,
      validCount,
      newCount,
      duplicateCount,
      errorCount,
      rows: validatedRows,
      failedRows,
    });
  } catch (err) {
    console.error('Import preview error:', err);
    return res.status(500).json({ error: 'Failed to process import preview: ' + err.message });
  }
});

// POST /api/products/import-confirm - Save valid records into database with explicit duplicate resolution
router.post('/import-confirm', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { validRows, onDuplicate = 'SKIP' } = req.body; // onDuplicate: 'SKIP' | 'UPDATE' | 'NEW_ONLY'
    if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
      return res.status(400).json({ error: 'No valid rows provided to import.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const failedRows = [];

      for (const row of validRows) {
        if (!row.isValid) {
          failedCount++;
          failedRows.push({ ...row, reason: row.errors?.join('; ') || 'Row failed validation' });
          continue;
        }

        try {
          // Ensure category exists
          let catId = row.categoryId;
          if (!catId && row.categoryName) {
            let cat = await tx.category.findUnique({ where: { name: row.categoryName } });
            if (!cat) {
              cat = await tx.category.create({ data: { name: row.categoryName } });
            }
            catId = cat.id;
          }

          // Check if product already exists by name or by barcode
          let existing = null;
          if (row.existingId) {
            existing = await tx.product.findUnique({ where: { id: row.existingId } });
          } else {
            existing = await tx.product.findFirst({
              where: {
                OR: [
                  { name: { equals: row.name } },
                  row.barcode ? { barcode: { equals: row.barcode } } : undefined,
                ].filter(Boolean),
              },
            });
          }

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
          const rowPricePerKg = rowMt === 'KG' ? rowPrice : null;

          if (existing) {
            if (onDuplicate === 'UPDATE') {
              const oldPrice = existing.sellingPrice;
              const newStock = Number(existing.currentStock) + Number(row.openingStock || 0);

              // Check if barcode can be safely updated
              let finalBarcode = existing.barcode;
              if (row.barcode && row.barcode.trim()) {
                const bTrim = row.barcode.trim();
                const clash = await tx.product.findFirst({
                  where: { barcode: bTrim, NOT: { id: existing.id } },
                });
                if (!clash) finalBarcode = bTrim;
              }

              await tx.product.update({
                where: { id: existing.id },
                data: {
                  tamilName: row.tamilName || existing.tamilName,
                  brand: row.brand || existing.brand,
                  barcode: finalBarcode,
                  categoryId: catId || existing.categoryId,
                  unit: row.unit || existing.unit,
                  measurementType: existing.measurementType || rowMt,
                  baseUnit: existing.baseUnit || rowBaseUnit,
                  pricePerKg: existing.measurementType === 'KG' || rowMt === 'KG' ? rowPrice : existing.pricePerKg,
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
              // onDuplicate === 'SKIP' or 'NEW_ONLY'
              skippedCount++;
            }
          } else {
            // Create brand new product
            let finalBarcode = row.barcode ? String(row.barcode).trim() : null;
            if (finalBarcode) {
              const clash = await tx.product.findUnique({ where: { barcode: finalBarcode } });
              if (clash) {
                // If barcode clashes, set null so it is safely eligible for Bulk Barcode Generation
                finalBarcode = null;
              }
            }

            const p = await tx.product.create({
              data: {
                name: row.name,
                tamilName: row.tamilName || null,
                brand: row.brand || null,
                barcode: finalBarcode,
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
        } catch (rowErr) {
          failedCount++;
          failedRows.push({ ...row, reason: rowErr.message });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'EXCEL_PRODUCTS_IMPORTED',
          entity: 'PRODUCT',
          details: `Excel bulk import: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${failedCount} failed. Mode: ${onDuplicate}`,
        },
      });

      return { createdCount, updatedCount, skippedCount, failedCount, failedRows };
    });

    return res.status(201).json({
      success: true,
      message: `Excel import complete! ${result.createdCount} products created, ${result.updatedCount} updated, ${result.skippedCount} skipped${result.failedCount > 0 ? `, ${result.failedCount} failed` : ''}.`,
      ...result,
      totalSaved: result.createdCount + result.updatedCount,
    });
  } catch (err) {
    console.error('Import confirm error:', err);
    return res.status(500).json({ error: 'Failed to import products: ' + err.message });
  }
});

// DELETE /api/products/:id - Delete or archive product safely (Admin only)
router.delete('/:id', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { saleItems: true, purchaseItems: true },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const hasHistory = product._count.saleItems > 0 || product._count.purchaseItems > 0;

    if (hasHistory) {
      // Soft-delete / deactivate product to preserve sales history
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'PRODUCT_DEACTIVATED',
          entity: 'PRODUCT',
          entityId: String(id),
          details: `Deactivated product "${product.name}" (archived to preserve ${product._count.saleItems} sales and ${product._count.purchaseItems} purchases).`,
        },
      }).catch(() => {});

      return res.json({
        success: true,
        action: 'DEACTIVATED',
        message: `Product "${product.name}" was deactivated (archived) to preserve historical billing records.`,
      });
    } else {
      // Safe to permanently delete
      await prisma.stockMovement.deleteMany({ where: { productId: id } });
      await prisma.priceHistory.deleteMany({ where: { productId: id } });
      await prisma.product.delete({ where: { id } });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'PRODUCT_DELETED',
          entity: 'PRODUCT',
          entityId: String(id),
          details: `Permanently deleted product "${product.name}" (no historical sales referenced).`,
        },
      }).catch(() => {});

      return res.json({
        success: true,
        action: 'DELETED',
        message: `Product "${product.name}" was permanently deleted.`,
      });
    }
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ error: 'Failed to delete product: ' + err.message });
  }
});

// POST /api/products/bulk-delete - Safe bulk delete / deactivate (Admin only)
router.post('/bulk-delete', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const productIds = req.body.productIds || req.body.ids;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'No product IDs provided.' });
    }

    let deletedCount = 0;
    let deactivatedCount = 0;

    for (const rawId of productIds) {
      const id = parseInt(rawId, 10);
      if (isNaN(id)) continue;

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          _count: { select: { saleItems: true, purchaseItems: true } },
        },
      });
      if (!product) continue;

      const hasHistory = product._count.saleItems > 0 || product._count.purchaseItems > 0;
      if (hasHistory) {
        await prisma.product.update({ where: { id }, data: { isActive: false } });
        deactivatedCount++;
      } else {
        await prisma.stockMovement.deleteMany({ where: { productId: id } });
        await prisma.priceHistory.deleteMany({ where: { productId: id } });
        await prisma.product.delete({ where: { id } });
        deletedCount++;
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PRODUCTS_BULK_DELETED',
        entity: 'PRODUCT',
        details: `Bulk processed ${productIds.length} products (${deletedCount} deleted, ${deactivatedCount} deactivated)`,
      },
    }).catch(() => {});

    return res.json({
      success: true,
      deletedCount,
      deactivatedCount,
      totalProcessed: deletedCount + deactivatedCount,
      message: `Successfully processed ${deletedCount + deactivatedCount} products: ${deletedCount} deleted, ${deactivatedCount} deactivated to preserve transaction history.`,
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    return res.status(500).json({ error: 'Failed to delete products: ' + err.message });
  }
});

export default router;
