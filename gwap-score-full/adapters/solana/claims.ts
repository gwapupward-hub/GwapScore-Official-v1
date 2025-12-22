import { appendClaim } from '../../core-engine/src/engine.js';
import { validate, solanaEvidenceSchema } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';

export interface SolanaEvidence {
  subjectId: string;
  walletAddress: string;
  walletAgeDays: number;
  txCount: number;
}

/**
 * Submits Solana blockchain evidence as claims
 * Validates wallet address and creates claims for wallet age and transaction count
 */
export async function submitSolanaEvidence(evidence: SolanaEvidence): Promise<void> {
  logger.info('Submitting Solana evidence', {
    subjectId: evidence.subjectId,
    walletAddress: evidence.walletAddress,
  });

  // Validate input
  const validatedEvidence = validate<SolanaEvidence>(solanaEvidenceSchema, evidence);

  const issuedAt = new Date().toISOString();

  // Append wallet ownership claim
  await appendClaim(validatedEvidence.subjectId, {
    type: 'owns_wallet',
    value: validatedEvidence.walletAddress,
    source: 'solana',
    issued_at: issuedAt,
  });

  // Append wallet age claim
  await appendClaim(validatedEvidence.subjectId, {
    type: 'solana_wallet_age_days',
    value: validatedEvidence.walletAgeDays.toString(),
    source: 'solana',
    issued_at: issuedAt,
  });

  // Append transaction count claim
  await appendClaim(validatedEvidence.subjectId, {
    type: 'solana_tx_count',
    value: validatedEvidence.txCount.toString(),
    source: 'solana',
    issued_at: issuedAt,
  });

  logger.info('Solana evidence submitted successfully', {
    subjectId: validatedEvidence.subjectId,
  });
}
