import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import salesRoutes from './routes/sales.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import purchasesRoutes from './routes/purchases.routes.js';
import customersRoutes from './routes/customers.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import staffRoutes from './routes/staff.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import path from 'path';
import { initializeDatabase } from './init.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(morgan('dev'));

// Static product images & assets
app.use('/product-images', express.static(path.resolve('public/product-images')));
app.use(express.static(path.resolve('public')));

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/settings', settingsRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    app: 'ANANTHA STORE POS Backend API',
    status: 'ONLINE',
    version: '1.0.0',
    modules: [
      'auth',
      'products',
      'sales',
      'inventory',
      'suppliers',
      'purchases',
      'customers',
      'reports',
      'staff',
      'settings',
    ],
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Unhandled Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Start Server and initialize database
const server = app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 ANANTHA STORE API running on http://localhost:${PORT}`);
  console.log(`🔐 Modules: Products, Sales, Inventory, Purchases, Suppliers, Staff, Reports, Settings`);
  console.log(`====================================================`);
  await initializeDatabase();
});

// Process cleanup
process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server gracefully terminated');
    process.exit(0);
  });
});
