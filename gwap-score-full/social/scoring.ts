export const SOCIAL_SCORE_WEIGHTS = {
  authenticity: 25,
  engagementQuality: 25,
  contentSafety: 20,
  consistency: 15,
  audienceTrust: 15,
} as const;

export type SocialScoreCategory = keyof typeof SOCIAL_SCORE_WEIGHTS;
export type SocialScoreStatus = 'unscored' | 'provisional' | 'scored';

const FACTOR_LABELS: Record<SocialScoreCategory, string> = {
  authenticity: 'Authenticity',
  engagementQuality: 'Engagement Quality',
  contentSafety: 'Content Safety & Brand Risk',
  consistency: 'Consistency & Recency',
  audienceTrust: 'Audience Trust Signals',
};

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
  state: 'observed' | 'unavailable';
  score: number | null;
  weight: number;
  confidence: number;
  effectiveWeight: number;
  normalizedWeight: number;
  contribution: number;
  explanation: string;
}

export interface SocialReputationScore {
  status: SocialScoreStatus;
  score: number | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  coverage: number;
  confidence: number;
  subscores: Partial<Record<SocialScoreCategory, number>>;
  explanation: {
    factors: SocialScoreFactor[];
    top_positive_drivers: string[];
    top_negative_drivers: string[];
    unavailable_factors: string[];
    rationale: string;
  };
}

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

const round = (value: number, digits = 2): number => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const boundedRate = (value: number | undefined): number | undefined =>
  value === undefined || !Number.isFinite(value) ? undefined : clamp(value);

const scoreForRate = (value: number | undefined, expected: number): number | undefined => {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return clamp((value / expected) * 100);
};

function observedAverage(values: Array<number | undefined>): {
  score?: number;
  confidence: number;
} {
  const observed = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (observed.length === 0) return { confidence: 0 };

  return {
    score: observed.reduce((sum, value) => sum + value, 0) / observed.length,
    confidence: observed.length / values.length,
  };
}

function gradeForScore(score: number): SocialReputationScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Derive social reputation strictly from observed evidence.
 *
 * Missing/non-finite metrics are excluded rather than converted to an invented
 * neutral value. The score is renormalized across observed evidence while
 * coverage/confidence report how much of the social model was actually seen.
 */
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

  const categoryEvidence: Record<SocialScoreCategory, Array<number | undefined>> = {
    authenticity: [
      suspiciousGrowth === undefined ? undefined : 100 - suspiciousGrowth,
      engagementAnomaly === undefined ? undefined : 100 - engagementAnomaly,
    ],
    engagementQuality: [engagementRate, meaningfulComments],
    contentSafety: [brandSafety],
    consistency: [postingConsistency, inactivity],
    audienceTrust: [repeatAudience, positiveFeedback],
  };

  const rawFactors = (Object.keys(SOCIAL_SCORE_WEIGHTS) as SocialScoreCategory[]).map((category) => {
    const observed = observedAverage(categoryEvidence[category]);
    const weight = SOCIAL_SCORE_WEIGHTS[category];
    const effectiveWeight = weight * observed.confidence;
    return {
      category,
      weight,
      score: observed.score === undefined ? null : round(observed.score),
      confidence: round(observed.confidence, 4),
      effectiveWeight,
    };
  });

  const effectiveWeightTotal = rawFactors.reduce((sum, factor) => sum + factor.effectiveWeight, 0);
  const coverage = round(effectiveWeightTotal);
  const confidence = round(coverage / 100, 4);

  const factors: SocialScoreFactor[] = rawFactors.map((factor) => {
    if (factor.score === null || factor.effectiveWeight === 0 || effectiveWeightTotal === 0) {
      return {
        category: factor.category,
        state: 'unavailable',
        score: null,
        weight: factor.weight,
        confidence: 0,
        effectiveWeight: 0,
        normalizedWeight: 0,
        contribution: 0,
        explanation: `${FACTOR_LABELS[factor.category]} is unavailable because no usable metrics were observed.`,
      };
    }

    const normalizedWeight = (factor.effectiveWeight / effectiveWeightTotal) * 100;
    const contribution = (factor.score * normalizedWeight) / 100;
    return {
      category: factor.category,
      state: 'observed',
      score: factor.score,
      weight: factor.weight,
      confidence: factor.confidence,
      effectiveWeight: round(factor.effectiveWeight),
      normalizedWeight: round(normalizedWeight),
      contribution: round(contribution),
      explanation: `${FACTOR_LABELS[factor.category]} is ${factor.score}/100 with ${Math.round(factor.confidence * 100)}% factor evidence coverage.`,
    };
  });

  const observedFactors = factors.filter((factor) => factor.state === 'observed' && factor.score !== null);
  if (observedFactors.length === 0) {
    return {
      status: 'unscored',
      score: null,
      grade: null,
      coverage: 0,
      confidence: 0,
      subscores: {},
      explanation: {
        factors,
        top_positive_drivers: [],
        top_negative_drivers: [],
        unavailable_factors: factors.map((factor) => FACTOR_LABELS[factor.category]),
        rationale: 'No usable social reputation evidence is available. Missing metrics are excluded rather than scored as zero or neutral.',
      },
    };
  }

  const score = Math.round(observedFactors.reduce((sum, factor) => sum + factor.contribution, 0));
  const grade = gradeForScore(score);
  const subscores: Partial<Record<SocialScoreCategory, number>> = {};
  for (const factor of observedFactors) {
    if (factor.score !== null) subscores[factor.category] = factor.score;
  }

  const rankedFactors = [...observedFactors].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const topPositiveDrivers = rankedFactors
    .filter((factor) => (factor.score ?? 0) > 50)
    .slice(0, 3)
    .map((factor) => `${FACTOR_LABELS[factor.category]} (${factor.score}/100)`);
  const topNegativeDrivers = [...rankedFactors]
    .reverse()
    .filter((factor) => (factor.score ?? 100) < 50)
    .slice(0, 3)
    .map((factor) => `${FACTOR_LABELS[factor.category]} (${factor.score}/100)`);
  const status: SocialScoreStatus = coverage >= 60 && observedFactors.length >= 2 ? 'scored' : 'provisional';

  return {
    status,
    score,
    grade,
    coverage,
    confidence,
    subscores,
    explanation: {
      factors,
      top_positive_drivers: topPositiveDrivers,
      top_negative_drivers: topNegativeDrivers,
      unavailable_factors: factors
        .filter((factor) => factor.state === 'unavailable')
        .map((factor) => FACTOR_LABELS[factor.category]),
      rationale: `Social reputation is ${score}/100 (grade ${grade}) using observed evidence only. Evidence coverage is ${coverage}%; unavailable metrics are excluded from scoring.`,
    },
  };
}
