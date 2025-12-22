import {
  verifySolanaSignature,
  createAttestationMessage,
  verifyAttestationSignature,
  generateTestKeypair,
  generateTestSignature,
} from '../utils/crypto.js';

describe('Cryptographic Functions', () => {
  describe('Attestation Message Creation', () => {
    test('should create canonical message', () => {
      const payload = {
        subject_id: 'user-123',
        issuer_id: 'issuer-456',
        scope: 'identity',
        weight: 0.5,
        issued_at: '2024-01-01T00:00:00Z',
      };

      const message = createAttestationMessage(payload);
      expect(message).toBe(
        'subject_id:user-123|issuer_id:issuer-456|scope:identity|weight:0.5|issued_at:2024-01-01T00:00:00Z'
      );
    });

    test('should include expires_at when provided', () => {
      const payload = {
        subject_id: 'user-123',
        issuer_id: 'issuer-456',
        scope: 'identity',
        weight: 0.5,
        issued_at: '2024-01-01T00:00:00Z',
        expires_at: '2025-01-01T00:00:00Z',
      };

      const message = createAttestationMessage(payload);
      expect(message).toContain('expires_at:2025-01-01T00:00:00Z');
    });
  });

  describe('Signature Verification', () => {
    test('should verify valid signature', () => {
      const { publicKey, secretKey } = generateTestKeypair();
      const message = 'test message';
      const signature = generateTestSignature(message, secretKey);

      const result = verifySolanaSignature(message, signature, publicKey);
      expect(result).toBe(true);
    });

    test('should reject invalid signature', () => {
      const { publicKey, secretKey } = generateTestKeypair();
      const message = 'test message';
      const signature = generateTestSignature(message, secretKey);

      // Try to verify with different message
      const result = verifySolanaSignature('different message', signature, publicKey);
      expect(result).toBe(false);
    });

    test('should reject signature with wrong public key', () => {
      const keypair1 = generateTestKeypair();
      const keypair2 = generateTestKeypair();
      const message = 'test message';
      const signature = generateTestSignature(message, keypair1.secretKey);

      // Try to verify with different public key
      const result = verifySolanaSignature(message, signature, keypair2.publicKey);
      expect(result).toBe(false);
    });
  });

  describe('Attestation Signature Verification', () => {
    test('should verify valid attestation signature', () => {
      const { publicKey, secretKey } = generateTestKeypair();

      const payload = {
        subject_id: 'user-123',
        issuer_id: 'issuer-456',
        scope: 'identity',
        weight: 0.5,
        issued_at: '2024-01-01T00:00:00Z',
      };

      const message = createAttestationMessage(payload);
      const signature = generateTestSignature(message, secretKey);

      const result = verifyAttestationSignature(payload, signature, publicKey);
      expect(result).toBe(true);
    });

    test('should reject attestation with tampered data', () => {
      const { publicKey, secretKey } = generateTestKeypair();

      const payload = {
        subject_id: 'user-123',
        issuer_id: 'issuer-456',
        scope: 'identity',
        weight: 0.5,
        issued_at: '2024-01-01T00:00:00Z',
      };

      const message = createAttestationMessage(payload);
      const signature = generateTestSignature(message, secretKey);

      // Try to verify with tampered payload
      const tamperedPayload = { ...payload, weight: 1.0 };
      const result = verifyAttestationSignature(tamperedPayload, signature, publicKey);
      expect(result).toBe(false);
    });
  });
});
