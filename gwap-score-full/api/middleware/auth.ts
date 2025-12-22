import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../../database/client.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  apiKey?: {
    key_id: string;
    name: string;
    permissions: string[];
  };
}

/**
 * Middleware to authenticate API key
 */
export async function authenticateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!apiKey) {
      throw new UnauthorizedError('API key is required');
    }

    // Hash the provided API key
    const keyHash = await bcrypt.hash(apiKey, 10);

    // Look up the API key in the database
    const result = await query<{
      key_id: string;
      name: string;
      permissions: string[];
      expires_at: string | null;
      is_active: boolean;
    }>(
      `SELECT key_id, name, permissions, expires_at, is_active
       FROM api_keys
       WHERE key_hash = $1`,
      [keyHash]
    );

    if (result.rowCount === 0) {
      throw new UnauthorizedError('Invalid API key');
    }

    const keyData = result.rows[0];

    // Check if key is active
    if (!keyData.is_active) {
      throw new UnauthorizedError('API key is inactive');
    }

    // Check if key has expired
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      throw new UnauthorizedError('API key has expired');
    }

    // Update last used timestamp
    await query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE key_id = $1',
      [keyData.key_id]
    );

    // Attach API key info to request
    req.apiKey = {
      key_id: keyData.key_id,
      name: keyData.name,
      permissions: keyData.permissions,
    };

    logger.debug('API key authenticated', {
      key_id: keyData.key_id,
      name: keyData.name,
    });

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(error.statusCode).json(error.toJSON());
    } else {
      logger.error('Authentication error', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication failed',
        },
      });
    }
  }
}

/**
 * Middleware to check if API key has required permission
 */
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.apiKey) {
        throw new UnauthorizedError('Not authenticated');
      }

      if (!req.apiKey.permissions.includes(permission) && !req.apiKey.permissions.includes('*')) {
        throw new ForbiddenError(`Missing required permission: ${permission}`);
      }

      next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        res.status(error.statusCode).json(error.toJSON());
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Permission check failed',
          },
        });
      }
    }
  };
}

/**
 * Middleware for public endpoints (no auth required)
 * Logs the request for monitoring
 */
export function publicEndpoint(req: Request, res: Response, next: NextFunction): void {
  logger.debug('Public endpoint accessed', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });
  next();
}
