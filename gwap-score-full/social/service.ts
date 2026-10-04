import { query, transaction } from '../database/client.js';
import { SocialMetrics, gradeSocialReputation } from './scoring.js';
import { SocialProvider, SocialProfile, SocialContentItem } from './provider.js';
import { createOAuthState, verifyOAuthState, OAuthStateClaims } from './oauthState.js';
import { decryptSocialToken, encryptSocialToken, EncryptedToken } from './tokenCrypto.js';
import { INSTAGRAM_READ_SCOPES, SOCIAL_CONSENT_POLICY_VERSION } from './consent.js';
import { ValidationError } from '../utils/errors.js';

export interface SocialAccount {
  account_id: string;
  user_id: string;
  platform: 'instagram';
  platform_user_id: string;
  username: string;
  created_at: string;
}

export interface IngestionJob {
  job_id: string;
  status: string;
  attempts: number;
  next_retry_at?: string | null;
}

export interface SavedToken {
  access: EncryptedToken;
  refresh?: EncryptedToken;
  expiresAt?: Date;
  refreshExpiresAt?: Date;
  scopes: string[];
}

export interface SocialRepository {
  createConsent(userId: string, platform: string, scopes: string[], policyVersion: string): Promise<string>;
  revokePendingConsent(userId: string, consentId: string): Promise<void>;
  linkAccount(userId: string, consentId: string, profile: SocialProfile, token: SavedToken): Promise<SocialAccount>;
  listAccounts(userId: string): Promise<SocialAccount[]>;
  findAccount(userId: string, accountId: string): Promise<SocialAccount | null>;
  getToken(accountId: string): Promise<{
    access: EncryptedToken;
    refresh?: EncryptedToken;
    expiresAt?: Date;
    refreshExpiresAt?: Date;
  } | null>;
  updateToken(accountId: string, token: SavedToken): Promise<void>;
  disconnectAccount(userId: string, accountId: string): Promise<boolean>;
  createJob(userId: string, accountId: string, platform: string): Promise<IngestionJob>;
  updateJob(jobId: string, values: {
    status: string;
    attempts: number;
    errorMessage?: string;
    nextRetryAt?: Date;
    completedAt?: Date;
  }): Promise<void>;
  saveIngestion(
    userId: string,
    accountId: string,
    platform: string,
    profileMetrics: Record<string, number | null>,
    content: SocialContentItem[],
    score: ReturnType<typeof gradeSocialReputation>
  ): Promise<void>;
  latestScore(userId: string): Promise<Record<string, unknown> | null>;
  scoreHistory(userId: string, limit: number): Promise<Record<string, unknown>[]>;
  deleteUserSocialData(userId: string): Promise<void>;
}

interface TokenRow {
  encrypted_access_token: string;
  access_token_iv: string;
  access_token_auth_tag: string;
  encrypted_refresh_token: string | null;
  refresh_token_iv: string | null;
  refresh_token_auth_tag: string | null;
  token_expires_at: Date | null;
  refresh_expires_at: Date | null;
}

function encryptedFromRow(
  ciphertext: string | null,
  iv: string | null,
  authTag: string | null
): EncryptedToken | undefined {
  return ciphertext && iv && authTag ? { ciphertext, iv, authTag } : undefined;
}

export class DatabaseSocialRepository implements SocialRepository {
  async createConsent(userId: string, platform: string, scopes: string[], policyVersion: string): Promise<string> {
    const result = await query<{ consent_id: string }>(
      `INSERT INTO consent_records (user_id, platform, scopes, policy_version)
       VALUES ($1, $2, $3, $4) RETURNING consent_id`,
      [userId, platform, JSON.stringify(scopes), policyVersion]
    );
    return result.rows[0].consent_id;
  }

  async linkAccount(
    userId: string,
    consentId: string,
    profile: SocialProfile,
    token: SavedToken
  ): Promise<SocialAccount> {
    return transaction(async (client) => {
      const account = await client.query<SocialAccount>(
        `INSERT INTO social_accounts (user_id, platform, platform_user_id, username, consent_id)
         VALUES ($1, 'instagram', $2, $3, $4)
         RETURNING account_id, user_id, platform, platform_user_id, username, created_at`,
        [userId, profile.platformUserId, profile.username, consentId]
      );
      await client.query(
        `INSERT INTO oauth_tokens (
           account_id, encrypted_access_token, access_token_iv, access_token_auth_tag,
           encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag,
           token_expires_at, refresh_expires_at, scopes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          account.rows[0].account_id,
          token.access.ciphertext,
          token.access.iv,
          token.access.authTag,
          token.refresh?.ciphertext ?? null,
          token.refresh?.iv ?? null,
          token.refresh?.authTag ?? null,
          token.expiresAt ?? null,
          token.refreshExpiresAt ?? null,
          JSON.stringify(token.scopes),
        ]
      );
      const consent = await client.query(
        `UPDATE consent_records SET completed_at = NOW()
         WHERE consent_id = $1 AND user_id = $2 AND completed_at IS NULL AND revoked_at IS NULL`,
        [consentId, userId]
      );
      if (consent.rowCount !== 1) throw new Error('Consent is no longer valid');
      return account.rows[0];
    });
  }

  async revokePendingConsent(userId: string, consentId: string): Promise<void> {
    await query(
      `UPDATE consent_records SET revoked_at = NOW()
       WHERE consent_id = $1 AND user_id = $2 AND completed_at IS NULL AND revoked_at IS NULL`,
      [consentId, userId]
    );
  }

  async listAccounts(userId: string): Promise<SocialAccount[]> {
    const result = await query<SocialAccount>(
      `SELECT account_id, user_id, platform, platform_user_id, username, created_at
       FROM social_accounts WHERE user_id = $1 AND status = 'connected'
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async findAccount(userId: string, accountId: string): Promise<SocialAccount | null> {
    const result = await query<SocialAccount>(
      `SELECT account_id, user_id, platform, platform_user_id, username, created_at
       FROM social_accounts WHERE user_id = $1 AND account_id = $2 AND status = 'connected'`,
      [userId, accountId]
    );
    return result.rows[0] ?? null;
  }

  async getToken(accountId: string): Promise<{
    access: EncryptedToken;
    refresh?: EncryptedToken;
    expiresAt?: Date;
    refreshExpiresAt?: Date;
  } | null> {
    const result = await query<TokenRow>(
      `SELECT encrypted_access_token, access_token_iv, access_token_auth_tag,
              encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag,
              token_expires_at, refresh_expires_at
       FROM oauth_tokens WHERE account_id = $1`,
      [accountId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      access: {
        ciphertext: row.encrypted_access_token,
        iv: row.access_token_iv,
        authTag: row.access_token_auth_tag,
      },
      refresh: encryptedFromRow(
        row.encrypted_refresh_token,
        row.refresh_token_iv,
        row.refresh_token_auth_tag
      ),
      expiresAt: row.token_expires_at ?? undefined,
      refreshExpiresAt: row.refresh_expires_at ?? undefined,
    };
  }

  async updateToken(accountId: string, token: SavedToken): Promise<void> {
    await query(
      `UPDATE oauth_tokens
       SET encrypted_access_token = $2, access_token_iv = $3, access_token_auth_tag = $4,
           encrypted_refresh_token = $5, refresh_token_iv = $6, refresh_token_auth_tag = $7,
           token_expires_at = $8, refresh_expires_at = $9, updated_at = NOW()
       WHERE account_id = $1`,
      [
        accountId,
        token.access.ciphertext,
        token.access.iv,
        token.access.authTag,
        token.refresh?.ciphertext ?? null,
        token.refresh?.iv ?? null,
        token.refresh?.authTag ?? null,
        token.expiresAt ?? null,
        token.refreshExpiresAt ?? null,
      ]
    );
  }

  async disconnectAccount(userId: string, accountId: string): Promise<boolean> {
    return transaction(async (client) => {
      const result = await client.query<{ consent_id: string | null }>(
        `DELETE FROM social_accounts WHERE user_id = $1 AND account_id = $2
         RETURNING consent_id`,
        [userId, accountId]
      );
      if (result.rowCount !== 1) return false;
      if (result.rows[0].consent_id) {
        await client.query(
          'UPDATE consent_records SET revoked_at = NOW() WHERE consent_id = $1',
          [result.rows[0].consent_id]
        );
      }
      return true;
    });
  }

  async createJob(userId: string, accountId: string, platform: string): Promise<IngestionJob> {
    const result = await query<IngestionJob>(
      `INSERT INTO ingestion_jobs (user_id, account_id, platform)
       VALUES ($1, $2, $3) RETURNING job_id, status, attempts, next_retry_at`,
      [userId, accountId, platform]
    );
    return result.rows[0];
  }

  async updateJob(
    jobId: string,
    values: {
      status: string;
      attempts: number;
      errorMessage?: string;
      nextRetryAt?: Date;
      completedAt?: Date;
    }
  ): Promise<void> {
    await query(
      `UPDATE ingestion_jobs
       SET status = $2, attempts = $3, error_message = $4, next_retry_at = $5,
           started_at = CASE WHEN $2 = 'running' THEN NOW() ELSE started_at END,
           completed_at = $6, updated_at = NOW()
       WHERE job_id = $1`,
      [
        jobId,
        values.status,
        values.attempts,
        values.errorMessage ?? null,
        values.nextRetryAt ?? null,
        values.completedAt ?? null,
      ]
    );
  }

  async saveIngestion(
    userId: string,
    accountId: string,
    platform: string,
    profileMetrics: Record<string, number | null>,
    content: SocialContentItem[],
    score: ReturnType<typeof gradeSocialReputation>
  ): Promise<void> {
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO social_profile_snapshots (user_id, account_id, platform, metrics)
         VALUES ($1, $2, $3, $4)`,
        [userId, accountId, platform, JSON.stringify(profileMetrics)]
      );
      for (const item of content) {
        await client.query(
          `INSERT INTO social_content_snapshots (
             user_id, account_id, platform, platform_content_id, published_at, metrics
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            accountId,
            platform,
            item.platformContentId,
            item.publishedAt ?? null,
            JSON.stringify(item.metrics),
          ]
        );
      }
      await client.query(
        `INSERT INTO reputation_scores (user_id, account_id, platform, score, grade, subscores, explanation)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          accountId,
          platform,
          score.score,
          score.grade,
          JSON.stringify(score.subscores),
          JSON.stringify(score.explanation),
        ]
      );
    });
  }

  async latestScore(userId: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT score_id, account_id, platform, score, grade, subscores, explanation, created_at
       FROM reputation_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return result.rows[0] ?? null;
  }

  async scoreHistory(userId: string, limit: number): Promise<Record<string, unknown>[]> {
    const result = await query(
      `SELECT score_id, account_id, platform, score, grade, subscores, explanation, created_at
       FROM reputation_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  async deleteUserSocialData(userId: string): Promise<void> {
    await transaction(async (client) => {
      await client.query('DELETE FROM social_accounts WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM reputation_scores WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM consent_records WHERE user_id = $1', [userId]);
    });
  }
}

export class SocialReputationService {
  constructor(
    private readonly repository: SocialRepository,
    private readonly provider: SocialProvider,
    private readonly stateSigningKey?: string,
    private readonly tokenKey?: string
  ) {}

  async initiateConnect(
    userId: string,
    platform: string,
    scopes: string[],
    policyVersion: string
  ): Promise<{ authorizationUrl: string; consentId: string }> {
    if (platform !== this.provider.platform) throw new ValidationError('Unsupported social platform');
    if (policyVersion !== SOCIAL_CONSENT_POLICY_VERSION) throw new ValidationError('Unsupported consent policy version');
    if (!scopes.length || scopes.some((scope) => !INSTAGRAM_READ_SCOPES.includes(scope as typeof INSTAGRAM_READ_SCOPES[number]))) {
      throw new ValidationError('Requested social permissions are not supported');
    }
    const consentId = await this.repository.createConsent(userId, platform, scopes, policyVersion);
    try {
      const state = createOAuthState(
        userId,
        consentId,
        scopes,
        this.stateSigningKey ?? process.env.SOCIAL_OAUTH_STATE_SECRET ?? ''
      );
      return {
        authorizationUrl: this.provider.authorizationUrl(state, scopes),
        consentId,
      };
    } catch (error) {
      await this.repository.revokePendingConsent(userId, consentId);
      throw error;
    }
  }

  async completeOAuth(code: string, state: string): Promise<SocialAccount> {
    let claims: OAuthStateClaims;
    try {
      claims = verifyOAuthState(
        state,
        this.stateSigningKey ?? process.env.SOCIAL_OAUTH_STATE_SECRET ?? ''
      );
    } catch {
      throw new ValidationError('Invalid or expired OAuth state');
    }
    const accessToken = await this.provider.exchangeCode(code);
    const profile = await this.provider.fetchProfile(accessToken.accessToken);
    return this.repository.linkAccount(claims.userId, claims.consentId, profile, {
      access: encryptSocialToken(accessToken.accessToken, this.tokenKey),
      refresh: accessToken.refreshToken
        ? encryptSocialToken(accessToken.refreshToken, this.tokenKey)
        : undefined,
      expiresAt: accessToken.expiresAt,
      scopes: claims.scopes,
    });
  }

  async cancelOAuth(state: string): Promise<void> {
    let claims: OAuthStateClaims;
    try {
      claims = verifyOAuthState(
        state,
        this.stateSigningKey ?? process.env.SOCIAL_OAUTH_STATE_SECRET ?? ''
      );
    } catch {
      throw new ValidationError('Invalid or expired OAuth state');
    }
    await this.repository.revokePendingConsent(claims.userId, claims.consentId);
  }

  listAccounts(userId: string): Promise<SocialAccount[]> {
    return this.repository.listAccounts(userId);
  }

  async disconnect(userId: string, accountId: string): Promise<boolean> {
    return this.repository.disconnectAccount(userId, accountId);
  }

  async ingest(userId: string, accountId: string): Promise<IngestionJob> {
    const account = await this.repository.findAccount(userId, accountId);
    if (!account) throw new ValidationError('Social account not found');
    const job = await this.repository.createJob(userId, accountId, account.platform);
    const attempts = job.attempts + 1;
    await this.repository.updateJob(job.job_id, { status: 'running', attempts });

    try {
      const storedToken = await this.repository.getToken(accountId);
      if (!storedToken) throw new Error('OAuth token is unavailable');
      let token = decryptSocialToken(storedToken.access, this.tokenKey);
      let expiresAt = storedToken.expiresAt;
      if (expiresAt && expiresAt.getTime() <= Date.now() + 5 * 60 * 1000) {
        const refreshToken = storedToken.refresh
          ? decryptSocialToken(storedToken.refresh, this.tokenKey)
          : token;
        const refreshed = await this.provider.refreshToken(refreshToken);
        token = refreshed.accessToken;
        expiresAt = refreshed.expiresAt;
        await this.repository.updateToken(accountId, {
          access: encryptSocialToken(token, this.tokenKey),
          refresh: refreshed.refreshToken
            ? encryptSocialToken(refreshed.refreshToken, this.tokenKey)
            : storedToken.refresh,
          expiresAt,
          refreshExpiresAt: storedToken.refreshExpiresAt,
          scopes: [],
        });
      }

      const [profile, content] = await Promise.all([
        this.provider.fetchProfile(token),
        this.provider.fetchContent(token),
      ]);
      const dates = content
        .map((item) => item.publishedAt)
        .filter((value): value is Date => value !== undefined && Number.isFinite(value.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());
      const now = new Date();
      const recentPosts = dates.filter((date) => date.getTime() >= now.getTime() - 30 * 86400000);
      const followers = profile.followersCount;
      const engagementRate = followers && content.length
        ? content.reduce((sum, item) => sum + (item.metrics.likes ?? 0) + (item.metrics.comments ?? 0), 0)
          / content.length / followers
        : undefined;
      const longestInactivityDays = dates[0]
        ? Math.max(0, (now.getTime() - dates[0].getTime()) / 86400000)
        : undefined;
      const scoringMetrics: SocialMetrics = {
        engagementRate,
        postsLast30Days: recentPosts.length,
        longestInactivityDays,
      };
      const score = gradeSocialReputation(scoringMetrics);
      await this.repository.saveIngestion(
        userId,
        accountId,
        account.platform,
        {
          followers_count: profile.followersCount ?? null,
          following_count: profile.followingCount ?? null,
          media_count: profile.mediaCount ?? null,
          posts_last_30_days: recentPosts.length,
          average_engagement_rate: engagementRate ?? null,
        },
        content,
        score
      );
      await this.repository.updateJob(job.job_id, {
        status: 'succeeded',
        attempts,
        completedAt: new Date(),
      });
      return { ...job, status: 'succeeded', attempts };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Social ingestion failed';
      const nextRetryAt = attempts < 3
        ? new Date(Date.now() + 60_000 * (2 ** (attempts - 1)))
        : undefined;
      await this.repository.updateJob(job.job_id, {
        status: 'failed',
        attempts,
        errorMessage: errorMessage.slice(0, 500),
        nextRetryAt,
        completedAt: new Date(),
      });
      return { ...job, status: 'failed', attempts, next_retry_at: nextRetryAt?.toISOString() ?? null };
    }
  }

  latestScore(userId: string): Promise<Record<string, unknown> | null> {
    return this.repository.latestScore(userId);
  }

  scoreHistory(userId: string, limit: number): Promise<Record<string, unknown>[]> {
    return this.repository.scoreHistory(userId, limit);
  }

  deleteUserSocialData(userId: string): Promise<void> {
    return this.repository.deleteUserSocialData(userId);
  }
}

export const socialRepository = new DatabaseSocialRepository();
