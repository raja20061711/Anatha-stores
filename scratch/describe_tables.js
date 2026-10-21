import prisma from '../server/db.js';

async function check() {
  try {
    const pCols = await prisma.$queryRawUnsafe('DESCRIBE products');
    console.log('products columns:', pCols.map(c => c.Field + ' ' + c.Type));
    const sCols = await prisma.$queryRawUnsafe('DESCRIBE sale_items');
    console.log('sale_items columns:', sCols.map(c => c.Field + ' ' + c.Type));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
