import { TrustProfile, Claim, Event, Attestation, TrustedIssuer } from './types.js';
import { query, transaction } from '../../database/client.js';
import {
  ProfileExistsError,
  ProfileNotFoundError,
  ValidationError,
  SignatureVerificationError,
  DatabaseError,
} from '../../utils/errors.js';
import { validate, claimSchema, eventSchema, attestationSchema } from '../../utils/validation.js';
import { verifyAttestationSignature, SignaturePayload } from '../../utils/crypto.js';
import { logger } from '../../utils/logger.js';

/**
 * Creates a new trust profile
 * Uses database transaction to prevent race conditions
 */
export async function createProfile(subject_id: string): Promise<TrustProfile> {
  logger.info('Creating profile', { subject_id });

  if (!subject_id || subject_id.length === 0) {
    throw new ValidationError('Subject ID is required');
  }

  try {
    const result = await query<{ subject_id: string; created_at: string }>(
      `INSERT INTO trust_profiles (subject_id)
       VALUES ($1)
       ON CONFLICT (subject_id) DO NOTHING
       RETURNING subject_id, created_at`,
      [subject_id]
    );

    if (result.rowCount === 0) {
      throw new ProfileExistsError(subject_id);
    }

    const profile: TrustProfile = {
      subject_id: result.rows[0].subject_id,
      created_at: result.rows[0].created_at,
      claims: [],
      events: [],
      attestations: [],
    };

    logger.info('Profile created successfully', { subject_id });
    return profile;
  } catch (error) {
    if (error instanceof ProfileExistsError) {
      throw error;
    }
    logger.error('Failed to create profile', { subject_id, error });
    throw new DatabaseError('Failed to create profile', { subject_id });
  }
}

/**
 * Appends a claim to a profile with validation
 */
export async function appendClaim(subject_id: string, claim: Omit<Claim, 'claim_id' | 'created_at'>): Promise<Claim> {
  logger.info('Appending claim', { subject_id, claim_type: claim.type });

  // Validate claim
  const validatedClaim = validate<Claim>(claimSchema, claim);

  try {
    const result = await query<Claim>(
      `INSERT INTO claims (subject_id, type, value, source, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING claim_id, subject_id, type, value, source, issued_at, expires_at, created_at`,
      [
        subject_id,
        validatedClaim.type,
        validatedClaim.value,
        validatedClaim.source,
        validatedClaim.issued_at,
        validatedClaim.expires_at || null,
      ]
    );

    if (result.rowCount === 0) {
      throw new DatabaseError('Failed to append claim');
    }

    logger.info('Claim appended successfully', {
      subject_id,
      claim_id: result.rows[0].claim_id
    });

    return result.rows[0];
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    // Check if profile doesn't exist (foreign key violation)
    if ((error as { code?: string }).code === '23503') {
      throw new ProfileNotFoundError(subject_id);
    }

    logger.error('Failed to append claim', { subject_id, error });
    throw new DatabaseError('Failed to append claim', { subject_id });
  }
}

/**
 * Appends an event to a profile with validation
 */
export async function appendEvent(subject_id: string, event: Omit<Event, 'event_id' | 'created_at'>): Promise<Event> {
  logger.info('Appending event', { subject_id, event_type: event.event_type });

  // Validate event
  const validatedEvent = validate<Event>(eventSchema, event);

  try {
    const result = await query<Event>(
      `INSERT INTO events (subject_id, event_type, description, source, issued_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING event_id, subject_id, event_type, description, source, issued_at, created_at`,
      [
        subject_id,
        validatedEvent.event_type,
        validatedEvent.description,
        validatedEvent.source,
        validatedEvent.issued_at,
      ]
    );

    if (result.rowCount === 0) {
      throw new DatabaseError('Failed to append event');
    }

    logger.info('Event appended successfully', {
      subject_id,
      event_id: result.rows[0].event_id
    });

    return result.rows[0];
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    // Check if profile doesn't exist (foreign key violation)
    if ((error as { code?: string }).code === '23503') {
      throw new ProfileNotFoundError(subject_id);
    }

    logger.error('Failed to append event', { subject_id, error });
    throw new DatabaseError('Failed to append event', { subject_id });
  }
}

/**
 * Appends an attestation with signature verification
 */
export async function appendAttestation(
  subject_id: string,
  attestation: Omit<Attestation, 'attestation_id' | 'created_at' | 'signature_verified'>
): Promise<Attestation> {
  logger.info('Appending attestation', {
    subject_id,
    issuer_id: attestation.issuer_id
  });

  // Validate attestation structure
  const validatedAttestation = validate<Attestation>(attestationSchema, attestation);

  // Use transaction to ensure atomicity
  return transaction(async (client) => {
    // Check if issuer is trusted
    const issuerResult = await client.query<TrustedIssuer>(
      `SELECT * FROM trusted_issuers
       WHERE issuer_id = $1 AND is_active = TRUE`,
      [validatedAttestation.issuer_id]
    );

    if (issuerResult.rowCount === 0) {
      throw new ValidationError('Issuer is not trusted or inactive', {
        issuer_id: validatedAttestation.issuer_id,
      });
    }

    const issuer = issuerResult.rows[0];

    // Verify weight doesn't exceed issuer's max_weight
    if (validatedAttestation.weight > issuer.max_weight) {
      throw new ValidationError('Attestation weight exceeds issuer maximum', {
        weight: validatedAttestation.weight,
        max_weight: issuer.max_weight,
      });
    }

    // Verify signature
    const signaturePayload: SignaturePayload = {
      subject_id,
      issuer_id: validatedAttestation.issuer_id,
      scope: validatedAttestation.scope,
      weight: validatedAttestation.weight,
      issued_at: validatedAttestation.issued_at,
      expires_at: validatedAttestation.expires_at,
    };

    const signatureValid = verifyAttestationSignature(
      signaturePayload,
      validatedAttestation.signature,
      issuer.public_key
    );

    if (!signatureValid) {
      throw new SignatureVerificationError({
        issuer_id: validatedAttestation.issuer_id,
        subject_id,
      });
    }

    // Insert attestation
    const result = await client.query<Attestation>(
      `INSERT INTO attestations
       (subject_id, issuer_id, scope, weight, issued_at, expires_at, signature, signature_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING attestation_id, subject_id, issuer_id, scope, weight, issued_at, expires_at, signature, signature_verified, created_at`,
      [
        subject_id,
        validatedAttestation.issuer_id,
        validatedAttestation.scope,
        validatedAttestation.weight,
        validatedAttestation.issued_at,
        validatedAttestation.expires_at || null,
        validatedAttestation.signature,
      ]
    );

    if (result.rowCount === 0) {
      throw new DatabaseError('Failed to append attestation');
    }

    logger.info('Attestation appended successfully', {
      subject_id,
      attestation_id: result.rows[0].attestation_id,
      signature_verified: true
    });

    return result.rows[0];
  });
}

/**
 * Retrieves a complete trust profile
 */
export async function getProfile(subject_id: string): Promise<TrustProfile> {
  logger.info('Retrieving profile', { subject_id });

  try {
    // Get profile
    const profileResult = await query<{ subject_id: string; created_at: string; updated_at: string }>(
      'SELECT subject_id, created_at, updated_at FROM trust_profiles WHERE subject_id = $1',
      [subject_id]
    );

    if (profileResult.rowCount === 0) {
      throw new ProfileNotFoundError(subject_id);
    }

    // Get claims
    const claimsResult = await query<Claim>(
      'SELECT * FROM claims WHERE subject_id = $1 ORDER BY issued_at DESC',
      [subject_id]
    );

    // Get events
    const eventsResult = await query<Event>(
      'SELECT * FROM events WHERE subject_id = $1 ORDER BY issued_at DESC',
      [subject_id]
    );

    // Get attestations
    const attestationsResult = await query<Attestation>(
      'SELECT * FROM attestations WHERE subject_id = $1 ORDER BY issued_at DESC',
      [subject_id]
    );

    const profile: TrustProfile = {
      subject_id: profileResult.rows[0].subject_id,
      created_at: profileResult.rows[0].created_at,
      updated_at: profileResult.rows[0].updated_at,
      claims: claimsResult.rows,
      events: eventsResult.rows,
      attestations: attestationsResult.rows,
    };

    logger.info('Profile retrieved successfully', {
      subject_id,
      claims_count: profile.claims.length,
      events_count: profile.events.length,
      attestations_count: profile.attestations.length
    });

    return profile;
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      throw error;
    }

    logger.error('Failed to retrieve profile', { subject_id, error });
    throw new DatabaseError('Failed to retrieve profile', { subject_id });
  }
}

/**
 * Checks if a profile exists
 */
export async function profileExists(subject_id: string): Promise<boolean> {
  try {
    const result = await query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM trust_profiles WHERE subject_id = $1)',
      [subject_id]
    );
    return result.rows[0].exists;
  } catch (error) {
    logger.error('Failed to check profile existence', { subject_id, error });
    return false;
  }
}

/**
 * Registers or updates a trusted issuer
 */
export async function registerTrustedIssuer(issuer: Omit<TrustedIssuer, 'created_at' | 'updated_at'>): Promise<TrustedIssuer> {
  logger.info('Registering trusted issuer', { issuer_id: issuer.issuer_id });

  try {
    const result = await query<TrustedIssuer>(
      `INSERT INTO trusted_issuers (issuer_id, public_key, name, description, max_weight, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (issuer_id)
       DO UPDATE SET
         public_key = EXCLUDED.public_key,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         max_weight = EXCLUDED.max_weight,
         is_active = EXCLUDED.is_active
       RETURNING *`,
      [
        issuer.issuer_id,
        issuer.public_key,
        issuer.name,
        issuer.description || null,
        issuer.max_weight,
        issuer.is_active,
      ]
    );

    logger.info('Trusted issuer registered', { issuer_id: issuer.issuer_id });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to register trusted issuer', { issuer_id: issuer.issuer_id, error });
    throw new DatabaseError('Failed to register trusted issuer');
  }
}

/**
 * Gets a trusted issuer by ID
 */
export async function getTrustedIssuer(issuer_id: string): Promise<TrustedIssuer | null> {
  try {
    const result = await query<TrustedIssuer>(
      'SELECT * FROM trusted_issuers WHERE issuer_id = $1',
      [issuer_id]
    );
    return result.rowCount > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Failed to get trusted issuer', { issuer_id, error });
    return null;
  }
}
