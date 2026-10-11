# GwapScore v2 Foundation Freeze

**Decision:** `GWAPSCORE-V2-FREEZE-001`  
**Effective:** 2026-10-11  
**Model family:** GwapScore v2  
**Current candidate version:** `2.0.0-alpha.2`  
**Production status:** NOT ACTIVATED

## Purpose

This decision freezes the architectural foundation of GwapScore v2 so implementation can proceed without repeatedly redesigning the scoring model.

The freeze locks the reputation contract and trust boundaries. It does **not** lock calibration parameters that still require representative-data testing.

## Frozen architecture

The following are now canonical unless superseded by an explicit Founder decision and a versioned model change:

1. **Product definition** — GwapScore is a social-reputation-first, multidimensional reputation system. It is not a credit score, lending score, wealth score, or portfolio-risk score.
2. **Public score range** — published GwapScore values use the 300–900 range.
3. **Dimensions** — Social Reputation, Wallet Reputation, Identity / Proof, and GWAP Ecosystem Reputation remain independently explainable dimensions.
4. **Social-first principle** — Social Reputation remains the primary reputation surface.
5. **Wallet boundary** — only reputation-eligible Wallet Intelligence may contribute to Wallet Reputation. Balance, market value, token-price volatility, concentration, drawdown, and net worth do not create reputation points.
6. **Proof requirement** — wallet evidence may contribute only after authoritative proof of wallet control. The existing privileged `ownershipVerified` adapter assertion remains an alpha trust boundary and is not production proof.
7. **Evidence states** — evidence is explicitly `observed` or `unavailable`. Missing/unavailable evidence is never silently converted to zero, a neutral 50, or another invented score.
8. **Coverage** — evidence coverage is reported separately from reputation quality.
9. **Confidence** — confidence is reported separately and reflects evidence quality, provenance, freshness, and sufficiency.
10. **Determinism** — identical eligible evidence evaluated under the same model version must produce the same result.
11. **Contradictory evidence** — a strong dimension may influence the composite but must not erase or overwrite a weak dimension.
12. **Explainability** — material contributions retain provenance and user-facing explanations.
13. **Anti-circularity** — GwapScore must never consume another GwapScore value as scoring evidence.
14. **Result states** — the model distinguishes `unscored`, `provisional`, and `scored` results.
15. **Versioning** — any change that affects score output, tier behavior, eligibility, composition, thresholds, or confidence semantics requires an explicit model-version review and regression evidence.

## Current tier contract

The numeric thresholds remain unchanged, but tier language is reputation-oriented rather than financial-risk-oriented:

| Score | Tier |
| ---: | --- |
| 300–499 | Emerging |
| 500–599 | Developing |
| 600–699 | Established |
| 700–799 | Strong |
| 800–900 | Elite |

`High Risk` is retired from the v2 reputation tier vocabulary because GwapScore is not a credit or portfolio-risk product.

## Calibration remains open

The following are intentionally **not frozen as permanent production policy**:

- base dimension weights: Social 45%, Wallet 30%, Identity / Proof 15%, GWAP Ecosystem 10%;
- wallet submodel split: longevity 45%, transaction activity 55%;
- wallet age/activity calibration anchors;
- minimum observed-dimension and coverage thresholds for `scored` status;
- future social factor weights;
- future anomaly-confidence adjustments;
- future approved PPV/GWAP ecosystem evidence factors.

Changes to these candidates require regression fixtures, score-distribution analysis, documented rationale, and a model-version decision before production promotion.

## Foundation invariants

CI/regression coverage must preserve at least these invariants:

- same evidence + same model version = same result;
- unavailable evidence is not negative evidence;
- one evidence source cannot silently become a production-strength multidimensional result;
- contradictory dimensions remain visible;
- wealth-like metadata cannot directly alter the composite reputation score;
- published scores remain inside 300–900;
- unverified wallet evidence cannot contribute Wallet Reputation;
- circular GwapScore-as-input evidence is rejected/ignored by the Wallet Intelligence boundary.

## Next implementation gate

The next engineering milestone after this freeze is **Authoritative Wallet Proof-of-Control**:

```text
GwapOS identity
    ↓
issue short-lived wallet challenge
    ↓
wallet signs challenge
    ↓
server verifies signature + nonce + subject + expiry
    ↓
persist verified wallet-control proof
    ↓
Wallet Intelligence snapshot becomes reputation-eligible
    ↓
Wallet Reputation may contribute to GwapScore
```

The production design must prevent replay, subject swapping, stale challenges, and adapter self-assertion from being treated as wallet ownership.

## Production gates that remain

GwapScore v2 must remain alpha/beta until all of the following are satisfied:

1. authoritative GwapOS wallet Proof-of-Control binding;
2. full CI, database, and security regression validation;
3. representative real-data score-distribution analysis;
4. calibration of candidate dimension and wallet submodel weights;
5. adversarial/Sybil/manipulation testing;
6. wallet-switch and primary-wallet policy testing;
7. explanation/reason-code validation;
8. trusted PPV/GWAP ecosystem integration where explicitly approved;
9. documented rollout and rollback procedure;
10. explicit production model promotion and Founder approval.

## Change control

Implementation work may improve evidence extraction, provenance, proof verification, anti-gaming defenses, observability, testing, and integrations without reopening the architecture above.

A proposal that changes a frozen rule must state:

- the rule being changed;
- the reason;
- affected dimensions and evidence sources;
- expected score-distribution impact;
- regression/adversarial evidence;
- required model-version change;
- migration and rollback plan.

Until such a proposal is explicitly approved, this document is the GwapScore v2 foundation baseline.
