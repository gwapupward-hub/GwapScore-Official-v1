import { TrustProfile } from '../core-engine/src/types.js';

// Scoring constants - extracted for transparency and maintainability
export const SCORING_CONSTANTS = {
  // Base score given to all profiles
  BASE_SCORE: 20,

  // Claim type scores
  WALLET_OWNERSHIP_SCORE: 10,
  TELEGRAM_LINKED_SCORE: 5,
  ESTABLISHED_WALLET_SCORE: 10,
  ESTABLISHED_WALLET_AGE_DAYS: 180,
  ACTIVE_WALLET_SCORE: 5,
  ACTIVE_WALLET_TX_THRESHOLD: 100,
  HIGH_ACTIVITY_WALLET_SCORE: 10,
  HIGH_ACTIVITY_TX_THRESHOLD: 1000,

  // Event scores
  POSITIVE_INTERACTION_SCORE: 2,
  POLICY_VIOLATION_PENALTY: 15,

  // Base multiplier (before attestations)
  BASE_MULTIPLIER: 1,

  // Score bounds
  MIN_SCORE: 0,
  MAX_SCORE: 100,

  // Tier thresholds
  ELITE_THRESHOLD: 80,
  TRUSTED_THRESHOLD: 60,
  VERIFIED_THRESHOLD: 30,
} as const;

export type ScoringResult = {
  score: number;
  tier: 'Elite' | 'Trusted' | 'Verified' | 'Rookie';
  risk: 'Low' | 'Medium' | 'High';
  explanation: {
    base_score: number;
    contributing_claims: string[];
    contributing_events: string[];
    active_attestations: string[];
    penalties_applied: string[];
    multiplier: number;
    final_score_calculation: string;
  };
};

/**
 * Derives a trust score from a profile
 * Score is calculated, not stored - ensuring explainability and immutability
 */
export function deriveScore(profile: TrustProfile): ScoringResult {
  let score: number = SCORING_CONSTANTS.BASE_SCORE;
  const explanation = {
    base_score: SCORING_CONSTANTS.BASE_SCORE,
    contributing_claims: [] as string[],
    contributing_events: [] as string[],
    active_attestations: [] as string[],
    penalties_applied: [] as string[],
    multiplier: SCORING_CONSTANTS.BASE_MULTIPLIER,
    final_score_calculation: '',
  };

  // Process claims
  for (const claim of profile.claims) {
    // Check for expired claims
    if (claim.expires_at && new Date(claim.expires_at).getTime() < Date.now()) {
      continue; // Skip expired claims
    }

    switch (claim.type) {
      case 'owns_wallet':
        score += SCORING_CONSTANTS.WALLET_OWNERSHIP_SCORE;
        explanation.contributing_claims.push(
          `Wallet ownership verified (+${SCORING_CONSTANTS.WALLET_OWNERSHIP_SCORE})`
        );
        break;

      case 'telegram_id':
        score += SCORING_CONSTANTS.TELEGRAM_LINKED_SCORE;
        explanation.contributing_claims.push(
          `Telegram account linked (+${SCORING_CONSTANTS.TELEGRAM_LINKED_SCORE})`
        );
        break;

      case 'solana_wallet_age_days': {
        const days = parseInt(claim.value, 10);
        if (!isNaN(days) && days >= SCORING_CONSTANTS.ESTABLISHED_WALLET_AGE_DAYS) {
          score += SCORING_CONSTANTS.ESTABLISHED_WALLET_SCORE;
          explanation.contributing_claims.push(
            `Established Solana wallet (${days} days, +${SCORING_CONSTANTS.ESTABLISHED_WALLET_SCORE})`
          );
        }
        break;
      }

      case 'solana_tx_count': {
        const txCount = parseInt(claim.value, 10);
        if (!isNaN(txCount)) {
          if (txCount >= SCORING_CONSTANTS.HIGH_ACTIVITY_TX_THRESHOLD) {
            score += SCORING_CONSTANTS.HIGH_ACTIVITY_WALLET_SCORE;
            explanation.contributing_claims.push(
              `High activity wallet (${txCount} txs, +${SCORING_CONSTANTS.HIGH_ACTIVITY_WALLET_SCORE})`
            );
          } else if (txCount >= SCORING_CONSTANTS.ACTIVE_WALLET_TX_THRESHOLD) {
            score += SCORING_CONSTANTS.ACTIVE_WALLET_SCORE;
            explanation.contributing_claims.push(
              `Active wallet (${txCount} txs, +${SCORING_CONSTANTS.ACTIVE_WALLET_SCORE})`
            );
          }
        }
        break;
      }
    }
  }

  // Process events
  for (const event of profile.events) {
    switch (event.event_type) {
      case 'positive_interaction':
        score += SCORING_CONSTANTS.POSITIVE_INTERACTION_SCORE;
        explanation.contributing_events.push(
          `${event.description} (+${SCORING_CONSTANTS.POSITIVE_INTERACTION_SCORE})`
        );
        break;

      case 'policy_violation':
        score -= SCORING_CONSTANTS.POLICY_VIOLATION_PENALTY;
        explanation.penalties_applied.push(
          `${event.description} (-${SCORING_CONSTANTS.POLICY_VIOLATION_PENALTY})`
        );
        break;
    }
  }

  // Store pre-multiplier score for explanation
  const preMultiplierScore = score;

  // Process attestations (multiplier effect)
  let multiplier = SCORING_CONSTANTS.BASE_MULTIPLIER;
  const now = Date.now();

  for (const attestation of profile.attestations) {
    // Only count verified attestations that haven't expired
    if (
      attestation.signature_verified &&
      (!attestation.expires_at || new Date(attestation.expires_at).getTime() > now)
    ) {
      multiplier += attestation.weight;
      explanation.active_attestations.push(
        `Attested by ${attestation.issuer_id} (scope: ${attestation.scope}, weight: ${attestation.weight})`
      );
    }
  }

  explanation.multiplier = multiplier;

  // Apply multiplier
  score = Math.round(score * multiplier);

  // Clamp score to valid range
  score = Math.max(SCORING_CONSTANTS.MIN_SCORE, Math.min(SCORING_CONSTANTS.MAX_SCORE, score));

  // Build explanation of final calculation
  explanation.final_score_calculation = `(${preMultiplierScore} × ${multiplier.toFixed(2)}) = ${score}`;

  // Determine tier
  let tier: ScoringResult['tier'];
  if (score >= SCORING_CONSTANTS.ELITE_THRESHOLD) {
    tier = 'Elite';
  } else if (score >= SCORING_CONSTANTS.TRUSTED_THRESHOLD) {
    tier = 'Trusted';
  } else if (score >= SCORING_CONSTANTS.VERIFIED_THRESHOLD) {
    tier = 'Verified';
  } else {
    tier = 'Rookie';
  }

  // Determine risk level
  let risk: ScoringResult['risk'];
  if (score < SCORING_CONSTANTS.VERIFIED_THRESHOLD) {
    risk = 'High';
  } else if (score < SCORING_CONSTANTS.TRUSTED_THRESHOLD) {
    risk = 'Medium';
  } else {
    risk = 'Low';
  }

  return {
    score,
    tier,
    risk,
    explanation,
  };
}

/**
 * Gets a human-readable explanation of the scoring algorithm
 */
export function getScoringAlgorithmDescription(): string {
  return `
GwapScore Trust Scoring Algorithm v1.0

BASE SCORE: ${SCORING_CONSTANTS.BASE_SCORE} points

CLAIM SCORES:
- Wallet Ownership: +${SCORING_CONSTANTS.WALLET_OWNERSHIP_SCORE}
- Telegram Linked: +${SCORING_CONSTANTS.TELEGRAM_LINKED_SCORE}
- Established Wallet (${SCORING_CONSTANTS.ESTABLISHED_WALLET_AGE_DAYS}+ days): +${SCORING_CONSTANTS.ESTABLISHED_WALLET_SCORE}
- Active Wallet (${SCORING_CONSTANTS.ACTIVE_WALLET_TX_THRESHOLD}+ txs): +${SCORING_CONSTANTS.ACTIVE_WALLET_SCORE}
- High Activity Wallet (${SCORING_CONSTANTS.HIGH_ACTIVITY_TX_THRESHOLD}+ txs): +${SCORING_CONSTANTS.HIGH_ACTIVITY_WALLET_SCORE}

EVENT SCORES:
- Positive Interaction: +${SCORING_CONSTANTS.POSITIVE_INTERACTION_SCORE}
- Policy Violation: -${SCORING_CONSTANTS.POLICY_VIOLATION_PENALTY}

MULTIPLIERS:
- Base Multiplier: ${SCORING_CONSTANTS.BASE_MULTIPLIER}x
- Attestations: Add their weight to multiplier
- Final Score = (Base + Claims + Events) × (1 + Attestation Weights)

SCORE BOUNDS: ${SCORING_CONSTANTS.MIN_SCORE}-${SCORING_CONSTANTS.MAX_SCORE}

TIERS:
- Elite: ${SCORING_CONSTANTS.ELITE_THRESHOLD}+ (Low Risk)
- Trusted: ${SCORING_CONSTANTS.TRUSTED_THRESHOLD}-${SCORING_CONSTANTS.ELITE_THRESHOLD - 1} (Low Risk)
- Verified: ${SCORING_CONSTANTS.VERIFIED_THRESHOLD}-${SCORING_CONSTANTS.TRUSTED_THRESHOLD - 1} (Medium Risk)
- Rookie: 0-${SCORING_CONSTANTS.VERIFIED_THRESHOLD - 1} (High Risk)
  `.trim();
}
