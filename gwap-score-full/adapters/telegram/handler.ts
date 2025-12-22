import { appendClaim, appendEvent } from '../../core-engine/src/engine.js';
import { validate, telegramVerifySchema } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';

export interface TelegramVerification {
  subjectId: string;
  telegramId: string;
  telegramUsername?: string;
}

/**
 * Handles Telegram account verification
 * Creates a claim for the Telegram ID and records a positive interaction event
 */
export async function handleTelegramVerify(verification: TelegramVerification): Promise<void> {
  logger.info('Handling Telegram verification', {
    subjectId: verification.subjectId,
    telegramId: verification.telegramId,
  });

  // Validate input
  const validatedVerification = validate<TelegramVerification>(
    telegramVerifySchema,
    verification
  );

  const issuedAt = new Date().toISOString();

  // Append Telegram ID claim
  await appendClaim(validatedVerification.subjectId, {
    type: 'telegram_id',
    value: validatedVerification.telegramId,
    source: 'telegram',
    issued_at: issuedAt,
  });

  // Append positive interaction event
  const description = validatedVerification.telegramUsername
    ? `Telegram account linked (@${validatedVerification.telegramUsername})`
    : 'Telegram account linked';

  await appendEvent(validatedVerification.subjectId, {
    event_type: 'positive_interaction',
    description,
    source: 'telegram',
    issued_at: issuedAt,
  });

  logger.info('Telegram verification handled successfully', {
    subjectId: validatedVerification.subjectId,
  });
}
