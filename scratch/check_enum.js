import prisma from '../server/db.js';

async function check() {
  try {
    const cols = await prisma.$queryRawUnsafe('DESCRIBE sales');
    console.log('sales cols:', cols.find(c => c.Field === 'paymentMethod'));
    const pmCols = await prisma.$queryRawUnsafe('DESCRIBE payments');
    console.log('payments cols:', pmCols.find(c => c.Field === 'paymentMethod'));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
