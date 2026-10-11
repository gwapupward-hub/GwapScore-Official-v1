import {
  deriveCompositeGwapScoreV2,
  type GwapScoreV2Input,
} from '../reputation/composite.js';

const unavailable = (reason: string) => ({ state: 'unavailable' as const, reason });

const baseline: GwapScoreV2Input = {
  social: { state: 'observed', score: 70, confidence: 0.9, provenance: ['social-proof'] },
  wallet: unavailable('Wallet not linked.'),
  identityProof: { state: 'observed', score: 90, confidence: 1, provenance: ['identity-proof'] },
  ecosystem: unavailable('No ecosystem evidence.'),
};

describe('GwapScore v2 foundation invariants', () => {
  test('is deterministic for identical evidence and model version', () => {
    const first = deriveCompositeGwapScoreV2(baseline);
    const second = deriveCompositeGwapScoreV2(baseline);

    expect(second).toEqual(first);
  });

  test('keeps unavailable evidence unavailable instead of converting it into a negative score', () => {
    const result = deriveCompositeGwapScoreV2(baseline);

    expect(result.dimensions.wallet.state).toBe('unavailable');
    expect(result.dimensions.wallet.score).toBeNull();
    expect(result.dimensions.wallet.effectiveWeight).toBe(0);
    expect(result.dimensions.ecosystem.state).toBe('unavailable');
    expect(result.dimensions.ecosystem.score).toBeNull();
  });

  test('keeps a single evidence source provisional even when the score is high', () => {
    const result = deriveCompositeGwapScoreV2({
      social: unavailable('Not connected.'),
      wallet: { state: 'observed', score: 100, confidence: 1, provenance: ['verified-wallet'] },
      identityProof: unavailable('Not verified.'),
      ecosystem: unavailable('No ecosystem evidence.'),
    });

    expect(result.status).toBe('provisional');
    expect(result.coverage).toBe(30);
    expect(result.score).toBe(900);
  });

  test('preserves contradictory dimensions rather than overwriting the weaker dimension', () => {
    const result = deriveCompositeGwapScoreV2({
      social: { state: 'observed', score: 25, confidence: 1, provenance: ['social-proof'] },
      wallet: { state: 'observed', score: 96, confidence: 1, provenance: ['wallet-proof'] },
      identityProof: unavailable('Not verified.'),
      ecosystem: unavailable('No ecosystem evidence.'),
    });

    expect(result.dimensions.social.score).toBe(25);
    expect(result.dimensions.wallet.score).toBe(96);
    expect(result.score).toBeGreaterThan(300 + 25 * 6);
    expect(result.score).toBeLessThan(300 + 96 * 6);
  });

  test('does not allow unknown wealth-like fields to affect the deterministic composite', () => {
    const withIrrelevantFinancialMetadata = deriveCompositeGwapScoreV2({
      ...baseline,
      wallet: {
        state: 'observed',
        score: 75,
        confidence: 1,
        provenance: ['wallet-intelligence'],
        walletBalanceUsd: 10_000_000,
        netWorthUsd: 25_000_000,
      } as GwapScoreV2Input['wallet'],
    });
    const sameWalletWithoutMetadata = deriveCompositeGwapScoreV2({
      ...baseline,
      wallet: {
        state: 'observed',
        score: 75,
        confidence: 1,
        provenance: ['wallet-intelligence'],
      },
    });

    expect(withIrrelevantFinancialMetadata).toEqual(sameWalletWithoutMetadata);
  });

  test('keeps every published score inside the 300-900 public range', () => {
    const low = deriveCompositeGwapScoreV2({
      social: { state: 'observed', score: 0, confidence: 1 },
      wallet: { state: 'observed', score: 0, confidence: 1 },
      identityProof: unavailable('Not verified.'),
      ecosystem: unavailable('No ecosystem evidence.'),
    });

    const high = deriveCompositeGwapScoreV2({
      social: { state: 'observed', score: 100, confidence: 1 },
      wallet: { state: 'observed', score: 100, confidence: 1 },
      identityProof: unavailable('Not verified.'),
      ecosystem: unavailable('No ecosystem evidence.'),
    });

    expect(low.score).toBe(300);
    expect(high.score).toBe(900);
  });
});
