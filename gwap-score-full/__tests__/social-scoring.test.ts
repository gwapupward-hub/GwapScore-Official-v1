import { gradeSocialReputation, SOCIAL_SCORE_WEIGHTS } from '../social/scoring.js';

describe('social reputation scoring', () => {
  test('applies all five weights and neutral values when no metrics are available', () => {
    const result = gradeSocialReputation({});

    expect(Object.values(SOCIAL_SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
    expect(result.score).toBe(50);
    expect(result.grade).toBe('F');
    expect(Object.values(result.subscores)).toEqual([50, 50, 50, 50, 50]);
    expect(result.explanation.factors.reduce((sum, factor) => sum + factor.contribution, 0)).toBe(50);
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
    expect(low.score).toBe(0);
    expect(low.grade).toBe('F');
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

    expect(result.score).toBe(100);
    expect(result.explanation.factors.map(({ weight }) => weight)).toEqual([25, 25, 20, 15, 15]);
    expect(result.explanation.top_positive_drivers).toContain('authenticity (100/100)');
    expect(result.explanation.rationale).toMatch(/five weighted social-content and audience factors/);
  });

  test('treats missing data neutrally and ignores non-finite values', () => {
    const result = gradeSocialReputation({
      brandSafeContentRate: Number.NaN,
      postsLast30Days: Number.POSITIVE_INFINITY,
    });

    expect(result.subscores.contentSafety).toBe(50);
    expect(result.subscores.consistency).toBe(50);
  });
});
