import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export function initializeDatabase(config: DatabaseConfig): pg.Pool {
  if (pool) {
    logger.warn('Database pool already initialized');
    return pool;
  }

  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.max || 20,
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected database error', { error: err });
  });

  pool.on('connect', () => {
    logger.info('New database connection established');
  });

  logger.info('Database pool initialized', {
    host: config.host,
    database: config.database,
    maxConnections: config.max || 20,
  });

  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const client = getPool();
  const start = Date.now();

  try {
    const result = await client.query<T>(text, params);
    const duration = Date.now() - start;

    logger.debug('Database query executed', {
      query: text,
      duration,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    logger.error('Database query error', {
      query: text,
      code: error instanceof Error && 'code' in error ? error.code : undefined,
    });
    throw error;
  }
}

export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', {
      code: error instanceof Error && 'code' in error ? error.code : undefined,
    });
    throw error;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}
