import { Router } from 'express';
import { healthCheck } from '../../database/client.js';
import { getScoringAlgorithmDescription } from '../../protocol/scoring.v1.js';
import { publicEndpoint } from '../middleware/auth.js';

const router = Router();

/**
 * GET /system/health
 * Health check endpoint
 */
router.get('/health', publicEndpoint, async (req, res) => {
  const dbHealthy = await healthCheck();

  const status = dbHealthy ? 'healthy' : 'unhealthy';
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'up' : 'down',
      api: 'up',
    },
  });
});

/**
 * GET /system/version
 * API version information
 */
router.get('/version', publicEndpoint, (req, res) => {
  res.json({
    version: '1.0.0',
    protocol_version: '1.0',
    name: 'GwapScore Trust Protocol API',
  });
});

/**
 * GET /system/scoring-algorithm
 * Get documentation about the scoring algorithm
 */
router.get('/scoring-algorithm', publicEndpoint, (req, res) => {
  res.json({
    description: getScoringAlgorithmDescription(),
    version: '1.0',
  });
});

export default router;
