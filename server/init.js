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

    // 5. Automatic sample product seeding disabled to protect production data and allow clean empty states.
    // Real supermarket products are maintained via Excel/CSV import or Admin Product Master.

    console.log('✔ Database initialization complete');
  } catch (err) {
    console.error('Database initialization note/error:', err.message);
  }
}
