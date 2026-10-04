import { INSTAGRAM_READ_SCOPES } from './consent.js';
import { URL, URLSearchParams } from 'node:url';

export interface SocialAccessToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface SocialProfile {
  platformUserId: string;
  username: string;
  followersCount?: number;
  followingCount?: number;
  mediaCount?: number;
}

export interface SocialContentItem {
  platformContentId: string;
  publishedAt?: Date;
  metrics: {
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    reach?: number;
  };
}

export interface SocialProvider {
  readonly platform: 'instagram';
  authorizationUrl(state: string, scopes: string[]): string;
  exchangeCode(code: string): Promise<SocialAccessToken>;
  refreshToken(token: string): Promise<SocialAccessToken>;
  fetchProfile(token: string): Promise<SocialProfile>;
  fetchContent(token: string): Promise<SocialContentItem[]>;
}

interface InstagramTokenResponse {
  access_token?: string;
  user_id?: string | number;
  expires_in?: number;
  error_message?: string;
}

interface InstagramProfileResponse {
  user_id?: string | number;
  id?: string | number;
  username?: string;
  media_count?: number;
}

interface InstagramInsightsResponse {
  data?: Array<{
    name?: string;
    values?: Array<{ value?: number }>;
    total_value?: { value?: number };
  }>;
}

interface InstagramMediaResponse {
  data?: Array<{
    id: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
  }>;
}

async function parseJson<T>(response: Awaited<ReturnType<typeof globalThis.fetch>>): Promise<T> {
  if (!response.ok) throw new Error(`Instagram API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export class InstagramProvider implements SocialProvider {
  readonly platform = 'instagram' as const;
  private get clientId(): string | undefined {
    return process.env.INSTAGRAM_CLIENT_ID;
  }

  private get clientSecret(): string | undefined {
    return process.env.INSTAGRAM_CLIENT_SECRET;
  }

  private get redirectUri(): string | undefined {
    return process.env.INSTAGRAM_REDIRECT_URI;
  }

  authorizationUrl(state: string, scopes: string[]): string {
    if (!this.clientId || !this.redirectUri) {
      throw new Error('Instagram OAuth is not configured');
    }
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(','),
      state,
    }).toString();
    return url.toString();
  }

  async exchangeCode(code: string): Promise<SocialAccessToken> {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Instagram OAuth is not configured');
    }
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code,
    });
    const response = await globalThis.fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const token = await parseJson<InstagramTokenResponse>(response);
    if (!token.access_token || !token.user_id) throw new Error(token.error_message || 'Instagram token response was incomplete');
    const longLivedUrl = new URL('https://graph.instagram.com/access_token');
    longLivedUrl.search = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.clientSecret,
      access_token: token.access_token,
    }).toString();
    const longLived = await parseJson<InstagramTokenResponse>(await globalThis.fetch(longLivedUrl));
    if (!longLived.access_token) throw new Error('Instagram did not return a long-lived token');

    return {
      accessToken: longLived.access_token,
      expiresAt: longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000)
        : undefined,
    };
  }

  async refreshToken(token: string): Promise<SocialAccessToken> {
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.search = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: token,
    }).toString();
    const response = await globalThis.fetch(url);
    const refreshed = await parseJson<{ access_token?: string; expires_in?: number }>(response);
    if (!refreshed.access_token) throw new Error('Instagram did not return a refreshed token');
    return {
      accessToken: refreshed.access_token,
      expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : undefined,
    };
  }

  async fetchProfile(token: string): Promise<SocialProfile> {
    const url = new URL('https://graph.instagram.com/me');
    url.search = new URLSearchParams({
      fields: 'user_id,username,account_type,media_count',
      access_token: token,
    }).toString();
    const profile = await parseJson<InstagramProfileResponse>(await globalThis.fetch(url));
    const id = profile.user_id ?? profile.id;
    if (id === undefined || !profile.username) throw new Error('Instagram profile response was incomplete');
    let followersCount: number | undefined;
    try {
      const insightsUrl = new URL('https://graph.instagram.com/me/insights');
      insightsUrl.search = new URLSearchParams({
        metric: 'follower_count',
        period: 'day',
        access_token: token,
      }).toString();
      const insights = await parseJson<InstagramInsightsResponse>(await globalThis.fetch(insightsUrl));
      const followerValue = insights.data?.find((item) => item.name === 'follower_count');
      const value = followerValue?.total_value?.value ?? followerValue?.values?.at(-1)?.value;
      if (typeof value === 'number' && Number.isFinite(value)) followersCount = value;
    } catch {
      followersCount = undefined;
    }
    return {
      platformUserId: String(id),
      username: profile.username,
      followersCount,
      mediaCount: profile.media_count,
    };
  }

  async fetchContent(token: string): Promise<SocialContentItem[]> {
    const url = new URL('https://graph.instagram.com/me/media');
    url.search = new URLSearchParams({
      fields: 'id,timestamp,like_count,comments_count',
      limit: '50',
      access_token: token,
    }).toString();
    const media = await parseJson<InstagramMediaResponse>(await globalThis.fetch(url));
    return (media.data ?? []).map((item) => ({
      platformContentId: item.id,
      publishedAt: item.timestamp ? new Date(item.timestamp) : undefined,
      metrics: {
        likes: item.like_count,
        comments: item.comments_count,
      },
    }));
  }
}

export const instagramProvider = new InstagramProvider();
export const defaultInstagramScopes = [...INSTAGRAM_READ_SCOPES];
