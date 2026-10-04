import { Request, RequestHandler, Response, Router } from 'express';
import { AuthenticatedRequest, authenticateApiKey, requirePermission } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';
import {
  SocialReputationService,
  socialRepository,
} from '../../social/service.js';
import { instagramProvider, defaultInstagramScopes } from '../../social/provider.js';
import { SOCIAL_CONSENT_COPY, SOCIAL_CONSENT_POLICY_VERSION } from '../../social/consent.js';
import { ValidationError } from '../../utils/errors.js';

const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const defaultService = new SocialReputationService(socialRepository, instagramProvider);

function userIdFromRequest(req: Request, res: Response): string | undefined {
  const userId = (req as AuthenticatedRequest).apiKey?.user_id;
  if (!userId) {
    res.status(403).json({
      error: {
        code: 'USER_SCOPE_REQUIRED',
        message: 'This API key is not associated with a user profile.',
      },
    });
    return undefined;
  }
  return userId;
}

function requireAccountId(accountId: string): void {
  if (!accountIdPattern.test(accountId)) throw new ValidationError('accountId must be a UUID');
}

export function createSocialRouter(
  service: SocialReputationService = defaultService,
  authenticate: RequestHandler = authenticateApiKey
): Router {
  const router = Router();

  router.get('/consent', authenticate, requirePermission('social:manage'), (req, res) => {
    if (!userIdFromRequest(req, res)) return;
    res.json({ policy_version: SOCIAL_CONSENT_POLICY_VERSION, copy: SOCIAL_CONSENT_COPY });
  });

  router.post('/accounts/connect', authenticate, requirePermission('social:manage'), writeLimiter, async (req, res, next) => {
    const userId = userIdFromRequest(req, res);
    if (!userId) return;
    try {
      const { platform, accepted, policy_version: policyVersion } = req.body ?? {};
      const scopes = req.body?.scopes ?? defaultInstagramScopes;
      if (accepted !== true) throw new ValidationError('Explicit social data consent is required');
      if (typeof platform !== 'string' || typeof policyVersion !== 'string') {
        throw new ValidationError('platform and policy_version are required');
      }
      if (!Array.isArray(scopes) || scopes.some((scope: unknown) => typeof scope !== 'string')) {
        throw new ValidationError('scopes must be an array of strings');
      }
      const result = await service.initiateConnect(userId, platform, scopes, policyVersion);
      res.status(200).json({
        authorization_url: result.authorizationUrl,
        policy_version: SOCIAL_CONSENT_POLICY_VERSION,
        consent_id: result.consentId,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/oauth/callback', async (req, res, next) => {
    try {
      if (typeof req.query.error === 'string') {
        if (typeof req.query.state === 'string') await service.cancelOAuth(req.query.state);
        throw new ValidationError('Social account authorization was declined');
      }
      const { code, state } = req.query;
      if (typeof code !== 'string' || typeof state !== 'string') {
        throw new ValidationError('OAuth code and state are required');
      }
      const account = await service.completeOAuth(code, state);
      res.status(201).json({ account });
    } catch (error) {
      next(error);
    }
  });

  router.get('/accounts', authenticate, requirePermission('social:manage'), async (req, res, next) => {
    const userId = userIdFromRequest(req, res);
    if (!userId) return;
    try {
      res.json({ accounts: await service.listAccounts(userId) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/accounts/:accountId', authenticate, requirePermission('social:manage'), writeLimiter, async (req, res, next) => {
    const userId = userIdFromRequest(req, res);
    if (!userId) return;
    try {
      requireAccountId(req.params.accountId);
      const disconnected = await service.disconnect(userId, req.params.accountId);
      if (!disconnected) {
        res.status(404).json({ error: { code: 'SOCIAL_ACCOUNT_NOT_FOUND', message: 'Social account not found.' } });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post('/accounts/:accountId/ingest', authenticate, requirePermission('social:manage'), writeLimiter, async (req, res, next) => {
    const userId = userIdFromRequest(req, res);
    if (!userId) return;
    try {
      requireAccountId(req.params.accountId);
      res.status(202).json({ job: await service.ingest(userId, req.params.accountId) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/scores/latest', authenticate, requirePermission('social:manage'), async (req, res, next) => {
    const userId = userIdFromRequest(req, res);
    if (!userId) return;
    try {
      const score = await service.latestScore(userId);
      if (!score) {
        res.status(404).json({ error: { code: 'SOCIAL_SCORE_NOT_FOUND', message: 'No social reputation score is available yet.' } });
        return;
      }
      res.json({ score });
    } catch (error) {
      next(error);
    }
  });

  router.get('/scores/history', authenticate, requirePermission('social:manage'), async (req, res, next) => {
    const userId = userIdFromRequest(req, res);
    if (!userId) return;
    try {
      const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('limit must be an integer between 1 and 100');
      }
      const history = await service.scoreHistory(userId, limit);
      const chronological = [...history].reverse();
      const firstScore = Number(chronological[0]?.score);
      const lastScore = Number(chronological.at(-1)?.score);
      const change = chronological.length > 1 ? lastScore - firstScore : 0;
      res.json({
        history,
        trend: {
          change,
          direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/data', authenticate, requirePermission('social:manage'), writeLimiter, async (req, res, next) => {
    const userId = userIdFromRequest(req, res);
    if (!userId) return;
    try {
      await service.deleteUserSocialData(userId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createSocialRouter();
