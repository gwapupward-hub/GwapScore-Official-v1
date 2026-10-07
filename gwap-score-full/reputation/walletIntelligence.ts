import { query } from '../database/client.js';
import { ReputationDimensionInput } from './composite.js';

export const WALLET_REPUTATION_MODEL_VERSION = 'wallet-v2-alpha.1' as const;

export interface WalletIntelligenceEvidence {
  userId: string;
  walletAddress: string;
  walletAgeDays: number;
  txCount: number;
  ownershipVerified: boolean;
  source?: string;
  provenance?: Record<string, unknown>;
}

export interface WalletIntelligenceSnapshot {
  snapshot_id: string;
  user_id: string;
  wallet_address: string;
  ownership_verified: boolean;
  wallet_age_days: number;
  tx_count: number;
  source: string;
  provenance: Record<string, unknown>;
  captured_at: string;
  created_at: string;
}

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

const round = (value: number, digits = 2): number => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

function scoreWalletAge(days: number): number {
  // Candidate alpha calibration: two years of observed wallet history reaches
  // the current maximum longevity subscore. This is versioned model policy.
  return clamp((days / 730) * 100);
}

function scoreTransactionActivity(txCount: number): number {
  // Preserve the legacy model's transparent 100 / 1,000 transaction anchors
  // without allowing transaction count alone to determine the final GwapScore.
  if (txCount <= 0) return 0;
  if (txCount < 100) return clamp((txCount / 100) * 50);
  if (txCount < 1000) return clamp(50 + ((txCount - 100) / 900) * 50);
  return 100;
}

export async function saveWalletIntelligenceSnapshot(
  evidence: WalletIntelligenceEvidence
): Promise<WalletIntelligenceSnapshot> {
  const result = await query<WalletIntelligenceSnapshot>(
    `INSERT INTO wallet_intelligence_snapshots (
       user_id, wallet_address, ownership_verified, wallet_age_days,
       tx_count, source, provenance
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING snapshot_id, user_id, wallet_address, ownership_verified,
               wallet_age_days, tx_count, source, provenance, captured_at, created_at`,
    [
      evidence.userId,
      evidence.walletAddress,
      evidence.ownershipVerified,
      evidence.walletAgeDays,
      evidence.txCount,
      evidence.source ?? 'solana_adapter',
      JSON.stringify(evidence.provenance ?? {}),
    ]
  );

  return result.rows[0];
}

export async function latestWalletIntelligenceSnapshot(
  userId: string
): Promise<WalletIntelligenceSnapshot | null> {
  const result = await query<WalletIntelligenceSnapshot>(
    `SELECT snapshot_id, user_id, wallet_address, ownership_verified,
            wallet_age_days, tx_count, source, provenance, captured_at, created_at
     FROM wallet_intelligence_snapshots
     WHERE user_id = $1
     ORDER BY captured_at DESC, created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] ?? null;
}

/**
 * Convert a trusted Wallet Intelligence snapshot into the wallet dimension used
 * by GwapScore v2. Wallet control is a hard gate: unverified wallets do not
 * affect reputation regardless of their apparent on-chain history.
 */
export function deriveWalletReputationDimension(
  snapshot: WalletIntelligenceSnapshot | null
): ReputationDimensionInput {
  if (!snapshot) {
    return { state: 'unavailable', reason: 'No Wallet Intelligence snapshot is available.' };
  }

  if (!snapshot.ownership_verified) {
    return { state: 'unavailable', reason: 'Wallet control has not been verified.' };
  }

  const ageScore = scoreWalletAge(Number(snapshot.wallet_age_days));
  const activityScore = scoreTransactionActivity(Number(snapshot.tx_count));
  const score = round(ageScore * 0.45 + activityScore * 0.55);

  return {
    state: 'observed',
    score,
    confidence: 1,
    provenance: [
      `wallet-intelligence:${snapshot.snapshot_id}`,
      `source:${snapshot.source}`,
      `model:${WALLET_REPUTATION_MODEL_VERSION}`,
    ],
    explanation: `Verified wallet reputation is ${score}/100 from wallet longevity (${round(ageScore)}/100) and transaction activity (${round(activityScore)}/100). Portfolio exposure risk is excluded.`,
  };
}
