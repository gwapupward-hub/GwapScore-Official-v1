export const SOCIAL_SCORE_WEIGHTS = {
  authenticity: 25,
  engagementQuality: 25,
  contentSafety: 20,
  consistency: 15,
  audienceTrust: 15,
} as const;

export type SocialScoreCategory = keyof typeof SOCIAL_SCORE_WEIGHTS;

export interface SocialMetrics {
  suspiciousGrowthRate?: number;
  engagementAnomalyRate?: number;
  engagementRate?: number;
  meaningfulCommentRate?: number;
  brandSafeContentRate?: number;
  postsLast30Days?: number;
  longestInactivityDays?: number;
  repeatAudienceRate?: number;
  positiveAudienceFeedbackRate?: number;
}

export interface SocialScoreFactor {
  category: SocialScoreCategory;
  score: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface SocialReputationScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  subscores: Record<SocialScoreCategory, number>;
  explanation: {
    factors: SocialScoreFactor[];
    top_positive_drivers: string[];
    top_negative_drivers: string[];
    rationale: string;
  };
}

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

const boundedRate = (value: number | undefined): number | undefined =>
  value === undefined || !Number.isFinite(value) ? undefined : clamp(value);

const neutralIfMissing = (values: Array<number | undefined>): number =>
  values.length === 0 ? 50 : values.reduce<number>((sum, value) => sum + (value ?? 50), 0) / values.length;

const scoreForRate = (value: number | undefined, expected: number): number | undefined => {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return clamp((value / expected) * 100);
};

export function gradeSocialReputation(metrics: SocialMetrics): SocialReputationScore {
  const suspiciousGrowth = boundedRate(metrics.suspiciousGrowthRate);
  const engagementAnomaly = boundedRate(metrics.engagementAnomalyRate);
  const engagementRate = scoreForRate(metrics.engagementRate, 0.06);
  const meaningfulComments = boundedRate(metrics.meaningfulCommentRate);
  const brandSafety = boundedRate(metrics.brandSafeContentRate);
  const postingConsistency = metrics.postsLast30Days === undefined
    || !Number.isFinite(metrics.postsLast30Days)
    ? undefined
    : clamp((metrics.postsLast30Days / 12) * 100);
  const inactivity = metrics.longestInactivityDays === undefined
    || !Number.isFinite(metrics.longestInactivityDays)
    ? undefined
    : clamp(100 - metrics.longestInactivityDays * 2);
  const repeatAudience = boundedRate(metrics.repeatAudienceRate);
  const positiveFeedback = boundedRate(metrics.positiveAudienceFeedbackRate);

  const subscores: Record<SocialScoreCategory, number> = {
    authenticity: Math.round(neutralIfMissing([
      suspiciousGrowth === undefined ? undefined : 100 - suspiciousGrowth,
      engagementAnomaly === undefined ? undefined : 100 - engagementAnomaly,
    ])),
    engagementQuality: Math.round(neutralIfMissing([engagementRate, meaningfulComments])),
    contentSafety: Math.round(neutralIfMissing([brandSafety])),
    consistency: Math.round(neutralIfMissing([postingConsistency, inactivity])),
    audienceTrust: Math.round(neutralIfMissing([repeatAudience, positiveFeedback])),
  };

  const factors: SocialScoreFactor[] = (Object.keys(SOCIAL_SCORE_WEIGHTS) as SocialScoreCategory[])
    .map((category) => ({
      category,
      score: subscores[category],
      weight: SOCIAL_SCORE_WEIGHTS[category],
      contribution: Number(((subscores[category] * SOCIAL_SCORE_WEIGHTS[category]) / 100).toFixed(2)),
      explanation: `${category} contributes ${subscores[category]}% of its ${SOCIAL_SCORE_WEIGHTS[category]}% weight.`,
    }));

  const score = Math.round(factors.reduce((total, factor) => total + factor.contribution, 0));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  const rankedFactors = [...factors].sort((a, b) => b.score - a.score);
  const topPositiveDrivers = rankedFactors
    .filter((factor) => factor.score > 50)
    .slice(0, 3)
    .map((factor) => `${factor.category} (${factor.score}/100)`);
  const topNegativeDrivers = [...rankedFactors]
    .reverse()
    .filter((factor) => factor.score < 50)
    .slice(0, 3)
    .map((factor) => `${factor.category} (${factor.score}/100)`);

  return {
    score,
    grade,
    subscores,
    explanation: {
      factors,
      top_positive_drivers: topPositiveDrivers,
      top_negative_drivers: topNegativeDrivers,
      rationale: `Social reputation is ${score}/100 (grade ${grade}), based on five weighted social-content and audience factors. Missing metrics are treated as neutral.`,
    },
  };
}
