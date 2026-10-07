# AGENTS.md

Before changing GwapScore product behavior, read `GWAP-MASTER.md` and `GWAPSCORE_REPUTATION_MODEL_V2.md`.

## Authority

- Explicit Founder/current product decisions define GwapScore's scope.
- Repo-local code/tests define current implementation reality.
- GWAP MASTER defines cross-system ownership boundaries.
- External examples or older scoring models do not silently expand GwapScore's scope.

## Current boundary

GwapScore is a **social-reputation-first, multidimensional reputation system**.

Approved v2 evidence domains are:

- Social Reputation;
- reputation-eligible Wallet Intelligence;
- Identity / Proof;
- explicitly approved GWAP ecosystem evidence.

Wallet Exposure Risk, portfolio value, token-price volatility, concentration, and similar market-risk signals do not become reputation points.

Older Solana scoring code in this repository is historical implementation evidence. Reuse factual extraction logic where appropriate, but do not reactivate its scoring policy wholesale.

## Required scoring rules

- Missing/unavailable evidence is not zero and must not be silently imputed as a neutral `50`.
- Preserve Social, Wallet, Identity/Proof, and GWAP Ecosystem dimensions in explanations.
- Expose evidence coverage and confidence separately from the headline score.
- Preserve source provenance for material scoring evidence.
- No single evidence source may silently erase contradictory evidence from another dimension.
- Model/weight changes require a model-version change and regression tests.
- Wallet Exposure Risk stays outside the reputation formula.
- Generic profile claims are not authoritative v2 Wallet Intelligence.
- V2 wallet evidence must use the dedicated privileged Wallet Intelligence evidence path.
- Wallet control must be verified before wallet evidence can contribute.
- The current `ownershipVerified` adapter assertion is an alpha trust boundary and must be bound to authoritative wallet proof before production activation.
- Historical social rows created under neutral-imputation scoring require re-ingestion before entering v2.
- GwapScore must never consume another GwapScore value as an input to itself.

## Change rule

Before implementing a scoring factor, data source, credential, or integration, state:

- which reputation dimension owns it;
- what proof/provenance source it uses;
- whether the evidence is observed or unavailable;
- its confidence/freshness semantics;
- whether another system such as GNS or PPV owns the underlying fact;
- what user-facing explanation is available;
- whether a model-version bump is required.

Any cross-system contract change should identify the owner system and update MASTER.

Production activation of GwapScore v2 requires explicit approval after CI, real-data calibration, adversarial testing, authoritative wallet-proof binding, and model-version review.
