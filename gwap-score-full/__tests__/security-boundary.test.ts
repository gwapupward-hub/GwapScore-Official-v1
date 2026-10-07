import { deriveCompositeGwapScoreV2 } from '../reputation/composite.js';
import { deriveWalletReputationDimension } from '../reputation/walletIntelligence.js';

describe('GwapScore v2 evidence security boundaries', () => {
  test('an unverified excellent-looking wallet cannot influence GwapScore', () => {
    const wallet = deriveWalletReputationDimension({
      snapshot_id: '22222222-2222-4222-8222-222222222222',
      user_id: 'user-1',
      wallet_address: '11111111111111111111111111111111111111111111',
      ownership_verified: false,
      wallet_age_days: 5000,
      tx_count: 1_000_000,
      source: 'solana_adapter',
      provenance: {},
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    const result = deriveCompositeGwapScoreV2({
      social: {
        state: 'observed',
        score: 20,
        confidence: 1,
        provenance: ['social:test'],
        explanation: 'Weak observed social reputation.',
      },
      wallet,
      identityProof: { state: 'unavailable', reason: 'No verified proof.' },
      ecosystem: { state: 'unavailable', reason: 'No ecosystem evidence.' },
    });

    expect(wallet.state).toBe('unavailable');
    expect(result.dimensions.wallet.state).toBe('unavailable');
    expect(result.composite100).toBe(20);
    expect(result.score).toBe(420);
  });

  test('unavailable wallet evidence does not become an implicit zero penalty', () => {
    const withMissingWallet = deriveCompositeGwapScoreV2({
      social: {
        state: 'observed',
        score: 80,
        confidence: 1,
        provenance: ['social:test'],
        explanation: 'Strong social reputation.',
      },
      wallet: { state: 'unavailable', reason: 'Not linked.' },
      identityProof: {
        state: 'observed',
        score: 100,
        confidence: 0.5,
        provenance: ['proof:social'],
        explanation: 'One verified proof class.',
      },
      ecosystem: { state: 'unavailable', reason: 'Not available.' },
    });

    expect(withMissingWallet.dimensions.wallet.state).toBe('unavailable');
    expect(withMissingWallet.composite100).toBeGreaterThan(80);
    expect(withMissingWallet.unavailableEvidence).toContain('wallet');
  });
});
