import {
  deriveCompositeGwapScoreV2,
  mapGwapScoreV2Tier,
  type GwapScoreV2Input,
} from '../reputation/composite.js';

const unavailable = (reason: string) => ({ state: 'unavailable' as const, reason });

describe('GwapScore v2 composite reputation', () => {
  test('combines social, wallet, and identity evidence into the documented worked example', () => {
    const input: GwapScoreV2Input = {
      social: {
        state: 'observed',
        score: 42,
        confidence: 0.72,
        provenance: ['x-proof-of-control', 'social-snapshots'],
      },
      wallet: {
        state: 'observed',
        score: 93,
        confidence: 0.96,
        provenance: ['wallet-proof', 'wallet-intelligence'],
      },
      identityProof: {
        state: 'observed',
        score: 88,
        confidence: 1,
        provenance: ['gwap-identity'],
      },
      ecosystem: unavailable('No eligible GWAP ecosystem history yet.'),
    };

    const result = deriveCompositeGwapScoreV2(input);

    expect(result.status).toBe('scored');
    expect(result.score).toBe(722);
    expect(result.tier).toBe('Strong');
    expect(result.composite100).toBe(70.33);
    expect(result.coverage).toBe(90);
    expect(result.confidence).toBe(84.67);
    expect(result.dimensions.social.score).toBe(42);
    expect(result.dimensions.wallet.score).toBe(93);
    expect(result.dimensions.ecosystem.score).toBeNull();
  });

  test('lets strong verified wallet reputation improve a weak social result without erasing the social dimension', () => {
    const socialOnly = deriveCompositeGwapScoreV2({
      social: { state: 'observed', score: 40, confidence: 1 },
      wallet: unavailable('Wallet not linked.'),
      identityProof: unavailable('Identity evidence unavailable.'),
      ecosystem: unavailable('No ecosystem evidence.'),
    });

    const withWallet = deriveCompositeGwapScoreV2({
      social: { state: 'observed', score: 40, confidence: 1 },
      wallet: { state: 'observed', score: 95, confidence: 1 },
      identityProof: unavailable('Identity evidence unavailable.'),
      ecosystem: unavailable('No ecosystem evidence.'),
    });

    expect(socialOnly.status).toBe('provisional');
    expect(socialOnly.score).toBe(540);
    expect(withWallet.status).toBe('scored');
    expect(withWallet.score).toBeGreaterThan(socialOnly.score as number);
    expect(withWallet.dimensions.social.score).toBe(40);
    expect(withWallet.dimensions.wallet.score).toBe(95);
    expect(withWallet.coverage).toBe(75);
  });

  test('does not convert missing evidence into zero or neutral reputation', () => {
    const result = deriveCompositeGwapScoreV2({
      social: { state: 'observed', score: 80, confidence: 1 },
      wallet: unavailable('Wallet not connected.'),
      identityProof: unavailable('No verified identity proof.'),
      ecosystem: unavailable('No ecosystem history.'),
    });

    expect(result.status).toBe('provisional');
    expect(result.score).toBe(780);
    expect(result.composite100).toBe(80);
    expect(result.coverage).toBe(45);
    expect(result.unavailableEvidence).toHaveLength(3);
  });

  test('returns unscored when no reputation dimension has observed evidence', () => {
    const result = deriveCompositeGwapScoreV2({
      social: unavailable('Not connected.'),
      wallet: unavailable('Not connected.'),
      identityProof: unavailable('Not verified.'),
      ecosystem: unavailable('No history.'),
    });

    expect(result.status).toBe('unscored');
    expect(result.score).toBeNull();
    expect(result.tier).toBeNull();
    expect(result.coverage).toBe(0);
    expect(result.confidence).toBe(0);
  });

  test('rejects invalid observed scores and confidence values instead of silently clamping them', () => {
    expect(() => deriveCompositeGwapScoreV2({
      social: { state: 'observed', score: 101, confidence: 1 },
      wallet: unavailable('Not connected.'),
      identityProof: unavailable('Not verified.'),
      ecosystem: unavailable('No history.'),
    })).toThrow(RangeError);

    expect(() => deriveCompositeGwapScoreV2({
      social: { state: 'observed', score: 80, confidence: 1.1 },
      wallet: unavailable('Not connected.'),
      identityProof: unavailable('Not verified.'),
      ecosystem: unavailable('No history.'),
    })).toThrow(RangeError);
  });

  test('preserves the public 300-900 tier contract', () => {
    expect(mapGwapScoreV2Tier(300)).toBe('High Risk');
    expect(mapGwapScoreV2Tier(500)).toBe('Developing');
    expect(mapGwapScoreV2Tier(600)).toBe('Established');
    expect(mapGwapScoreV2Tier(700)).toBe('Strong');
    expect(mapGwapScoreV2Tier(800)).toBe('Elite');
    expect(mapGwapScoreV2Tier(900)).toBe('Elite');
  });
});
