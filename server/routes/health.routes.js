import express from 'express';
import prisma from '../db.js';

const router = express.Router();

router.get('/health', async (req, res) => {
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
    dbError = err.message;
    console.error('Database health check failed:', err.message);
  }

  const responseTimeMs = Date.now() - startTime;
  const isHealthy = dbStatus === 'CONNECTED';

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'HEALTHY' : 'DEGRADED',
    service: 'ANATHA STORES API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      provider: 'MySQL',
      status: dbStatus,
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
});

export default router;
