import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function encryptionKey(value = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY): Buffer {
  if (!value) throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY is required');
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY must encode exactly 32 bytes');
  return key;
}

export function encryptSocialToken(token: string, key?: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSocialToken(encrypted: EncryptedToken, key?: string): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
