import {
  deriveWalletReputationDimension,
  WalletIntelligenceSnapshot,
} from '../reputation/walletIntelligence.js';

function snapshot(overrides: Partial<WalletIntelligenceSnapshot> = {}): WalletIntelligenceSnapshot {
  return {
    snapshot_id: '11111111-1111-4111-8111-111111111111',
    user_id: 'user-1',
    wallet_address: '11111111111111111111111111111111111111111111',
    ownership_verified: true,
    wallet_age_days: 730,
    tx_count: 1000,
    source: 'solana_adapter',
    provenance: {},
    captured_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('wallet intelligence reputation dimension', () => {
  test('does not score a wallet until control is verified', () => {
    const result = deriveWalletReputationDimension(snapshot({ ownership_verified: false }));

    expect(result.state).toBe('unavailable');
    if (result.state === 'unavailable') {
      expect(result.reason).toMatch(/not been verified/i);
    }
  });

  test('maps strong verified wallet history to an excellent wallet dimension', () => {
    const result = deriveWalletReputationDimension(snapshot());

    expect(result.state).toBe('observed');
    if (result.state === 'observed') {
      expect(result.score).toBe(100);
      expect(result.confidence).toBe(1);
      expect(result.provenance).toContain('source:solana_adapter');
    }
  });

  test('keeps the wallet model transparent at legacy activity anchors', () => {
    const result = deriveWalletReputationDimension(snapshot({
      wallet_age_days: 365,
      tx_count: 100,
    }));

    expect(result.state).toBe('observed');
    if (result.state === 'observed') {
      expect(result.score).toBe(50);
      expect(result.explanation).toMatch(/longevity \(50\/100\)/);
      expect(result.explanation).toMatch(/activity \(50\/100\)/);
    }
  });

  test('reports missing Wallet Intelligence as unavailable instead of zero', () => {
    expect(deriveWalletReputationDimension(null)).toEqual({
      state: 'unavailable',
      reason: 'No Wallet Intelligence snapshot is available.',
    });
  });
});
