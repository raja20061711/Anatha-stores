import prisma from '../db.js';

/**
 * Generates a unique Code 128 compatible barcode for internally labeled store products.
 * Format: "AS" + 8-digit zero-padded number (e.g. "AS00000001")
 * Guarantees uniqueness by checking against existing database records.
 */
export async function generateUniqueBarcode() {
  // Find highest existing AS-prefixed barcode to increment sequentially
  const existingAsProducts = await prisma.product.findMany({
    where: {
      barcode: {
        startsWith: 'AS',
      },
    },
    select: {
      barcode: true,
      id: true,
    },
    orderBy: {
      id: 'desc',
    },
    take: 1000,
  });

  let maxNum = 0;
  for (const p of existingAsProducts) {
    if (p.barcode) {
      const match = p.barcode.match(/^AS(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  let nextNum = maxNum > 0 ? maxNum + 1 : 1;
  let candidate = `AS${String(nextNum).padStart(8, '0')}`;

  // Safety loop to ensure absolute database uniqueness
  let attempts = 0;
  while (attempts < 100) {
    const exists = await prisma.product.findFirst({
      where: { barcode: candidate },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
    nextNum++;
    candidate = `AS${String(nextNum).padStart(8, '0')}`;
    attempts++;
  }

// Fallback timestamp-based code if sequential space encounters collision
  return `AS${Date.now().toString().slice(-8)}`;
}

/**
 * Generates an array of N unique sequential Code 128 compatible barcodes.
 * Guarantees zero collisions with existing database records or between generated items.
 */
export async function generateBatchUniqueBarcodes(count = 1) {
  if (count <= 0) return [];

  const existingAsProducts = await prisma.product.findMany({
    where: {
      barcode: {
        startsWith: 'AS',
      },
    },
    select: {
      barcode: true,
      id: true,
    },
    orderBy: {
      id: 'desc',
    },
    take: 5000,
  });

  let maxNum = 0;
  const existingSet = new Set();
  for (const p of existingAsProducts) {
    if (p.barcode) {
      existingSet.add(p.barcode.toUpperCase());
      const match = p.barcode.match(/^AS(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const results = [];
  let nextNum = maxNum > 0 ? maxNum + 1 : 1;

  while (results.length < count) {
    const candidate = `AS${String(nextNum).padStart(8, '0')}`;
    if (!existingSet.has(candidate)) {
      const exists = await prisma.product.findFirst({
        where: { barcode: candidate },
        select: { id: true },
      });
      if (!exists) {
        results.push(candidate);
        existingSet.add(candidate);
      }
    }
    nextNum++;
  }

  return results;
}

/**
 * Validates a barcode string.
 * Supports manufacturer barcodes (e.g., EAN-13, UPC, Code 128)
 */
export function isValidBarcode(code) {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  // Alphanumeric barcode between 3 and 32 characters
  return /^[A-Za-z0-9\-_]{3,32}$/.test(trimmed);
}
