import prisma from './server/db.js';
import Fuse from 'fuse.js';

async function testFuzzy() {
  const products = await prisma.product.findMany({ include: { category: true } });
  console.log(`Testing Fuse.js on ${products.length} live database products:`);

  const fuse = new Fuse(products, {
    keys: ['name', 'tamilName', 'brand', 'category.name'],
    threshold: 0.45,
    distance: 100,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const testQueries = ['biscut', 'milkk', 'atta', 'sope', 'coffe', 'choclate'];
  for (const q of testQueries) {
    const res = fuse.search(q).map((r) => r.item.name);
    console.log(`Typo Query "${q}": Found ${res.length} matches => ${res.slice(0, 2).join(' AND ')}`);
  }

  await prisma.$disconnect();
}

testFuzzy();
