import prisma from '../server/db.js';

async function check() {
  try {
    const item = await prisma.saleItem.findFirst();
    console.log('SaleItem:', item);
  } catch (err) {
    console.error('SaleItem error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
