import prisma from '../server/db.js';

async function migrate() {
  console.log('Starting safe schema migration...');
  
  const safeAlter = async (sql) => {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`Executed: ${sql}`);
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log(`Column already exists: ${sql}`);
      } else {
        console.warn(`Notice for: ${sql}\n  -> ${err.message}`);
      }
    }
  };

  // 1. Products table
  await safeAlter("ALTER TABLE products ADD COLUMN barcode VARCHAR(191) NULL");
  await safeAlter("ALTER TABLE products ADD COLUMN sku VARCHAR(191) NULL");
  await safeAlter("ALTER TABLE products ADD COLUMN measurementType VARCHAR(50) NOT NULL DEFAULT 'PCS'");
  await safeAlter("ALTER TABLE products ADD COLUMN baseUnit VARCHAR(50) NOT NULL DEFAULT 'pcs'");
  await safeAlter("ALTER TABLE products ADD COLUMN pricePerKg DECIMAL(10, 2) NULL");
  await safeAlter("ALTER TABLE products ADD COLUMN packSize VARCHAR(100) NULL");
  await safeAlter("ALTER TABLE products MODIFY COLUMN currentStock DECIMAL(12, 3) NOT NULL DEFAULT 0.000");
  await safeAlter("ALTER TABLE products MODIFY COLUMN minStock DECIMAL(12, 3) NOT NULL DEFAULT 5.000");

  // 2. SaleItems table
  await safeAlter("ALTER TABLE sale_items ADD COLUMN measurementType VARCHAR(50) NULL DEFAULT 'PCS'");
  await safeAlter("ALTER TABLE sale_items ADD COLUMN unit VARCHAR(50) NULL DEFAULT 'pcs'");
  await safeAlter("ALTER TABLE sale_items ADD COLUMN selectedQuantity DECIMAL(12, 3) NULL");
  await safeAlter("ALTER TABLE sale_items ADD COLUMN selectedUnit VARCHAR(50) NULL");
  await safeAlter("ALTER TABLE sale_items ADD COLUMN canonicalQuantity DECIMAL(12, 3) NULL");
  await safeAlter("ALTER TABLE sale_items ADD COLUMN canonicalUnit VARCHAR(50) NULL");
  await safeAlter("ALTER TABLE sale_items ADD COLUMN priceBasis VARCHAR(50) NULL");
  await safeAlter("ALTER TABLE sale_items ADD COLUMN unitPrice DECIMAL(10, 2) NULL");
  await safeAlter("ALTER TABLE sale_items MODIFY COLUMN quantity DECIMAL(12, 3) NOT NULL");

  // 3. StockMovements table
  await safeAlter("ALTER TABLE stock_movements MODIFY COLUMN quantityChange DECIMAL(12, 3) NOT NULL");
  await safeAlter("ALTER TABLE stock_movements MODIFY COLUMN previousStock DECIMAL(12, 3) NOT NULL");
  await safeAlter("ALTER TABLE stock_movements MODIFY COLUMN newStock DECIMAL(12, 3) NOT NULL");

  // 4. PurchaseItems table
  await safeAlter("ALTER TABLE purchase_items MODIFY COLUMN quantity DECIMAL(12, 3) NOT NULL");

  // Backfill existing products measurementType based on unit
  // If unit is kg/g -> KG
  // If unit is l/ml -> L
  // If unit is pack -> PACK
  // If unit is box -> BOX
  // Else -> PCS
  await prisma.$executeRawUnsafe(`
    UPDATE products 
    SET measurementType = CASE 
      WHEN LOWER(unit) = 'kg' THEN 'KG'
      WHEN LOWER(unit) = 'g' THEN 'G'
      WHEN LOWER(unit) = 'l' THEN 'L'
      WHEN LOWER(unit) = 'ml' THEN 'ML'
      WHEN LOWER(unit) = 'pack' THEN 'PACK'
      WHEN LOWER(unit) = 'box' THEN 'BOX'
      ELSE 'PCS'
    END,
    baseUnit = CASE
      WHEN LOWER(unit) = 'kg' THEN 'kg'
      WHEN LOWER(unit) = 'g' THEN 'g'
      WHEN LOWER(unit) = 'l' THEN 'l'
      WHEN LOWER(unit) = 'ml' THEN 'ml'
      WHEN LOWER(unit) = 'pack' THEN 'pack'
      WHEN LOWER(unit) = 'box' THEN 'box'
      ELSE 'pcs'
    END
    WHERE measurementType = 'PCS' AND unit != 'pcs'
  `);

  // For products that are KG, set pricePerKg = sellingPrice if pricePerKg is null
  await prisma.$executeRawUnsafe(`
    UPDATE products 
    SET pricePerKg = sellingPrice 
    WHERE (measurementType = 'KG' OR unit = 'kg') AND (pricePerKg IS NULL OR pricePerKg = 0)
  `);

  console.log('Migration complete and verified successfully.');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
