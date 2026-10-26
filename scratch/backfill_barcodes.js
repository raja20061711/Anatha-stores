import prisma from '../server/db.js';

async function backfill() {
  const products = await prisma.product.findMany({
    orderBy: { id: 'asc' },
  });

  console.log(`Starting backfill for ${products.length} products...`);
  let counter = 1;

  for (const product of products) {
    const code = `AS${String(counter).padStart(8, '0')}`;
    await prisma.product.update({
      where: { id: product.id },
      data: { barcode: code },
    });
    counter++;
  }

  console.log(`Successfully backfilled ${counter - 1} products with unique AS barcodes.`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
