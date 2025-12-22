import Joi from 'joi';
import { ValidationError } from './errors.js';

// Subject ID validation (wallet address, telegram ID, etc.)
export const subjectIdSchema = Joi.string()
  .min(1)
  .max(255)
  .pattern(/^[a-zA-Z0-9_-]+$/)
  .required();

// Claim validation
export const claimSchema = Joi.object({
  claim_id: Joi.string().uuid().optional(),
  type: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-z_]+$/)
    .required(),
  value: Joi.string().min(1).max(10000).required(),
  source: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-z_]+$/)
    .required(),
  issued_at: Joi.date().iso().max('now').required(),
  expires_at: Joi.date().iso().greater(Joi.ref('issued_at')).optional(),
});

// Event validation
export const eventSchema = Joi.object({
  event_id: Joi.string().uuid().optional(),
  event_type: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-z_]+$/)
    .required(),
  description: Joi.string().min(1).max(1000).required(),
  source: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-z_]+$/)
    .required(),
  issued_at: Joi.date().iso().max('now').required(),
});

// Attestation validation
export const attestationSchema = Joi.object({
  attestation_id: Joi.string().uuid().optional(),
  issuer_id: Joi.string().min(1).max(255).required(),
  scope: Joi.string().min(1).max(100).required(),
  weight: Joi.number().min(0).max(10).precision(4).required(),
  issued_at: Joi.date().iso().max('now').required(),
  expires_at: Joi.date().iso().greater(Joi.ref('issued_at')).optional(),
  signature: Joi.string().min(1).max(1000).required(),
});

// Solana wallet validation
export const solanaWalletSchema = Joi.string()
  .length(44)
  .pattern(/^[1-9A-HJ-NP-Za-km-z]{44}$/)
  .required();

// Telegram ID validation
export const telegramIdSchema = Joi.string()
  .pattern(/^\d+$/)
  .min(1)
  .max(20)
  .required();

// Solana evidence validation
export const solanaEvidenceSchema = Joi.object({
  subjectId: subjectIdSchema,
  walletAddress: solanaWalletSchema,
  walletAgeDays: Joi.number().integer().min(0).max(10000).required(),
  txCount: Joi.number().integer().min(0).max(1000000000).required(),
});

// Telegram verification validation
export const telegramVerifySchema = Joi.object({
  subjectId: subjectIdSchema,
  telegramId: telegramIdSchema,
  telegramUsername: Joi.string().min(1).max(32).optional(),
});

// Generic validator function
export function validate<T>(
  schema: Joi.ObjectSchema | Joi.StringSchema,
  data: unknown
): T {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    throw new ValidationError('Validation failed', details);
  }

  return value as T;
}

// Sanitization helpers
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function sanitizeSubjectId(input: string): string {
  const sanitized = input.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(sanitized)) {
    throw new ValidationError('Invalid subject ID format');
  }
  return sanitized;
}
