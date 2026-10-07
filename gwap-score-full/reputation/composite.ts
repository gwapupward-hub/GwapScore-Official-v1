export const GWAPSCORE_V2_MODEL_VERSION = '2.0.0-alpha.1' as const;

export const GWAPSCORE_V2_DIMENSION_WEIGHTS = {
  social: 45,
  wallet: 30,
  identityProof: 15,
  ecosystem: 10,
} as const;

export type ReputationDimension = keyof typeof GWAPSCORE_V2_DIMENSION_WEIGHTS;
export type GwapScoreV2Status = 'unscored' | 'provisional' | 'scored';
export type GwapScoreV2Tier = 'High Risk' | 'Developing' | 'Established' | 'Strong' | 'Elite';

export type ObservedDimension = {
  state: 'observed';
  score: number;
  confidence: number;
  provenance?: string[];
  explanation?: string;
};

export type UnavailableDimension = {
  state: 'unavailable';
  reason: string;
};

export type ReputationDimensionInput = ObservedDimension | UnavailableDimension;

export type GwapScoreV2Input = Record<ReputationDimension, ReputationDimensionInput>;

export type GwapScoreV2DimensionResult = {
  state: ReputationDimensionInput['state'];
  baseWeight: number;
  score: number | null;
  confidence: number | null;
  effectiveWeight: number;
  normalizedEffectiveWeight: number;
  provenance: string[];
  explanation: string | null;
  unavailableReason: string | null;
};

export type GwapScoreV2Result = {
  modelVersion: typeof GWAPSCORE_V2_MODEL_VERSION;
  status: GwapScoreV2Status;
  score: number | null;
  tier: GwapScoreV2Tier | null;
  composite100: number | null;
  coverage: number;
  confidence: number;
  dimensions: Record<ReputationDimension, GwapScoreV2DimensionResult>;
  unavailableEvidence: Array<{ dimension: ReputationDimension; reason: string }>;
};

const DIMENSIONS = Object.keys(GWAPSCORE_V2_DIMENSION_WEIGHTS) as ReputationDimension[];
const PRODUCTION_COVERAGE_THRESHOLD = 60;
const MIN_OBSERVED_DIMENSIONS = 2;

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function assertObservedDimension(dimension: ReputationDimension, input: ObservedDimension): void {
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
    throw new RangeError(`${dimension} score must be a finite number between 0 and 100.`);
  }

  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new RangeError(`${dimension} confidence must be a finite number between 0 and 1.`);
  }
}

export function mapGwapScoreV2Tier(score: number): GwapScoreV2Tier {
  if (!Number.isInteger(score) || score < 300 || score > 900) {
    throw new RangeError('GwapScore must be an integer between 300 and 900.');
  }

  if (score >= 800) return 'Elite';
  if (score >= 700) return 'Strong';
  if (score >= 600) return 'Established';
  if (score >= 500) return 'Developing';
  return 'High Risk';
}

/**
 * Deterministic v2 composite reputation calculation.
 *
 * Missing dimensions are excluded rather than imputed as 0 or 50. Coverage and
 * confidence communicate how much evidence supports the result. A one-source
 * result may be shown provisionally, but it is not treated as a fully scored
 * multidimensional reputation profile.
 */
export function deriveCompositeGwapScoreV2(input: GwapScoreV2Input): GwapScoreV2Result {
  let observedBaseWeight = 0;
  let weightedConfidence = 0;
  let effectiveWeightTotal = 0;
  let weightedScoreTotal = 0;
  let observedCount = 0;

  const dimensions = {} as Record<ReputationDimension, GwapScoreV2DimensionResult>;
  const unavailableEvidence: Array<{ dimension: ReputationDimension; reason: string }> = [];

  for (const dimension of DIMENSIONS) {
    const dimensionInput = input[dimension];
    const baseWeight = GWAPSCORE_V2_DIMENSION_WEIGHTS[dimension];

    if (dimensionInput.state === 'unavailable') {
      unavailableEvidence.push({ dimension, reason: dimensionInput.reason });
      dimensions[dimension] = {
        state: 'unavailable',
        baseWeight,
        score: null,
        confidence: null,
        effectiveWeight: 0,
        normalizedEffectiveWeight: 0,
        provenance: [],
        explanation: null,
        unavailableReason: dimensionInput.reason,
      };
      continue;
    }

    assertObservedDimension(dimension, dimensionInput);

    const effectiveWeight = baseWeight * dimensionInput.confidence;
    observedBaseWeight += baseWeight;
    weightedConfidence += baseWeight * dimensionInput.confidence;
    effectiveWeightTotal += effectiveWeight;
    weightedScoreTotal += dimensionInput.score * effectiveWeight;
    observedCount += 1;

    dimensions[dimension] = {
      state: 'observed',
      baseWeight,
      score: dimensionInput.score,
      confidence: dimensionInput.confidence,
      effectiveWeight: round(effectiveWeight),
      normalizedEffectiveWeight: 0,
      provenance: [...(dimensionInput.provenance ?? [])],
      explanation: dimensionInput.explanation ?? null,
      unavailableReason: null,
    };
  }

  const coverage = round(observedBaseWeight);
  const confidence = observedBaseWeight === 0
    ? 0
    : round((weightedConfidence / observedBaseWeight) * 100);

  if (observedCount === 0 || effectiveWeightTotal === 0) {
    return {
      modelVersion: GWAPSCORE_V2_MODEL_VERSION,
      status: 'unscored',
      score: null,
      tier: null,
      composite100: null,
      coverage,
      confidence,
      dimensions,
      unavailableEvidence,
    };
  }

  for (const dimension of DIMENSIONS) {
    const result = dimensions[dimension];
    if (result.state === 'observed') {
      result.normalizedEffectiveWeight = round((result.effectiveWeight / effectiveWeightTotal) * 100);
    }
  }

  const composite100 = round(weightedScoreTotal / effectiveWeightTotal);
  const score = Math.round(300 + composite100 * 6);
  const status: GwapScoreV2Status =
    observedCount >= MIN_OBSERVED_DIMENSIONS && coverage >= PRODUCTION_COVERAGE_THRESHOLD
      ? 'scored'
      : 'provisional';

  return {
    modelVersion: GWAPSCORE_V2_MODEL_VERSION,
    status,
    score,
    tier: mapGwapScoreV2Tier(score),
    composite100,
    coverage,
    confidence,
    dimensions,
    unavailableEvidence,
  };
}
