import express from 'express';
import prisma from '../db.js';

const router = express.Router();

const handleHealthCheck = async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'DISCONNECTED';
  let dbLatencyMs = null;
  let dbError = null;

  try {
    const dbTestStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbTestStart;
    dbStatus = 'CONNECTED';
  } catch (err) {
    dbError = 'Database unavailable or disconnected';
    console.error('Database health check failed:', err.message);
  }

  const responseTimeMs = Date.now() - startTime;
  const isHealthy = dbStatus === 'CONNECTED';

  return res.status(200).json({
    status: isHealthy ? 'HEALTHY' : 'DEGRADED',
    server: 'ONLINE',
    service: 'ANATHA STORES POS API',
    port: Number(process.env.PORT) || 5000,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      provider: process.env.DATABASE_URL?.startsWith('file:') ? 'SQLite' : 'MySQL',
      status: dbStatus,
      connected: isHealthy,
      latencyMs: dbLatencyMs,
      error: dbError,
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    responseTimeMs,
  });
};

router.get('/health', handleHealthCheck);
router.get('/', handleHealthCheck);

export default router;
