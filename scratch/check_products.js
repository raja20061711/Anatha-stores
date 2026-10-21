import prisma from '../server/db.js';

async function check() {
  try {
    const products = await prisma.product.findMany({ take: 10 });
    console.log('Sample products:');
    products.forEach(p => {
      console.log(`[${p.id}] ${p.name} | unit: ${p.unit} | sellingPrice: ${p.sellingPrice} | stock: ${p.currentStock}`);
    });
    const units = await prisma.product.groupBy({
      by: ['unit'],
      _count: true
    });
    console.log('Distinct units in DB:', units);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
