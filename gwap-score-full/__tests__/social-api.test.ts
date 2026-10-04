import express, { RequestHandler } from 'express';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { createSocialRouter } from '../api/routes/social.js';
import { AuthenticatedRequest } from '../api/middleware/auth.js';
import { SocialReputationService } from '../social/service.js';
import { SOCIAL_CONSENT_POLICY_VERSION } from '../social/consent.js';
import { errorHandler } from '../api/middleware/errorHandler.js';

const accountId = '9dfdb90f-78c2-4e8f-9aeb-8e65f9108091';

async function request(
  app: express.Express,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  try {
    return await globalThis.fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function testApp(service: SocialReputationService, withUser = true): express.Express {
  const app = express();
  app.use(express.json());
  const authenticate: RequestHandler = (req, _res, next) => {
    (req as AuthenticatedRequest).apiKey = {
      key_id: 'key-1',
      name: 'test',
      permissions: ['social:manage'],
      user_id: withUser ? 'user-1' : null,
    };
    next();
  };
  app.use('/social', createSocialRouter(service, authenticate));
  app.use(errorHandler);
  return app;
}

describe('social reputation endpoints', () => {
  test('requires explicit consent before starting Instagram authorization', async () => {
    const service = {
      initiateConnect: jest.fn().mockResolvedValue({
        authorizationUrl: 'https://instagram.test/authorize',
        consentId: 'consent-1',
      }),
    } as unknown as SocialReputationService;
    const app = testApp(service);

    const response = await request(app, '/social/accounts/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'instagram',
        accepted: true,
        policy_version: SOCIAL_CONSENT_POLICY_VERSION,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authorization_url: 'https://instagram.test/authorize',
      policy_version: SOCIAL_CONSENT_POLICY_VERSION,
      consent_id: 'consent-1',
    });
    expect(service.initiateConnect).toHaveBeenCalledWith(
      'user-1',
      'instagram',
      expect.any(Array),
      SOCIAL_CONSENT_POLICY_VERSION
    );
  });

  test('limits score reads to the authenticated user and returns latest explanation', async () => {
    const score = { score: 82, grade: 'B', explanation: { rationale: 'Consistent content signals.' } };
    const service = {
      latestScore: jest.fn().mockResolvedValue(score),
    } as unknown as SocialReputationService;

    const response = await request(testApp(service), '/social/scores/latest');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ score });
    expect(service.latestScore).toHaveBeenCalledWith('user-1');
  });

  test('does not allow a key without a user association to access social data', async () => {
    const service = { listAccounts: jest.fn() } as unknown as SocialReputationService;
    const response = await request(testApp(service, false), '/social/accounts');

    expect(response.status).toBe(403);
    expect(service.listAccounts).not.toHaveBeenCalled();
  });

  test('disconnects only the authenticated user account', async () => {
    const service = {
      disconnect: jest.fn().mockResolvedValue(true),
    } as unknown as SocialReputationService;
    const response = await request(testApp(service), `/social/accounts/${accountId}`, { method: 'DELETE' });

    expect(response.status).toBe(204);
    expect(service.disconnect).toHaveBeenCalledWith('user-1', accountId);
  });
});
