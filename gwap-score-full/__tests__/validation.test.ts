import { validate, claimSchema, eventSchema, attestationSchema } from '../utils/validation.js';
import { ValidationError } from '../utils/errors.js';

describe('Validation', () => {
  describe('Claim Validation', () => {
    test('should validate correct claim', () => {
      const claim = {
        type: 'owns_wallet',
        value: 'test-wallet-123',
        source: 'solana',
        issued_at: new Date().toISOString(),
      };

      expect(() => validate(claimSchema, claim)).not.toThrow();
    });

    test('should reject claim with invalid type pattern', () => {
      const claim = {
        type: 'Invalid-Type',
        value: 'test',
        source: 'solana',
        issued_at: new Date().toISOString(),
      };

      expect(() => validate(claimSchema, claim)).toThrow(ValidationError);
    });

    test('should reject claim with future issued_at', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const claim = {
        type: 'owns_wallet',
        value: 'test',
        source: 'solana',
        issued_at: futureDate.toISOString(),
      };

      expect(() => validate(claimSchema, claim)).toThrow(ValidationError);
    });

    test('should reject claim with expires_at before issued_at', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000);

      const claim = {
        type: 'owns_wallet',
        value: 'test',
        source: 'solana',
        issued_at: now.toISOString(),
        expires_at: past.toISOString(),
      };

      expect(() => validate(claimSchema, claim)).toThrow(ValidationError);
    });

    test('should accept claim with valid expires_at', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 1000);

      const claim = {
        type: 'owns_wallet',
        value: 'test',
        source: 'solana',
        issued_at: now.toISOString(),
        expires_at: future.toISOString(),
      };

      expect(() => validate(claimSchema, claim)).not.toThrow();
    });
  });

  describe('Event Validation', () => {
    test('should validate correct event', () => {
      const event = {
        event_type: 'positive_interaction',
        description: 'User completed verification',
        source: 'system',
        issued_at: new Date().toISOString(),
      };

      expect(() => validate(eventSchema, event)).not.toThrow();
    });

    test('should reject event with invalid event_type pattern', () => {
      const event = {
        event_type: 'Invalid Event Type',
        description: 'Test',
        source: 'system',
        issued_at: new Date().toISOString(),
      };

      expect(() => validate(eventSchema, event)).toThrow(ValidationError);
    });

    test('should reject event with empty description', () => {
      const event = {
        event_type: 'positive_interaction',
        description: '',
        source: 'system',
        issued_at: new Date().toISOString(),
      };

      expect(() => validate(eventSchema, event)).toThrow(ValidationError);
    });

    test('should reject event with description too long', () => {
      const event = {
        event_type: 'positive_interaction',
        description: 'a'.repeat(1001),
        source: 'system',
        issued_at: new Date().toISOString(),
      };

      expect(() => validate(eventSchema, event)).toThrow(ValidationError);
    });
  });

  describe('Attestation Validation', () => {
    test('should validate correct attestation', () => {
      const attestation = {
        issuer_id: 'trusted-issuer-1',
        scope: 'identity_verification',
        weight: 0.5,
        issued_at: new Date().toISOString(),
        signature: 'base58-signature-string',
      };

      expect(() => validate(attestationSchema, attestation)).not.toThrow();
    });

    test('should reject attestation with negative weight', () => {
      const attestation = {
        issuer_id: 'trusted-issuer-1',
        scope: 'identity',
        weight: -0.5,
        issued_at: new Date().toISOString(),
        signature: 'sig',
      };

      expect(() => validate(attestationSchema, attestation)).toThrow(ValidationError);
    });

    test('should reject attestation with weight exceeding maximum', () => {
      const attestation = {
        issuer_id: 'trusted-issuer-1',
        scope: 'identity',
        weight: 11,
        issued_at: new Date().toISOString(),
        signature: 'sig',
      };

      expect(() => validate(attestationSchema, attestation)).toThrow(ValidationError);
    });

    test('should reject attestation with missing signature', () => {
      const attestation = {
        issuer_id: 'trusted-issuer-1',
        scope: 'identity',
        weight: 0.5,
        issued_at: new Date().toISOString(),
      };

      expect(() => validate(attestationSchema, attestation)).toThrow(ValidationError);
    });

    test('should accept attestation with valid expires_at', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 1000);

      const attestation = {
        issuer_id: 'trusted-issuer-1',
        scope: 'identity',
        weight: 0.5,
        issued_at: now.toISOString(),
        expires_at: future.toISOString(),
        signature: 'sig',
      };

      expect(() => validate(attestationSchema, attestation)).not.toThrow();
    });
  });
});
