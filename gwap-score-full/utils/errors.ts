export enum ErrorCode {
  // Profile errors (1xxx)
  PROFILE_EXISTS = 'PROFILE_EXISTS',
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  PROFILE_CREATION_FAILED = 'PROFILE_CREATION_FAILED',

  // Validation errors (2xxx)
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Authentication errors (3xxx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_API_KEY = 'INVALID_API_KEY',
  API_KEY_EXPIRED = 'API_KEY_EXPIRED',

  // Attestation errors (4xxx)
  SIGNATURE_VERIFICATION_FAILED = 'SIGNATURE_VERIFICATION_FAILED',
  ISSUER_NOT_TRUSTED = 'ISSUER_NOT_TRUSTED',
  ATTESTATION_EXPIRED = 'ATTESTATION_EXPIRED',

  // Database errors (5xxx)
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',

  // Rate limiting (6xxx)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // General errors (9xxx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

export class ProfileExistsError extends AppError {
  constructor(subjectId: string) {
    super(
      ErrorCode.PROFILE_EXISTS,
      'Profile already exists',
      409,
      { subjectId }
    );
  }
}

export class ProfileNotFoundError extends AppError {
  constructor(subjectId: string) {
    super(
      ErrorCode.PROFILE_NOT_FOUND,
      'Profile not found',
      404,
      { subjectId }
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION_FAILED, message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(ErrorCode.UNAUTHORIZED, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(ErrorCode.FORBIDDEN, message, 403);
  }
}

export class SignatureVerificationError extends AppError {
  constructor(details?: unknown) {
    super(
      ErrorCode.SIGNATURE_VERIFICATION_FAILED,
      'Signature verification failed',
      400,
      details
    );
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      429
    );
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.DATABASE_ERROR, message, 500, details);
  }
}
