import { RequestHandler, Router } from 'express';
import { AuthenticatedRequest, authenticateApiKey } from '../middleware/auth.js';
import { ReputationService, reputationService } from '../../reputation/service.js';

export function createReputationRouter(
  service: ReputationService = reputationService,
  authenticate: RequestHandler = authenticateApiKey
): Router {
  const router = Router();

  router.get('/me', authenticate, async (req, res, next) => {
    try {
      const userId = (req as AuthenticatedRequest).apiKey?.user_id;
      if (!userId) {
        res.status(403).json({
          error: {
            code: 'USER_SCOPE_REQUIRED',
            message: 'This API key is not associated with a user profile.',
          },
        });
        return;
      }

      const score = await service.getScore(userId);
      res.json({
        subject_id: userId,
        gwapscore: score,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createReputationRouter();
