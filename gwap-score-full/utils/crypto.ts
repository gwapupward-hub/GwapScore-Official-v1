import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SignatureVerificationError } from './errors.js';
import { logger } from './logger.js';

export interface SignaturePayload {
  attestation_id?: string;
  subject_id: string;
  issuer_id: string;
  scope: string;
  weight: number;
  issued_at: string;
  expires_at?: string;
}

/**
 * Verifies a Solana-style Ed25519 signature
 * @param message - The message that was signed
 * @param signature - Base58-encoded signature
 * @param publicKey - Base58-encoded public key
 * @returns true if signature is valid
 */
export function verifySolanaSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = Buffer.from(message, 'utf-8');
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    if (signatureBytes.length !== 64) {
      throw new SignatureVerificationError({
        reason: 'Invalid signature length',
        expected: 64,
        actual: signatureBytes.length,
      });
    }

    if (publicKeyBytes.length !== 32) {
      throw new SignatureVerificationError({
        reason: 'Invalid public key length',
        expected: 32,
        actual: publicKeyBytes.length,
      });
    }

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
  } catch (error) {
    logger.warn('Signature verification failed', { error });
    return false;
  }
}

/**
 * Creates a canonical message for attestation signing
 * @param payload - The attestation payload
 * @returns Canonical string representation
 */
export function createAttestationMessage(payload: SignaturePayload): string {
  const parts = [
    `subject_id:${payload.subject_id}`,
    `issuer_id:${payload.issuer_id}`,
    `scope:${payload.scope}`,
    `weight:${payload.weight}`,
    `issued_at:${payload.issued_at}`,
  ];

  if (payload.expires_at) {
    parts.push(`expires_at:${payload.expires_at}`);
  }

  return parts.join('|');
}

/**
 * Verifies an attestation signature
 * @param payload - The attestation data
 * @param signature - Base58-encoded signature
 * @param publicKey - Base58-encoded public key
 * @returns true if attestation is valid
 */
export function verifyAttestationSignature(
  payload: SignaturePayload,
  signature: string,
  publicKey: string
): boolean {
  const message = createAttestationMessage(payload);
  return verifySolanaSignature(message, signature, publicKey);
}

/**
 * Generates a signature for testing purposes
 * WARNING: Only use in test environments
 */
export function generateTestSignature(
  message: string,
  secretKey: Uint8Array
): string {
  const messageBytes = Buffer.from(message, 'utf-8');
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return bs58.encode(signature);
}

/**
 * Generates a test keypair
 * WARNING: Only use in test environments
 */
export function generateTestKeypair(): {
  publicKey: string;
  secretKey: Uint8Array;
} {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: bs58.encode(keypair.publicKey),
    secretKey: keypair.secretKey,
  };
}
