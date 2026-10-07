import { query } from '../database/client.js';
import {
  deriveCompositeGwapScoreV2,
  GwapScoreV2Result,
  ReputationDimensionInput,
} from './composite.js';
import {
  deriveWalletReputationDimension,
  latestWalletIntelligenceSnapshot,
  WalletIntelligenceSnapshot,
} from './walletIntelligence.js';

interface StoredSocialScore {
  score_id: string;
  account_id: string | null;
  platform: string | null;
  score: number;
  grade: string;
  explanation: unknown;
  created_at: string;
}

interface SocialFactorEvidence {
  state?: unknown;
  effectiveWeight?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Convert only post-migration social scores into a v2 dimension. Legacy rows
 * intentionally remain unavailable until re-ingested because they used neutral
 * imputation for missing evidence.
 */
export function deriveSocialReputationDimension(
  row: StoredSocialScore | null
): ReputationDimensionInput {
  if (!row) {
    return { state: 'unavailable', reason: 'No social reputation score is available.' };
  }

  if (!isRecord(row.explanation) || !Array.isArray(row.explanation.factors)) {
    return {
      state: 'unavailable',
      reason: 'Latest social score predates the v2 evidence-state contract; re-ingestion is required.',
    };
  }

  const factors = row.explanation.factors as SocialFactorEvidence[];
  const hasEvidenceState = factors.some((factor) => factor.state === 'observed' || factor.state === 'unavailable');
  if (!hasEvidenceState) {
    return {
      state: 'unavailable',
      reason: 'Latest social score predates the v2 evidence-state contract; re-ingestion is required.',
    };
  }

  const coverage = clamp(factors.reduce((sum, factor) => {
    if (factor.state !== 'observed' || typeof factor.effectiveWeight !== 'number' || !Number.isFinite(factor.effectiveWeight)) {
      return sum;
    }
    return sum + factor.effectiveWeight;
  }, 0));

  if (coverage <= 0) {
    return { state: 'unavailable', reason: 'Social evidence exists but has no usable observed coverage.' };
  }

  const score = Number(row.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return { state: 'unavailable', reason: 'Stored social reputation score is invalid.' };
  }

  return {
    state: 'observed',
    score,
    confidence: coverage / 100,
    provenance: [
      `social-score:${row.score_id}`,
      `platform:${row.platform ?? 'unknown'}`,
    ],
    explanation: `Social reputation is ${score}/100 with ${Math.round(coverage)}% observed model coverage.`,
  };
}

function deriveIdentityProofDimension(
  hasConnectedSocial: boolean,
  wallet: WalletIntelligenceSnapshot | null
): ReputationDimensionInput {
  const provenance: string[] = [];
  let proofs = 0;

  if (hasConnectedSocial) {
    proofs += 1;
    provenance.push('proof:social-oauth-control');
  }

  if (wallet?.ownership_verified) {
    proofs += 1;
    provenance.push(`proof:wallet-control:${wallet.snapshot_id}`);
  }

  if (proofs === 0) {
    return { state: 'unavailable', reason: 'No verified identity-control evidence is available.' };
  }

  return {
    state: 'observed',
    score: 100,
    confidence: proofs / 2,
    provenance,
    explanation: `${proofs} of 2 currently supported identity-control proof classes are verified.`,
  };
}

export class ReputationService {
  async getScore(userId: string): Promise<GwapScoreV2Result> {
    const [socialResult, socialAccountResult, wallet] = await Promise.all([
      query<StoredSocialScore>(
        `SELECT score_id, account_id, platform, score, grade, explanation, created_at
         FROM reputation_scores
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      ),
      query<{ connected: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM social_accounts
           WHERE user_id = $1 AND status = 'connected'
         ) AS connected`,
        [userId]
      ),
      latestWalletIntelligenceSnapshot(userId),
    ]);

    const social = deriveSocialReputationDimension(socialResult.rows[0] ?? null);
    const walletDimension = deriveWalletReputationDimension(wallet);
    const identityProof = deriveIdentityProofDimension(
      socialAccountResult.rows[0]?.connected === true,
      wallet
    );

    return deriveCompositeGwapScoreV2({
      social,
      wallet: walletDimension,
      identityProof,
      ecosystem: {
        state: 'unavailable',
        reason: 'Trusted GWAP ecosystem reputation evidence is not connected to v2 yet.',
      },
    });
  }
}

export const reputationService = new ReputationService();
