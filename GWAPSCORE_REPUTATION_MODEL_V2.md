# GwapScore Reputation Model v2

**Status:** IMPLEMENTATION PILOT  
**Model family:** GwapScore v2  
**Candidate model version:** `2.0.0-alpha.1`  
**Public score range:** 300–900  
**Authority:** Founder decision `GWAP-REPUTATION-001` + GWAP MASTER

## Product definition

GwapScore is GWAP's **social-reputation-first, multidimensional reputation system**.

It combines independently explainable reputation dimensions into one portable 300–900 score while preserving the dimensions, evidence coverage, confidence, provenance, and explanations behind the headline number.

The v2 model is not a credit score, lending score, wealth score, or portfolio-risk score.

## Core principle

A strong wallet may improve an otherwise weak social-reputation result when the wallet is verified and the wallet evidence is reputation-eligible.

It must not erase the weak social dimension.

Example user-facing result:

```text
GwapScore        722 / 900 — Strong

Social           42 / 100 — Weak
Wallet           93 / 100 — Excellent
Identity / Proof 88 / 100 — Strong
GWAP Ecosystem   Unavailable

Coverage         90%
Confidence       85%
Model            2.0.0-alpha.1
```

The number is a summary. The dimensional reputation profile is the product truth.

## Dimensions

### 1. Social Reputation

Candidate base weight: **45%**

Eligible evidence includes:

- verified proof-of-control of a supported social account;
- account authenticity indicators;
- longitudinal account history;
- engagement quality;
- consistency and recency;
- audience trust signals;
- manipulation/anomaly indicators;
- approved public reputation events.

Social remains the primary product surface.

### 2. Wallet Reputation

Candidate base weight: **30%**

Wallet Reputation consumes **reputation-eligible Wallet Intelligence evidence**, not portfolio risk.

Eligible candidate evidence includes:

- cryptographically verified wallet control;
- wallet longevity;
- transaction-history depth;
- sustained rather than burst-only activity;
- protocol participation history;
- behavioral continuity;
- successful verified on-chain interactions;
- approved PPV/GWAP facts when routed to the appropriate dimension;
- other deterministic wallet-history facts approved by model policy.

A wallet's balance, token value, or apparent wealth must not automatically create reputation.

### 3. Identity / Proof

Candidate base weight: **15%**

Eligible evidence includes:

- verified `.gwap` identity relationships;
- verified wallet control;
- verified social proof-of-control;
- approved identity attestations;
- evidence freshness and continuity.

Identity verification establishes confidence in the subject/evidence relationship. It is not equivalent to good reputation by itself.

### 4. GWAP Ecosystem Reputation

Candidate base weight: **10%**

Eligible evidence may include:

- verified PPV factual receipts;
- completed GWAP ecosystem interactions;
- accepted deliverables;
- settled/completed reputation-relevant events;
- verified contribution history;
- other Founder-approved ecosystem facts.

PPV records facts. GwapScore interprets approved facts downstream.

## Candidate base weights

| Dimension | Candidate weight |
| --- | ---: |
| Social Reputation | 45% |
| Wallet Reputation | 30% |
| Identity / Proof | 15% |
| GWAP Ecosystem Reputation | 10% |

These are **candidate calibration weights**, not permanent architecture law.

Any production weight change must:

1. increment the model version;
2. include regression fixtures;
3. show score-distribution impact;
4. document rationale;
5. preserve explainability.

## Evidence states

Every dimension is either:

- `observed` — real evidence produced a score;
- `unavailable` — the source is missing, disconnected, unauthorized, failed, or insufficient.

Unavailable evidence is never represented as zero.

The scoring engine must not silently replace unavailable dimensions with a neutral `50`, minimum score, or guessed value.

## Coverage

Coverage answers:

> How much of the configured reputation model has real evidence?

For model weights `w_i`, coverage is:

```text
coverage = sum(base weight of observed dimensions) / sum(all base weights)
```

Coverage is reported as 0–100% and is separate from reputation quality.

## Confidence

Each observed dimension carries a confidence value from `0.0` to `1.0` based on evidence quality, provenance, freshness, and sufficiency.

Model-level confidence is the base-weighted confidence of the observed dimensions:

```text
confidence =
  sum(baseWeight_i × confidence_i for observed i)
  / sum(baseWeight_i for observed i)
```

Confidence does not mean reputation is good. It means GWAP has stronger evidence for the stated result.

## Composite calculation

For each observed dimension:

```text
effectiveWeight_i = baseWeight_i × confidence_i
```

The evidence-normalized composite score is:

```text
composite100 =
  sum(score_i × effectiveWeight_i)
  / sum(effectiveWeight_i)
```

Then map the result to the public 300–900 range:

```text
GwapScore = round(300 + composite100 × 6)
```

The calculation does not insert synthetic values for unavailable dimensions.

## Result status

Candidate v2 policy:

- `unscored` — no observed reputation dimensions.
- `provisional` — evidence exists but fewer than two dimensions are observed or configured coverage is below 60%.
- `scored` — at least two dimensions are observed and coverage is at least 60%.

This prevents one evidence source from silently becoming the entire reputation system while still allowing a user to see a provisional result during onboarding.

The threshold is versioned model policy and may be calibrated before production.

## Tiers

The current public 300–900 contract is preserved:

| Score | Tier |
| ---: | --- |
| 300–499 | High Risk |
| 500–599 | Developing |
| 600–699 | Established |
| 700–799 | Strong |
| 800–900 | Elite |

Tier names may be reviewed separately from the numeric contract. A tier label must not imply a financial-credit determination.

## Wallet Intelligence boundary

Wallet Intelligence and GwapScore remain separate systems/contracts even when integrated.

```text
Wallet data / verified wallet control
        ↓
Wallet Intelligence
        ↓
reputation-eligible wallet evidence
        ↓
Wallet Reputation dimension
        ↓
GwapScore v2
```

### Anti-circularity rule

GwapScore must **never consume another GwapScore value as Wallet Reputation input**.

If a broader Wallet Intelligence response contains `gwapScore`, that field is output context and must be ignored by the wallet-evidence adapter. Only non-circular underlying wallet evidence may feed the Wallet Reputation dimension.

## Wallet Exposure Risk boundary

Wallet Exposure Risk is excluded from v2 scoring.

Examples of excluded direct reputation inputs:

- portfolio concentration;
- token-price volatility;
- drawdown exposure;
- speculative asset allocation;
- low-liquidity exposure;
- portfolio market value;
- wallet net worth.

These may appear beside GwapScore in an intelligence product, but they do not become GwapScore reputation points.

## Wallet-linking policy

A wallet must be cryptographically proven as controlled by the score subject before it contributes.

Initial v2 policy should use one explicitly selected **primary verified wallet** for the Wallet Reputation dimension. Changing the primary wallet must:

- require proof of control;
- preserve provenance/history of the prior linkage;
- trigger recalculation;
- be visible in score explanation metadata.

This avoids silently cherry-picking or mixing unrelated wallets. Multi-wallet aggregation requires a separate versioned policy.

## Contradictory evidence

Dimensions do not overwrite one another.

Example:

```text
Social: 25 / 100
Wallet: 96 / 100
```

A strong wallet raises the composite result according to its allowed weight and confidence, but the output must still disclose that Social Reputation is weak.

Future contradiction/anomaly policies may reduce confidence or emit a review flag. They must not invent a hidden penalty.

## Worked example

Inputs:

```text
Social:         score 42, confidence 0.72, weight 45
Wallet:         score 93, confidence 0.96, weight 30
Identity/Proof: score 88, confidence 1.00, weight 15
Ecosystem:      unavailable, weight 10
```

Effective weights:

```text
Social:   45 × 0.72 = 32.4
Wallet:   30 × 0.96 = 28.8
Identity: 15 × 1.00 = 15.0
Total:                 76.2
```

Composite:

```text
(42×32.4 + 93×28.8 + 88×15.0) / 76.2
≈ 70.33
```

Public score:

```text
300 + (70.33 × 6) ≈ 722
```

Coverage:

```text
(45 + 30 + 15) / 100 = 90%
```

Confidence:

```text
(45×0.72 + 30×0.96 + 15×1.00) / 90
≈ 84.7%
```

Result:

```text
GwapScore: 722 — Strong
Status: scored
Coverage: 90%
Confidence: 85%
```

## Explainability contract

Every v2 result should expose at least:

```ts
{
  modelVersion,
  status,
  score,
  tier,
  dimensions,
  coverage,
  confidence,
  effectiveWeights,
  positiveDrivers,
  negativeDrivers,
  unavailableEvidence,
  provenance,
  calculatedAt
}
```

The engine must be able to explain which evidence materially changed the result.

## Privacy and consent

- Social data collection remains consented and source-scoped.
- Wallet linkage requires proof of control.
- Public score presentation must not expose private tokens, secrets, private messages, or unnecessary raw wallet history.
- B2B surfaces should return only the evidence detail authorized by their contract.

## Existing implementation relationship

### `social/scoring.ts`

The current social scorer is useful implementation evidence, but its `neutralIfMissing(...)=50` behavior is not compatible with the final v2 evidence-state contract. Do not wire it directly into final v2 aggregation without an evidence-aware migration.

### `protocol/scoring.v1.ts`

The older protocol scorer contains reusable concepts such as wallet ownership, wallet age, and transaction history. Its 0–100 point policy, risk labels, and direct wallet point additions are legacy behavior and are not the v2 model.

### Solana adapter

The existing Solana adapter may be evolved into a Wallet Reputation evidence adapter after validating provenance and replacing threshold-only point logic with the v2 wallet-evidence contract.

## Implementation gates

Before v2 becomes production scoring:

1. define the Wallet Intelligence evidence contract;
2. migrate social scoring to explicit unavailable/observed metrics;
3. implement composite scoring as a pure deterministic function;
4. add golden regression fixtures;
5. test contradictory and missing-evidence cases;
6. test wallet-link proof and wallet-switch behavior;
7. validate score distributions against real snapshot data;
8. document model version and rollout/rollback;
9. expose dimensions/coverage/confidence in API contracts;
10. explicitly approve production activation.
