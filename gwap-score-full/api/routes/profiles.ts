import { Router } from 'express';
import {
  createProfile,
  getProfile,
  profileExists,
  appendClaim,
  appendEvent,
  appendAttestation,
} from '../../core-engine/src/engine.js';
import { deriveScore } from '../../protocol/scoring.v1.js';
import { authenticateApiKey, requirePermission, publicEndpoint } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';
import { ValidationError } from '../../utils/errors.js';

const router = Router();

/**
 * GET /profiles/:subjectId
 * Get a trust profile
 */
router.get('/:subjectId', publicEndpoint, async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const profile = await getProfile(subjectId);
    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /profiles/:subjectId/score
 * Get derived score for a profile
 */
router.get('/:subjectId/score', publicEndpoint, async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const profile = await getProfile(subjectId);
    const scoringResult = deriveScore(profile);
    res.json({
      subject_id: subjectId,
      ...scoringResult,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /profiles/:subjectId/exists
 * Check if a profile exists
 */
router.get('/:subjectId/exists', publicEndpoint, async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const exists = await profileExists(subjectId);
    res.json({ exists });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /profiles
 * Create a new profile
 */
router.post(
  '/',
  authenticateApiKey,
  requirePermission('profile:create'),
  writeLimiter,
  async (req, res, next) => {
    try {
      const { subject_id } = req.body;

      if (!subject_id) {
        throw new ValidationError('subject_id is required');
      }

      const profile = await createProfile(subject_id);
      res.status(201).json({ profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /profiles/:subjectId/claims
 * Add a claim to a profile
 */
router.post(
  '/:subjectId/claims',
  authenticateApiKey,
  requirePermission('profile:write'),
  writeLimiter,
  async (req, res, next) => {
    try {
      const { subjectId } = req.params;
      const claim = req.body;

      const addedClaim = await appendClaim(subjectId, claim);
      res.status(201).json({ claim: addedClaim });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /profiles/:subjectId/events
 * Add an event to a profile
 */
router.post(
  '/:subjectId/events',
  authenticateApiKey,
  requirePermission('profile:write'),
  writeLimiter,
  async (req, res, next) => {
    try {
      const { subjectId } = req.params;
      const event = req.body;

      const addedEvent = await appendEvent(subjectId, event);
      res.status(201).json({ event: addedEvent });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /profiles/:subjectId/attestations
 * Add an attestation to a profile (with signature verification)
 */
router.post(
  '/:subjectId/attestations',
  authenticateApiKey,
  requirePermission('profile:attest'),
  writeLimiter,
  async (req, res, next) => {
    try {
      const { subjectId } = req.params;
      const attestation = req.body;

      const addedAttestation = await appendAttestation(subjectId, attestation);
      res.status(201).json({ attestation: addedAttestation });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
