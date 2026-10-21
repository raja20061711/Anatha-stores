export function roundMoney(val) {
  const paise = Math.round((Number(val) + Number.EPSILON) * 100);
  return paise / 100;
}

export function isWeightBased(product) {
  if (!product) return false;
  const mt = String(product.measurementType || '').toUpperCase();
  const u = String(product.unit || product.baseUnit || '').toLowerCase();
  return mt === 'KG' || mt === 'G' || u === 'kg' || u === 'g';
}

export function isLiquidBased(product) {
  if (!product) return false;
  const mt = String(product.measurementType || '').toUpperCase();
  const u = String(product.unit || product.baseUnit || '').toLowerCase();
  return mt === 'L' || mt === 'ML' || u === 'l' || u === 'ml';
}

export function getPriceBasis(product) {
  if (isWeightBased(product)) return 'PER_KG';
  if (isLiquidBased(product)) return 'PER_L';
  const mt = String(product.measurementType || '').toUpperCase();
  if (mt === 'PACK') return 'PER_PACK';
  if (mt === 'BOX') return 'PER_BOX';
  return 'PER_PIECE';
}

export function getPriceBasisLabel(product) {
  if (isWeightBased(product)) return '/kg';
  if (isLiquidBased(product)) return '/L';
  const mt = String(product.measurementType || '').toUpperCase();
  if (mt === 'PACK') return '/pack';
  if (mt === 'BOX') return '/box';
  return '/pc';
}

export function getCanonicalPrice(product) {
  if (isWeightBased(product)) {
    return Number(product.pricePerKg ?? product.sellingPrice ?? 0);
  }
  return Number(product.sellingPrice ?? 0);
}

export function convertToCanonical(qty, unit, measurementType) {
  const numQty = parseFloat(qty);
  if (isNaN(numQty) || numQty <= 0) {
    throw new Error('Quantity must be a valid positive number');
  }

  const u = String(unit || '').toLowerCase().trim();
  const mt = String(measurementType || '').toUpperCase().trim();

  // Weight-based
  if (mt === 'KG' || mt === 'G' || u === 'kg' || u === 'g') {
    if (u === 'g' || u === 'gram' || u === 'grams') {
      return {
        canonicalQty: roundPrecision(numQty / 1000, 4),
        canonicalUnit: 'kg',
        selectedQty: numQty,
        selectedUnit: 'g',
      };
    }
    // Default or explicitly kg
    return {
      canonicalQty: roundPrecision(numQty, 4),
      canonicalUnit: 'kg',
      selectedQty: numQty,
      selectedUnit: 'kg',
    };
  }

  // Liquid-based
  if (mt === 'L' || mt === 'ML' || u === 'l' || u === 'ml') {
    if (u === 'ml' || u === 'millilitre' || u === 'milliliter') {
      return {
        canonicalQty: roundPrecision(numQty / 1000, 4),
        canonicalUnit: 'l',
        selectedQty: numQty,
        selectedUnit: 'ml',
      };
    }
    return {
      canonicalQty: roundPrecision(numQty, 4),
      canonicalUnit: 'l',
      selectedQty: numQty,
      selectedUnit: 'l',
    };
  }

  // Count/piece-based (PCS, PACK, BOX)
  const normUnit = u || (mt === 'PACK' ? 'pack' : mt === 'BOX' ? 'box' : 'pcs');
  return {
    canonicalQty: numQty,
    canonicalUnit: normUnit,
    selectedQty: numQty,
    selectedUnit: normUnit,
  };
}

export function calculateLineTotal(product, qty, unit, overrideRate = null) {
  const mt = product.measurementType || (isWeightBased(product) ? 'KG' : isLiquidBased(product) ? 'L' : 'PCS');
  const { canonicalQty, canonicalUnit, selectedQty, selectedUnit } = convertToCanonical(qty, unit, mt);
  
  const unitPrice = overrideRate !== null && overrideRate !== undefined && !isNaN(parseFloat(overrideRate))
    ? parseFloat(overrideRate)
    : getCanonicalPrice(product);

  const priceBasis = getPriceBasis(product);
  const lineTotal = roundMoney(canonicalQty * unitPrice);

  return {
    canonicalQty,
    canonicalUnit,
    selectedQty,
    selectedUnit,
    unitPrice,
    priceBasis,
    lineTotal,
  };
}

export function roundPrecision(num, decimals = 4) {
  const factor = Math.pow(10, decimals);
  return Math.round((Number(num) + Number.EPSILON) * factor) / factor;
}

export function formatQuantityWithUnit(canonicalQty, selectedQty, selectedUnit) {
  if (selectedQty !== undefined && selectedQty !== null && selectedUnit) {
    return `${selectedQty} ${selectedUnit}`;
  }
  const q = Number(canonicalQty);
  if (isNaN(q)) return '1';
  return String(q);
}
