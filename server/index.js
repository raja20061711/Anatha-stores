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
import aiRoutes from './routes/ai.routes.js';
import path from 'path';
import { initializeDatabase } from './init.js';
import prisma from './db.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Configure allowed CORS origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile/curl/electron/local tools) with no origin
    if (!origin) return callback(null, true);
    
    // In development, allow any localhost or 127.0.0.1 origin
    if (process.env.NODE_ENV !== 'production') {
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Fallback for custom dev origins
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Pragma'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours preflight cache
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static product images & assets
app.use('/product-images', express.static(path.resolve('public/product-images')));
app.use(express.static(path.resolve('public')));

// Routes
app.use('/health', healthRoutes);
app.use('/api', healthRoutes); // Provides /api/health and /api
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
app.use('/api/ai', aiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    app: 'ANANTHA STORE POS Backend API',
    status: 'ONLINE',
    version: '1.0.0',
    port: PORT,
    healthEndpoint: '/api/health',
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
      'ai',
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
const server = app.listen(PORT, HOST, async () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`====================================================`);
  console.log(`🚀 ANANTHA STORE POS API running on http://${displayHost}:${PORT}`);
  console.log(`🩺 Health Check: http://${displayHost}:${PORT}/api/health`);
  console.log(`🔐 Modules: Auth, Products, Sales, Inventory, Purchases, Suppliers, Staff, Reports, Settings`);

  // Verify database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - dbStart;
    console.log(`📦 Database: Connected (SQLite via Prisma, latency: ${latency}ms)`);
  } catch (dbErr) {
    console.error(`❌ Database Connection Error:`, dbErr.message);
  }

  // Run database schema seeds/init
  try {
    await initializeDatabase();
  } catch (initErr) {
    console.error(`⚠️ Database seed note/warning:`, initErr.message);
  }
  console.log(`====================================================`);
});

// Handle Port In Use (EADDRINUSE) gracefully with helpful diagnostic
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [PORT IN USE] Port ${PORT} is already occupied by another process!`);
    console.error(`💡 To free Port ${PORT} on Windows (PowerShell), run:`);
    console.error(`   Get-NetTCPConnection -LocalPort ${PORT} | Select-Object OwningProcess`);
    console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
  } else {
    console.error(`Server runtime error:`, err);
  }
});

// Process cleanup
process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server gracefully terminated');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server gracefully terminated (SIGTERM)');
    process.exit(0);
  });
});

export default app;
