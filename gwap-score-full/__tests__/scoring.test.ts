import { deriveScore, SCORING_CONSTANTS } from '../protocol/scoring.v1.js';
import { TrustProfile } from '../core-engine/src/types.js';

describe('Trust Score Derivation', () => {
  const baseProfile: TrustProfile = {
    subject_id: 'test-user',
    created_at: new Date().toISOString(),
    claims: [],
    events: [],
    attestations: [],
  };

  test('should return base score for empty profile', () => {
    const result = deriveScore(baseProfile);
    expect(result.score).toBe(SCORING_CONSTANTS.BASE_SCORE);
    expect(result.tier).toBe('Rookie');
    expect(result.risk).toBe('High');
  });

  test('should add points for wallet ownership claim', () => {
    const profile: TrustProfile = {
      ...baseProfile,
      claims: [
        {
          claim_id: '123',
          type: 'owns_wallet',
          value: 'ABC123',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(
      SCORING_CONSTANTS.BASE_SCORE + SCORING_CONSTANTS.WALLET_OWNERSHIP_SCORE
    );
  });

  test('should add points for telegram link', () => {
    const profile: TrustProfile = {
      ...baseProfile,
      claims: [
        {
          claim_id: '124',
          type: 'telegram_id',
          value: '123456789',
          source: 'telegram',
          issued_at: new Date().toISOString(),
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(
      SCORING_CONSTANTS.BASE_SCORE + SCORING_CONSTANTS.TELEGRAM_LINKED_SCORE
    );
  });

  test('should add points for established wallet', () => {
    const profile: TrustProfile = {
      ...baseProfile,
      claims: [
        {
          claim_id: '125',
          type: 'solana_wallet_age_days',
          value: '200',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(
      SCORING_CONSTANTS.BASE_SCORE + SCORING_CONSTANTS.ESTABLISHED_WALLET_SCORE
    );
    expect(result.explanation.contributing_claims).toContain(
      expect.stringContaining('Established Solana wallet')
    );
  });

  test('should add points for high activity wallet', () => {
    const profile: TrustProfile = {
      ...baseProfile,
      claims: [
        {
          claim_id: '126',
          type: 'solana_tx_count',
          value: '1500',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(
      SCORING_CONSTANTS.BASE_SCORE + SCORING_CONSTANTS.HIGH_ACTIVITY_WALLET_SCORE
    );
  });

  test('should add points for active wallet', () => {
    const profile: TrustProfile = {
      ...baseProfile,
      claims: [
        {
          claim_id: '127',
          type: 'solana_tx_count',
          value: '150',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(
      SCORING_CONSTANTS.BASE_SCORE + SCORING_CONSTANTS.ACTIVE_WALLET_SCORE
    );
  });

  test('should add points for positive interactions', () => {
    const profile: TrustProfile = {
      ...baseProfile,
      events: [
        {
          event_id: '201',
          event_type: 'positive_interaction',
          description: 'Completed KYC',
          source: 'system',
          issued_at: new Date().toISOString(),
        },
        {
          event_id: '202',
          event_type: 'positive_interaction',
          description: 'Made first transaction',
          source: 'system',
          issued_at: new Date().toISOString(),
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(
      SCORING_CONSTANTS.BASE_SCORE + 2 * SCORING_CONSTANTS.POSITIVE_INTERACTION_SCORE
    );
  });

  test('should subtract points for policy violations', () => {
    const profile: TrustProfile = {
      ...baseProfile,
      events: [
        {
          event_id: '203',
          event_type: 'policy_violation',
          description: 'Spam detected',
          source: 'system',
          issued_at: new Date().toISOString(),
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(
      SCORING_CONSTANTS.BASE_SCORE - SCORING_CONSTANTS.POLICY_VIOLATION_PENALTY
    );
    expect(result.explanation.penalties_applied).toContain(expect.stringContaining('Spam detected'));
  });

  test('should apply attestation multiplier', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const profile: TrustProfile = {
      ...baseProfile,
      attestations: [
        {
          attestation_id: '301',
          issuer_id: 'trusted-issuer-1',
          scope: 'identity',
          weight: 0.5,
          issued_at: new Date().toISOString(),
          expires_at: futureDate.toISOString(),
          signature: 'sig123',
          signature_verified: true,
        },
      ],
    };

    const result = deriveScore(profile);
    const expectedScore = Math.round(SCORING_CONSTANTS.BASE_SCORE * 1.5);
    expect(result.score).toBe(expectedScore);
    expect(result.explanation.multiplier).toBe(1.5);
  });

  test('should ignore expired claims', () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);

    const profile: TrustProfile = {
      ...baseProfile,
      claims: [
        {
          claim_id: '128',
          type: 'owns_wallet',
          value: 'ABC123',
          source: 'solana',
          issued_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          expires_at: pastDate.toISOString(),
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(SCORING_CONSTANTS.BASE_SCORE);
  });

  test('should ignore expired attestations', () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);

    const profile: TrustProfile = {
      ...baseProfile,
      attestations: [
        {
          attestation_id: '302',
          issuer_id: 'trusted-issuer-1',
          scope: 'identity',
          weight: 0.5,
          issued_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          expires_at: pastDate.toISOString(),
          signature: 'sig123',
          signature_verified: true,
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(SCORING_CONSTANTS.BASE_SCORE);
    expect(result.explanation.multiplier).toBe(1);
  });

  test('should clamp score to maximum', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const profile: TrustProfile = {
      ...baseProfile,
      claims: [
        {
          claim_id: '129',
          type: 'owns_wallet',
          value: 'ABC123',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
        {
          claim_id: '130',
          type: 'telegram_id',
          value: '123456789',
          source: 'telegram',
          issued_at: new Date().toISOString(),
        },
        {
          claim_id: '131',
          type: 'solana_wallet_age_days',
          value: '365',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
      ],
      attestations: [
        {
          attestation_id: '303',
          issuer_id: 'trusted-issuer-1',
          scope: 'identity',
          weight: 10,
          issued_at: new Date().toISOString(),
          expires_at: futureDate.toISOString(),
          signature: 'sig123',
          signature_verified: true,
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(SCORING_CONSTANTS.MAX_SCORE);
  });

  test('should clamp score to minimum', () => {
    const profile: TrustProfile = {
      ...baseProfile,
      events: Array(10)
        .fill(null)
        .map((_, i) => ({
          event_id: `event-${i}`,
          event_type: 'policy_violation',
          description: 'Violation',
          source: 'system',
          issued_at: new Date().toISOString(),
        })),
    };

    const result = deriveScore(profile);
    expect(result.score).toBe(SCORING_CONSTANTS.MIN_SCORE);
  });

  test('should correctly determine tier - Elite', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const profile: TrustProfile = {
      ...baseProfile,
      claims: [
        {
          claim_id: '132',
          type: 'owns_wallet',
          value: 'ABC123',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
        {
          claim_id: '133',
          type: 'solana_wallet_age_days',
          value: '365',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
        {
          claim_id: '134',
          type: 'solana_tx_count',
          value: '1500',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
      ],
      attestations: [
        {
          attestation_id: '304',
          issuer_id: 'trusted-issuer-1',
          scope: 'identity',
          weight: 1,
          issued_at: new Date().toISOString(),
          expires_at: futureDate.toISOString(),
          signature: 'sig123',
          signature_verified: true,
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.tier).toBe('Elite');
    expect(result.risk).toBe('Low');
  });

  test('should provide complete explanation', () => {
    const profile: TrustProfile = {
      ...baseProfile,
      claims: [
        {
          claim_id: '135',
          type: 'owns_wallet',
          value: 'ABC123',
          source: 'solana',
          issued_at: new Date().toISOString(),
        },
      ],
    };

    const result = deriveScore(profile);
    expect(result.explanation).toHaveProperty('base_score');
    expect(result.explanation).toHaveProperty('contributing_claims');
    expect(result.explanation).toHaveProperty('contributing_events');
    expect(result.explanation).toHaveProperty('active_attestations');
    expect(result.explanation).toHaveProperty('penalties_applied');
    expect(result.explanation).toHaveProperty('multiplier');
    expect(result.explanation).toHaveProperty('final_score_calculation');
  });
});
