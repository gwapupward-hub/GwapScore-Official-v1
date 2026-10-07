import express, { RequestHandler } from 'express';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { createReputationRouter } from '../api/routes/reputation.js';
import { AuthenticatedRequest } from '../api/middleware/auth.js';
import { ReputationService } from '../reputation/service.js';
import { errorHandler } from '../api/middleware/errorHandler.js';

async function request(app: express.Express, path: string): Promise<Response> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  try {
    return await globalThis.fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function testApp(service: ReputationService, withUser = true): express.Express {
  const app = express();
  const authenticate: RequestHandler = (req, _res, next) => {
    (req as AuthenticatedRequest).apiKey = {
      key_id: 'key-1',
      name: 'test',
      permissions: [],
      user_id: withUser ? 'user-1' : null,
    };
    next();
  };

  app.use('/reputation', createReputationRouter(service, authenticate));
  app.use(errorHandler);
  return app;
}

describe('GwapScore v2 API', () => {
  test('returns only the authenticated user composite reputation', async () => {
    const score = {
      modelVersion: '2.0.0-alpha.1',
      status: 'provisional',
      score: 712,
      tier: 'Strong',
      composite100: 68.67,
      coverage: 52.5,
      confidence: 88,
      dimensions: {},
      unavailableEvidence: [],
    };
    const service = {
      getScore: jest.fn().mockResolvedValue(score),
    } as unknown as ReputationService;

    const response = await request(testApp(service), '/reputation/me');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subject_id: 'user-1', gwapscore: score });
    expect(service.getScore).toHaveBeenCalledWith('user-1');
  });

  test('rejects API keys that are not associated with a user profile', async () => {
    const service = { getScore: jest.fn() } as unknown as ReputationService;
    const response = await request(testApp(service, false), '/reputation/me');

    expect(response.status).toBe(403);
    expect(service.getScore).not.toHaveBeenCalled();
  });
});
