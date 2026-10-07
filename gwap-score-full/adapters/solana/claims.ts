import { appendClaim } from '../../core-engine/src/engine.js';
import { query } from '../../database/client.js';
import { validate, solanaEvidenceSchema } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';
import { saveWalletIntelligenceSnapshot } from '../../reputation/walletIntelligence.js';

export interface SolanaEvidence {
  subjectId: string;
  walletAddress: string;
  walletAgeDays: number;
  txCount: number;
  ownershipVerified?: boolean;
}

/**
 * Ensure a first-time verified wallet can enter the reputation pipeline without
 * requiring the caller to hold the broader profile:create permission.
 *
 * The privileged adapter still controls which evidence can be submitted; this
 * only provisions the append-only subject row required by claims/snapshots.
 */
async function ensureWalletEvidenceSubject(subjectId: string): Promise<void> {
  await query(
    `INSERT INTO trust_profiles (subject_id)
     VALUES ($1)
     ON CONFLICT (subject_id) DO NOTHING`,
    [subjectId]
  );
}

/**
 * Submits Solana blockchain evidence as legacy claims and as a dedicated v2
 * Wallet Intelligence snapshot. Only the dedicated snapshot is eligible for
 * the v2 wallet-reputation dimension.
 */
export async function submitSolanaEvidence(evidence: SolanaEvidence): Promise<void> {
  logger.info('Submitting Solana evidence', {
    subjectId: evidence.subjectId,
    walletAddress: evidence.walletAddress,
  });

  const validatedEvidence = validate<SolanaEvidence & { ownershipVerified: boolean }>(
    solanaEvidenceSchema,
    evidence
  );

  await ensureWalletEvidenceSubject(validatedEvidence.subjectId);

  const issuedAt = new Date().toISOString();

  // Preserve existing append-only claims for backwards compatibility.
  await appendClaim(validatedEvidence.subjectId, {
    type: 'owns_wallet',
    value: validatedEvidence.walletAddress,
    source: 'solana',
    issued_at: issuedAt,
  });

  await appendClaim(validatedEvidence.subjectId, {
    type: 'solana_wallet_age_days',
    value: validatedEvidence.walletAgeDays.toString(),
    source: 'solana',
    issued_at: issuedAt,
  });

  await appendClaim(validatedEvidence.subjectId, {
    type: 'solana_tx_count',
    value: validatedEvidence.txCount.toString(),
    source: 'solana',
    issued_at: issuedAt,
  });

  // v2 consumes this privileged evidence record, not arbitrary generic claims.
  await saveWalletIntelligenceSnapshot({
    userId: validatedEvidence.subjectId,
    walletAddress: validatedEvidence.walletAddress,
    walletAgeDays: validatedEvidence.walletAgeDays,
    txCount: validatedEvidence.txCount,
    ownershipVerified: validatedEvidence.ownershipVerified,
    source: 'solana_adapter',
    provenance: {
      adapter: 'solana',
      submitted_at: issuedAt,
    },
  });

  logger.info('Solana evidence submitted successfully', {
    subjectId: validatedEvidence.subjectId,
    ownershipVerified: validatedEvidence.ownershipVerified,
  });
}
