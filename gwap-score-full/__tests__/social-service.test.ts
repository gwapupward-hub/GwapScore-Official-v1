import {
  SocialRepository,
  SocialReputationService,
} from '../social/service.js';
import { SocialProvider } from '../social/provider.js';
import { SOCIAL_CONSENT_POLICY_VERSION } from '../social/consent.js';
import { decryptSocialToken, encryptSocialToken } from '../social/tokenCrypto.js';
import { createOAuthState, verifyOAuthState } from '../social/oauthState.js';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');

describe('social reputation service', () => {
  test('records consent and completes OAuth with encrypted tokens and signed scopes', async () => {
    const repo = {
      createConsent: jest.fn().mockResolvedValue('consent-1'),
      linkAccount: jest.fn().mockResolvedValue({ account_id: 'account-1', username: 'creator' }),
    } as unknown as SocialRepository;
    let oauthState = '';
    const provider = {
      platform: 'instagram',
      authorizationUrl: jest.fn((state: string) => {
        oauthState = state;
        return 'https://instagram.test/authorize';
      }),
      exchangeCode: jest.fn().mockResolvedValue({ accessToken: 'plain-token' }),
      fetchProfile: jest.fn().mockResolvedValue({ platformUserId: 'ig-1', username: 'creator' }),
    } as unknown as SocialProvider;
    const service = new SocialReputationService(repo, provider, 'state-signing-secret-value-32bytes', encryptionKey);

    const connect = await service.initiateConnect(
      'user-1',
      'instagram',
      ['instagram_business_basic'],
      SOCIAL_CONSENT_POLICY_VERSION
    );
    const account = await service.completeOAuth('authorization-code', oauthState);

    expect(connect.authorizationUrl).toBe('https://instagram.test/authorize');
    expect(repo.createConsent).toHaveBeenCalledWith(
      'user-1',
      'instagram',
      ['instagram_business_basic'],
      SOCIAL_CONSENT_POLICY_VERSION
    );
    expect(account.account_id).toBe('account-1');
    const saved = (repo.linkAccount as jest.Mock).mock.calls[0][3];
    expect(saved.access.ciphertext).not.toContain('plain-token');
    expect(decryptSocialToken(saved.access, encryptionKey)).toBe('plain-token');
    expect(saved.scopes).toEqual(['instagram_business_basic']);
  });

  test('persists imported metrics, a score, and successful job state', async () => {
    const repository = {
      findAccount: jest.fn().mockResolvedValue({
        account_id: 'account-1',
        user_id: 'user-1',
        platform: 'instagram',
      }),
      createJob: jest.fn().mockResolvedValue({ job_id: 'job-1', status: 'pending', attempts: 0 }),
      updateJob: jest.fn().mockResolvedValue(undefined),
      getToken: jest.fn().mockResolvedValue({
        access: encryptSocialToken('access-token', encryptionKey),
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      saveIngestion: jest.fn().mockResolvedValue(undefined),
    } as unknown as SocialRepository;
    const provider = {
      platform: 'instagram',
      fetchProfile: jest.fn().mockResolvedValue({
        platformUserId: 'ig-1',
        username: 'creator',
        followersCount: 1000,
      }),
      fetchContent: jest.fn().mockResolvedValue([{
        platformContentId: 'post-1',
        publishedAt: new Date(),
        metrics: { likes: 100, comments: 20 },
      }]),
    } as unknown as SocialProvider;
    const service = new SocialReputationService(repository, provider, 'unused', encryptionKey);

    const result = await service.ingest('user-1', 'account-1');

    expect(result.status).toBe('succeeded');
    expect(repository.saveIngestion).toHaveBeenCalledWith(
      'user-1',
      'account-1',
      'instagram',
      expect.objectContaining({ followers_count: 1000, posts_last_30_days: 1 }),
      expect.any(Array),
      expect.objectContaining({ score: expect.any(Number), explanation: expect.any(Object) })
    );
    expect(repository.updateJob).toHaveBeenLastCalledWith('job-1', expect.objectContaining({
      status: 'succeeded',
      attempts: 1,
    }));
  });

  test('rejects expired or tampered OAuth state', async () => {
    const secret = 'state-signing-secret-value-with-32-bytes';
    const state = await createOAuthState('user-1', 'consent-1', ['instagram_business_basic'], secret, 1000);
    await expect(verifyOAuthState(state, secret, 1000)).resolves.toBeDefined();
    await expect(verifyOAuthState(state, secret, 700_000)).rejects.toThrow('Expired or invalid OAuth state');
    await expect(verifyOAuthState(`${state}tampered`, secret, 1000)).rejects.toThrow('Invalid OAuth state');
  });

  test('authenticates token encryption and rejects modified ciphertext', () => {
    const encrypted = encryptSocialToken('sensitive-access-token', encryptionKey);
    expect(encrypted.ciphertext).not.toContain('sensitive-access-token');
    expect(decryptSocialToken(encrypted, encryptionKey)).toBe('sensitive-access-token');
    expect(() => decryptSocialToken({ ...encrypted, ciphertext: 'dG9rZW4=' }, encryptionKey)).toThrow();
  });
});
