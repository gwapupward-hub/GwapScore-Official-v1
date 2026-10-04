import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface OAuthStateClaims {
  userId: string;
  platform: 'instagram';
  expiresAt: number;
  nonce: string;
  consentId: string;
  scopes: string[];
}

export function createOAuthState(
  userId: string,
  consentId: string,
  scopes: string[],
  signingKey: string,
  now = Date.now()
): string {
  if (Buffer.byteLength(signingKey) < 32) {
    throw new Error('SOCIAL_OAUTH_STATE_SECRET must be at least 32 bytes');
  }
  const claims: OAuthStateClaims = {
    userId,
    platform: 'instagram',
    expiresAt: now + 10 * 60 * 1000,
    nonce: randomBytes(16).toString('hex'),
    consentId,
    scopes,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', signingKey).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyOAuthState(
  state: string,
  signingKey: string,
  now = Date.now()
): OAuthStateClaims {
  const [payload, signature, extra] = state.split('.');
  if (!payload || !signature || extra || Buffer.byteLength(signingKey) < 32) {
    throw new Error('Invalid OAuth state');
  }

  const expected = createHmac('sha256', signingKey).update(payload).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    throw new Error('Invalid OAuth state');
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error('Invalid OAuth state');
  }

  let claims: OAuthStateClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthStateClaims;
  } catch {
    throw new Error('Invalid OAuth state');
  }
  if (
    claims.platform !== 'instagram'
    || typeof claims.userId !== 'string'
    || !claims.userId
    || typeof claims.expiresAt !== 'number'
    || claims.expiresAt <= now
    || typeof claims.nonce !== 'string'
    || typeof claims.consentId !== 'string'
    || !Array.isArray(claims.scopes)
    || claims.scopes.some((scope) => typeof scope !== 'string')
  ) {
    throw new Error('Expired or invalid OAuth state');
  }
  return claims;
}
