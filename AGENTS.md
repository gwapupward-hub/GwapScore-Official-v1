# AGENTS.md

Before changing GwapScore product behavior, read `GWAP-MASTER.md` and `GWAPSCORE_REPUTATION_MODEL_V2.md`.

## Authority

- Explicit Founder/current product decisions define GwapScore's scope.
- Repo-local code/tests define current implementation reality.
- GWAP MASTER defines cross-system ownership boundaries.
- External examples or older scoring models do not silently expand GwapScore's scope.

## Current boundary

GwapScore is a **social-reputation-first, multidimensional reputation system**.

Reputation-eligible Wallet Intelligence may contribute to the overall GwapScore through the Wallet Reputation dimension. This does **not** authorize credit scoring, lending eligibility inference, portfolio-risk scoring, or treating Wallet Exposure Risk as reputation.

Older Solana scoring code in this repository is historical implementation evidence. Reuse factual extraction logic where appropriate, but do not reactivate its scoring policy wholesale.

## Required scoring rules

- Missing/unavailable evidence is not zero and must not be silently imputed as negative reputation.
- Preserve Social, Wallet, Identity/Proof, and GWAP Ecosystem dimensions in explanations.
- Expose evidence coverage and confidence separately from the headline score.
- Preserve source provenance for material scoring evidence.
- No single evidence source may silently erase contradictory evidence from another dimension.
- Model/weight changes require a model-version change and regression tests.
- Wallet Exposure Risk stays outside the reputation formula.

Any cross-system contract change should identify the owner system and update MASTER.
