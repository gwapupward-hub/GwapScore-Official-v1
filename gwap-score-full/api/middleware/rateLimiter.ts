import rateLimit from 'express-rate-limit';
import { RateLimitError } from '../../utils/errors.js';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

/**
 * Rate limiter for API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: new RateLimitError().toJSON(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const error = new RateLimitError();
    res.status(error.statusCode).json(error.toJSON());
  },
});

/**
 * Stricter rate limiter for write operations
 */
export const writeLimiter = rateLimit({
  windowMs,
  max: Math.floor(maxRequests / 2), // Half the normal limit
  message: new RateLimitError().toJSON(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const error = new RateLimitError();
    res.status(error.statusCode).json(error.toJSON());
  },
});

/**
 * Very strict rate limiter for sensitive operations
 */
export const strictLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10,
  message: new RateLimitError().toJSON(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const error = new RateLimitError();
    res.status(error.statusCode).json(error.toJSON());
  },
});
