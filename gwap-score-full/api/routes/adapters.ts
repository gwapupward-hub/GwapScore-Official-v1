import { Router } from 'express';
import { submitSolanaEvidence } from '../../adapters/solana/claims.js';
import { handleTelegramVerify } from '../../adapters/telegram/handler.js';
import { authenticateApiKey, requirePermission } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * POST /adapters/solana/evidence
 * Submit Solana blockchain evidence
 */
router.post(
  '/solana/evidence',
  authenticateApiKey,
  requirePermission('adapter:solana'),
  writeLimiter,
  async (req, res, next) => {
    try {
      const evidence = req.body;
      await submitSolanaEvidence(evidence);
      res.status(201).json({
        success: true,
        message: 'Solana evidence submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /adapters/telegram/verify
 * Verify and link Telegram account
 */
router.post(
  '/telegram/verify',
  authenticateApiKey,
  requirePermission('adapter:telegram'),
  writeLimiter,
  async (req, res, next) => {
    try {
      const verification = req.body;
      await handleTelegramVerify(verification);
      res.status(201).json({
        success: true,
        message: 'Telegram account verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
