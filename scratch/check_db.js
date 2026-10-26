import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      barcode: true,
      measurementType: true,
      baseUnit: true,
      sellingPrice: true,
      pricePerKg: true,
      currentStock: true,
    },
  });
  console.log('Total products:', products.length);
  const barcodeMap = new Map();
  let duplicates = 0;
  let nullBarcodes = 0;
  products.forEach((p) => {
    if (!p.barcode || p.barcode.trim() === '') {
      nullBarcodes++;
    } else {
      if (barcodeMap.has(p.barcode)) {
        duplicates++;
        console.log('Duplicate barcode:', p.barcode, 'for product:', p.name);
      }
      barcodeMap.set(p.barcode, true);
    }
  });
  console.log('Null or empty barcodes:', nullBarcodes, 'Duplicates:', duplicates);
  console.log('Sample 3 products:', products.slice(0, 3));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
