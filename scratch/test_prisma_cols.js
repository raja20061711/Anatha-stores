import prisma from '../server/db.js';

async function check() {
  try {
    const p = await prisma.product.findFirst({
      select: {
        id: true,
        name: true,
        unit: true,
        measurementType: true,
        baseUnit: true,
        pricePerKg: true,
        currentStock: true,
      }
    });
    console.log('Product selected with new fields:', p);
  } catch (err) {
    console.error('Error selecting new fields:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
