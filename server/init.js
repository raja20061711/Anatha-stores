import bcrypt from 'bcryptjs';
import prisma from './db.js';

export async function initializeDatabase() {
  try {
    // 1. Ensure Application Settings
    const existingSettings = await prisma.applicationSettings.findFirst();
    if (!existingSettings) {
      await prisma.applicationSettings.create({
        data: {
          id: 1,
          shopName: 'ANANTHA STORE',
          address: 'No. 12, Main Bazaar Road, Supermarket Complex, Tamil Nadu',
          phone: '+91 98421 23456',
          currency: '₹',
          receiptSize: '80mm',
          taxPercentage: 0.0,
          enableCashierPriceOverride: true,
          requireOverrideReason: true,
          minAllowedPricePercentage: 50.0,
          zeroPriceAllowed: false,
        },
      });
      console.log('✔ Initialized default application settings');
    }

    // 2. Ensure Loyalty Settings
    const existingLoyalty = await prisma.loyaltySettings.findFirst();
    if (!existingLoyalty) {
      await prisma.loyaltySettings.create({
        data: {
          id: 1,
          isEnabled: true,
          minPurchaseAmount: 100.0,
          pointsPerAmount: 5.0, // 5 points per 100 spent
          pointsRedemptionValue: 1.0, // 1 point = 1 INR discount
          minRedemptionPoints: 10.0,
        },
      });
      console.log('✔ Initialized default loyalty settings');
    }

    // 3. Ensure Default Users for All 3 Roles
    const defaultUsers = [
      {
        fullName: 'Anantha Admin (Owner)',
        username: 'admin',
        passwordPlain: 'admin123',
        role: 'ADMIN',
      },
      {
        fullName: 'Kannan (Store Manager)',
        username: 'manager',
        passwordPlain: 'manager123',
        role: 'MANAGER',
      },
      {
        fullName: 'Murugan (Billing Cashier)',
        username: 'cashier',
        passwordPlain: 'cashier123',
        role: 'CASHIER',
      },
    ];

    for (const u of defaultUsers) {
      const existing = await prisma.user.findFirst({
        where: { username: u.username },
      });
      if (!existing) {
        const hash = await bcrypt.hash(u.passwordPlain, 10);
        await prisma.user.create({
          data: {
            fullName: u.fullName,
            username: u.username,
            passwordHash: hash,
            role: u.role,
            isActive: true,
          },
        });
        console.log(`✔ Created default account: ${u.username} (${u.role})`);
      }
    }

    // 4. Ensure Categories
    const categoryMap = {};
    const defaultCategories = [
      'Biscuits',
      'Beverages',
      'Dairy',
      'Snacks',
      'Groceries',
      'Personal Care',
      'Household',
    ];

    for (const name of defaultCategories) {
      let cat = await prisma.category.findUnique({ where: { name } });
      if (!cat) {
        cat = await prisma.category.create({ data: { name } });
      }
      categoryMap[name] = cat.id;
    }

    // 5. Ensure Initial Supermarket Products with Tamil Names
    const productCount = await prisma.product.count();
    if (productCount === 0) {
      const sampleProducts = [
        {
          name: 'Parle-G Biscuit 250g',
          tamilName: 'பார்லே-ஜி பிஸ்கட்',
          brand: 'Parle',
          categoryName: 'Biscuits',
          unit: 'pack',
          purchaseCost: 22.0,
          sellingPrice: 25.0,
          currentStock: 120.0,
          minStock: 20.0,
        },
        {
          name: 'Britannia Good Day Butter 200g',
          tamilName: 'குட் டே பிஸ்கட்',
          brand: 'Britannia',
          categoryName: 'Biscuits',
          unit: 'pack',
          purchaseCost: 35.0,
          sellingPrice: 40.0,
          currentStock: 85.0,
          minStock: 15.0,
        },
        {
          name: 'Oreo Original Vanilla 120g',
          tamilName: 'ஓரியோ பிஸ்கட்',
          brand: 'Cadbury',
          categoryName: 'Biscuits',
          unit: 'pack',
          purchaseCost: 28.0,
          sellingPrice: 35.0,
          currentStock: 60.0,
          minStock: 10.0,
        },
        {
          name: 'Aavin Toned Milk 500ml',
          tamilName: 'ஆவின் பால் 500மி.லி',
          brand: 'Aavin',
          categoryName: 'Dairy',
          unit: 'pack',
          purchaseCost: 22.0,
          sellingPrice: 25.0,
          currentStock: 50.0,
          minStock: 15.0,
        },
        {
          name: 'Arogya Full Cream Milk 500ml',
          tamilName: 'ஆரோக்கியா பால்',
          brand: 'Arogya',
          categoryName: 'Dairy',
          unit: 'pack',
          purchaseCost: 30.0,
          sellingPrice: 34.0,
          currentStock: 40.0,
          minStock: 10.0,
        },
        {
          name: 'Amul Butter 100g',
          tamilName: 'அமுல் வெண்ணெய்',
          brand: 'Amul',
          categoryName: 'Dairy',
          unit: 'pcs',
          purchaseCost: 50.0,
          sellingPrice: 58.0,
          currentStock: 45.0,
          minStock: 10.0,
        },
        {
          name: 'Ponni Boiled Rice 5kg',
          tamilName: 'பொன்னி புழுங்கல் அரிசி 5கிலோ',
          brand: 'Anantha Special',
          categoryName: 'Groceries',
          unit: 'bag',
          purchaseCost: 290.0,
          sellingPrice: 330.0,
          currentStock: 30.0,
          minStock: 8.0,
        },
        {
          name: 'Tata Salt 1kg',
          tamilName: 'டாடா உப்பு 1கிலோ',
          brand: 'Tata',
          categoryName: 'Groceries',
          unit: 'pack',
          purchaseCost: 22.0,
          sellingPrice: 28.0,
          currentStock: 90.0,
          minStock: 25.0,
        },
        {
          name: 'Fortune Sunlite Sunflower Oil 1L',
          tamilName: 'சூரியகாந்தி எண்ணெய் 1லி',
          brand: 'Fortune',
          categoryName: 'Groceries',
          unit: 'pouch',
          purchaseCost: 125.0,
          sellingPrice: 145.0,
          currentStock: 40.0,
          minStock: 10.0,
        },
        {
          name: 'Aashirvaad Shudh Chakki Atta 5kg',
          tamilName: 'ஆசீர்வாத் கோதுமை மாவு',
          brand: 'Aashirvaad',
          categoryName: 'Groceries',
          unit: 'bag',
          purchaseCost: 240.0,
          sellingPrice: 275.0,
          currentStock: 35.0,
          minStock: 10.0,
        },
        {
          name: 'Bru Instant Coffee 100g',
          tamilName: 'ப்ரூ காபி தூள்',
          brand: 'Bru',
          categoryName: 'Beverages',
          unit: 'jar',
          purchaseCost: 170.0,
          sellingPrice: 195.0,
          currentStock: 25.0,
          minStock: 5.0,
        },
        {
          name: 'Taj Mahal Tea 250g',
          tamilName: 'தாஜ் மஹால் தேயிலை',
          brand: 'Taj Mahal',
          categoryName: 'Beverages',
          unit: 'pack',
          purchaseCost: 140.0,
          sellingPrice: 165.0,
          currentStock: 30.0,
          minStock: 8.0,
        },
        {
          name: 'Lipton Green Tea 25 Bags',
          tamilName: 'கிரீன் டீ',
          brand: 'Lipton',
          categoryName: 'Beverages',
          unit: 'box',
          purchaseCost: 135.0,
          sellingPrice: 160.0,
          currentStock: 18.0,
          minStock: 5.0,
        },
        {
          name: 'Lays Classic Salted 50g',
          tamilName: 'லேஸ் சிப்ஸ்',
          brand: 'Lays',
          categoryName: 'Snacks',
          unit: 'pack',
          purchaseCost: 16.0,
          sellingPrice: 20.0,
          currentStock: 75.0,
          minStock: 20.0,
        },
        {
          name: 'Haldiram Mixture 200g',
          tamilName: 'ஹல்திராம் மிக்ஸர்',
          brand: 'Haldiram',
          categoryName: 'Snacks',
          unit: 'pack',
          purchaseCost: 45.0,
          sellingPrice: 55.0,
          currentStock: 40.0,
          minStock: 10.0,
        },
        {
          name: 'Dettol Original Soap 125g',
          tamilName: 'டெட்டால் சோப்',
          brand: 'Dettol',
          categoryName: 'Personal Care',
          unit: 'pcs',
          purchaseCost: 42.0,
          sellingPrice: 50.0,
          currentStock: 60.0,
          minStock: 15.0,
        },
        {
          name: 'Surf Excel Quick Wash 1kg',
          tamilName: 'சர்ப் எக்செல் 1கிலோ',
          brand: 'Surf Excel',
          categoryName: 'Household',
          unit: 'pack',
          purchaseCost: 130.0,
          sellingPrice: 150.0,
          currentStock: 35.0,
          minStock: 10.0,
        },
      ];

      for (const p of sampleProducts) {
        await prisma.product.create({
          data: {
            name: p.name,
            tamilName: p.tamilName,
            brand: p.brand,
            categoryId: categoryMap[p.categoryName] || null,
            unit: p.unit,
            purchaseCost: p.purchaseCost,
            sellingPrice: p.sellingPrice,
            currentStock: p.currentStock,
            minStock: p.minStock,
            isActive: true,
          },
        });
      }
      console.log('✔ Initialized sample supermarket products with Tamil titles');
    }

    console.log('✔ Database initialization complete');
  } catch (err) {
    console.error('Database initialization note/error:', err.message);
  }
}
