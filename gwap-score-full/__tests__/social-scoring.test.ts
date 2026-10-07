import { gradeSocialReputation, SOCIAL_SCORE_WEIGHTS } from '../social/scoring.js';

describe('social reputation scoring', () => {
  test('returns unscored when no metrics are available', () => {
    const result = gradeSocialReputation({});

    expect(Object.values(SOCIAL_SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
    expect(result.status).toBe('unscored');
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.subscores).toEqual({});
    expect(result.coverage).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.explanation.factors.every((factor) => factor.state === 'unavailable')).toBe(true);
  });

  test('bounds metric values and scores at the minimum and maximum', () => {
    const high = gradeSocialReputation({
      suspiciousGrowthRate: -5,
      engagementAnomalyRate: 0,
      engagementRate: 1,
      meaningfulCommentRate: 100,
      brandSafeContentRate: 100,
      postsLast30Days: 100,
      longestInactivityDays: 0,
      repeatAudienceRate: 100,
      positiveAudienceFeedbackRate: 100,
    });
    const low = gradeSocialReputation({
      suspiciousGrowthRate: 100,
      engagementAnomalyRate: 100,
      engagementRate: 0,
      meaningfulCommentRate: 0,
      brandSafeContentRate: 0,
      postsLast30Days: 0,
      longestInactivityDays: 100,
      repeatAudienceRate: 0,
      positiveAudienceFeedbackRate: 0,
    });

    expect(high.score).toBe(100);
    expect(high.grade).toBe('A');
    expect(high.coverage).toBe(100);
    expect(low.score).toBe(0);
    expect(low.grade).toBe('F');
    expect(low.coverage).toBe(100);
  });

  test('returns weighted factor contributions and explanatory drivers', () => {
    const result = gradeSocialReputation({
      suspiciousGrowthRate: 0,
      engagementAnomalyRate: 0,
      engagementRate: 0.06,
      meaningfulCommentRate: 100,
      brandSafeContentRate: 100,
      postsLast30Days: 12,
      longestInactivityDays: 0,
      repeatAudienceRate: 100,
      positiveAudienceFeedbackRate: 100,
    });

    expect(result.status).toBe('scored');
    expect(result.score).toBe(100);
    expect(result.explanation.factors.map(({ weight }) => weight)).toEqual([25, 25, 20, 15, 15]);
    expect(result.explanation.top_positive_drivers).toContain('Authenticity (100/100)');
    expect(result.explanation.rationale).toMatch(/observed evidence only/);
  });

  test('excludes missing and non-finite metrics instead of inventing neutral values', () => {
    const result = gradeSocialReputation({
      brandSafeContentRate: Number.NaN,
      postsLast30Days: Number.POSITIVE_INFINITY,
      engagementRate: 0.06,
    });

    expect(result.status).toBe('provisional');
    expect(result.score).toBe(100);
    expect(result.subscores.engagementQuality).toBe(100);
    expect(result.subscores.contentSafety).toBeUndefined();
    expect(result.subscores.consistency).toBeUndefined();
    expect(result.coverage).toBe(12.5);
  });

  test('uses partial category evidence with reduced confidence rather than a neutral filler', () => {
    const result = gradeSocialReputation({
      suspiciousGrowthRate: 0,
    });

    expect(result.score).toBe(100);
    expect(result.subscores.authenticity).toBe(100);
    expect(result.coverage).toBe(12.5);
    expect(result.explanation.factors[0].confidence).toBe(0.5);
    expect(result.explanation.factors[0].normalizedWeight).toBe(100);
  });
});
