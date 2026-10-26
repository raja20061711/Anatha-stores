import { jsPDF } from 'jspdf';
import { encodeCode128B } from './code128.js';

/**
 * Dimensions mapping in millimeters [width, height]
 */
const LABEL_DIMENSIONS = {
  '38x25': { width: 38, height: 25 },
  '50x25': { width: 50, height: 25 },
  '50x30': { width: 50, height: 30 },
  '85x40': { width: 85, height: 40 },
};

/**
 * High-performance LRU-style in-memory cache for barcode patterns.
 * Prevents re-computing Code 128 modular patterns for identical products/barcodes.
 */
const barcodePatternCache = new Map();

function getBarcodePattern(value) {
  if (!value) return null;
  const str = String(value);
  if (barcodePatternCache.has(str)) {
    return barcodePatternCache.get(str);
  }
  const pattern = encodeCode128B(str);
  if (!pattern) return null;

  let totalModules = 0;
  for (let i = 0; i < pattern.length; i++) {
    totalModules += parseInt(pattern[i], 10);
  }

  const result = { pattern, totalModules };
  barcodePatternCache.set(str, result);
  return result;
}

/**
 * Cache for Tamil text images rendered via offscreen canvas.
 * Avoids redundant rasterization across thousands of repeating labels.
 */
const tamilImageCache = new Map();

function getCachedTamilImage(tamilText) {
  if (!tamilText || typeof document === 'undefined') return null;
  if (tamilImageCache.has(tamilText)) {
    return tamilImageCache.get(tamilText);
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.font = 'bold 22px "Noto Sans Tamil", "Nirmala UI", sans-serif';
    const metrics = ctx.measureText(tamilText);
    const textW = Math.max(10, Math.ceil(metrics.width) + 8);
    const textH = 28;

    canvas.width = textW;
    canvas.height = textH;

    ctx.font = 'bold 22px "Noto Sans Tamil", "Nirmala UI", sans-serif';
    ctx.fillStyle = '#333333';
    ctx.textBaseline = 'middle';
    ctx.fillText(tamilText, 4, textH / 2);

    const dataUrl = canvas.toDataURL('image/png');
    const entry = { dataUrl, width: textW, height: textH };
    tamilImageCache.set(tamilText, entry);
    return entry;
  } catch (err) {
    return null;
  }
}

/**
 * Draws a scannable, razor-sharp vector Code 128 barcode directly into a jsPDF document.
 * Utilizes cached barcode patterns for maximum speed.
 */
function drawVectorBarcode(doc, value, x, y, targetWidth, targetHeight) {
  if (!value) return;
  const entry = getBarcodePattern(value);
  if (!entry) return;

  const { pattern, totalModules } = entry;
  const moduleWidth = targetWidth / totalModules;
  let currentX = x;

  doc.setFillColor(0, 0, 0);

  // Even indexes are bars, odd indexes are spaces
  for (let i = 0; i < pattern.length; i++) {
    const modules = parseInt(pattern[i], 10);
    const barWidth = modules * moduleWidth;
    if (i % 2 === 0) {
      doc.rect(currentX, y, barWidth, targetHeight, 'F');
    }
    currentX += barWidth;
  }

  // Draw human-readable text underneath barcode
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(String(value), x + (targetWidth / 2), y + targetHeight + 2.5, { align: 'center' });
}

/**
 * Generate high-volume vector barcode labels in PDF format with async batch yielding.
 * Supports jobs from 100 up to 5,000 labels without freezing the browser UI.
 *
 * @param {Array<Object>} labels List of flattened label product objects
 * @param {Object} options Configuration options
 * @param {string} options.labelSize '38x25' | '50x25' | '50x30' | '85x40'
 * @param {boolean} options.showStoreName
 * @param {boolean} options.showTamilTitle
 * @param {boolean} options.showPrice
 * @param {boolean} options.showNetQty
 * @param {Function} options.onProgress Callback: (current, total) => void
 * @param {Function} options.shouldCancel Callback returning true to cancel job
 */
export async function generateBarcodeLabelsPDF(labels, options = {}) {
  const {
    labelSize = '50x25',
    showStoreName = true,
    showTamilTitle = false,
    showPrice = true,
    showNetQty = true,
    onProgress = () => {},
    shouldCancel = () => false,
  } = options;

  if (!labels || labels.length === 0) {
    throw new Error('No barcode labels provided for PDF generation.');
  }

  const dims = LABEL_DIMENSIONS[labelSize] || LABEL_DIMENSIONS['50x25'];
  const { width: pageW, height: pageH } = dims;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pageW, pageH],
    compress: true,
  });

  const total = labels.length;
  // Dynamic batch size: for very large jobs yield every 40 labels to keep main thread fluid
  const BATCH_SIZE = total > 1000 ? 40 : 50;

  try {
    for (let i = 0; i < total; i++) {
      if (shouldCancel && shouldCancel()) {
        throw new Error('Barcode generation cancelled by user.');
      }

      if (i > 0) {
        doc.addPage([pageW, pageH], 'landscape');
      }

      const p = labels[i];
      const isWeight = (p.measurementType || '').toUpperCase() === 'WEIGHT' ||
                       (p.unit || '').toLowerCase() === 'kg' ||
                       (p.unit || '').toLowerCase() === 'g';

      // Outer subtle border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.rect(0.5, 0.5, pageW - 1, pageH - 1);

      let curY = 3.2;

      // 1. Store Header
      if (showStoreName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(pageH >= 30 ? 7 : 6);
        doc.setTextColor(0, 0, 0);
        doc.text('ANANTHA STORES', pageW / 2, curY, { align: 'center' });

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.line(2, curY + 0.8, pageW - 2, curY + 0.8);
        curY += 2.6;
      }

      // 2. Product Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(pageH >= 30 ? 7.5 : 6.5);
      doc.setTextColor(0, 0, 0);

      const maxChars = pageW >= 85 ? 40 : pageW >= 50 ? 24 : 18;
      const displayName = (p.name || 'Product').length > maxChars
        ? (p.name || 'Product').slice(0, maxChars - 1) + '..'
        : (p.name || 'Product');

      doc.text(displayName, pageW / 2, curY, { align: 'center' });
      curY += 2.8;

      // 2b. Tamil Title (Cached Image if enabled)
      if (showTamilTitle && p.tamilName) {
        const tamilImg = getCachedTamilImage(p.tamilName);
        if (tamilImg) {
          const imgH = 2.4;
          const maxImgW = pageW - 6;
          const imgW = Math.min(maxImgW, (tamilImg.width / tamilImg.height) * imgH);
          const imgX = (pageW - imgW) / 2;
          doc.addImage(tamilImg.dataUrl, 'PNG', imgX, curY - 0.4, imgW, imgH);
          curY += imgH + 0.6;
        }
      }

      // 3. Vector Code 128 Barcode
      const barcodeW = pageW - (pageW >= 85 ? 24 : 10);
      const barcodeH = pageH >= 40 ? 14 : pageH >= 30 ? 10 : 8.5;
      const barcodeX = (pageW - barcodeW) / 2;

      drawVectorBarcode(doc, p.barcode, barcodeX, curY, barcodeW, barcodeH);
      curY += barcodeH + 3.8;

      // 4. Bottom Line: Net Quantity & Price
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.line(2, curY, pageW - 2, curY);
      curY += 2.4;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(pageH >= 30 ? 7.5 : 6.5);

      if (showNetQty) {
        const netLabel = isWeight ? '1 KG' : (p.packSize || p.unit || '1 pcs');
        doc.setTextColor(80, 80, 80);
        doc.text(netLabel, 3, curY);
      }

      if (showPrice) {
        const priceText = `MRP: Rs.${Number(p.sellingPrice || 0).toFixed(2)}${isWeight ? '/kg' : ''}`;
        doc.setTextColor(0, 0, 0);
        doc.text(priceText, pageW - 3, curY, { align: 'right' });
      }

      // Yield control periodically to allow UI rendering and smooth progress update
      if (i % BATCH_SIZE === 0 || i === total - 1) {
        onProgress(i + 1, total);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const filename = `ANANTHA_BARCODES_${labelSize}_${total}labels_${new Date().toISOString().split('T')[0]}.pdf`;

    // Fast, leak-free download using Blob and Object URL
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } else {
      doc.save(filename);
    }

    return { success: true, count: total, filename };
  } finally {
    // Release cache memory when large batch finishes to avoid long-term memory accumulation
    if (total > 500) {
      barcodePatternCache.clear();
      tamilImageCache.clear();
    }
  }
}
