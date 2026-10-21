import prisma from '../server/db.js';

async function check() {
  try {
    const updated = await prisma.product.update({
      where: { id: 1 },
      data: {
        measurementType: 'PACK',
        baseUnit: 'pack',
      }
    });
    console.log('Update success:', updated.id, updated.measurementType);
  } catch (err) {
    console.error('Update error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
