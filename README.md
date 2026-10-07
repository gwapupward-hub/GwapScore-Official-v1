# GwapScore

GwapScore-Official-v1 is the canonical TypeScript implementation repository for GwapScore.

GwapScore is a **social-reputation-first, multidimensional reputation system**. Social proof-of-control and longitudinal social evidence remain the primary product surface, while reputation-eligible Wallet Intelligence may contribute supporting evidence to the overall GwapScore. Wallet portfolio exposure risk remains a separate product signal and is not reputation.

## Cross-system authority

See [`GWAP-MASTER.md`](GWAP-MASTER.md) before changing product scope or cross-system ownership.

Canonical cross-system authority lives at:

`gwapupward-hub/gwapspot-web/docs/master/README.md`

The Founder-approved composite-reputation direction is recorded there as `GWAP-REPUTATION-001`.

## Current model direction

The v2 alpha model preserves the public **300–900 GwapScore** contract while exposing the evidence behind the number.

Current dimensions:

- **Social reputation** — verified social ownership plus observed authenticity, engagement quality, consistency, audience trust, and related social evidence. Missing metrics are excluded rather than converted to an invented neutral value.
- **Wallet reputation** — privileged Wallet Intelligence snapshots derived from verified wallet control, wallet longevity, and transaction activity. Generic profile claims are not eligible to self-award this dimension.
- **Identity / proof** — current alpha support measures verified social OAuth control and verified wallet control as separate proof classes.
- **GWAP ecosystem reputation** — reserved for trusted PPV/GWAP evidence; currently unavailable until those adapters are connected.

The score exposes evidence coverage, confidence, provenance, per-dimension explanations, model version, and whether the result is `unscored`, `provisional`, or fully `scored`.

Missing evidence is not scored as zero. Historical social rows created under the older neutral-imputation model do not enter v2 until the social account is re-ingested under the new evidence-state contract.

Wallet Exposure Risk is excluded from the GwapScore reputation calculation. Portfolio concentration, volatility, token-risk exposure, and similar financial-risk signals remain separate even when returned beside GwapScore by a broader intelligence API.

See [`GWAPSCORE_REPUTATION_MODEL_V2.md`](GWAPSCORE_REPUTATION_MODEL_V2.md).

## v2 alpha API

Authenticated user-scoped API keys can retrieve their composite score at:

`GET /v1/reputation/me`

Trusted Solana adapter callers can continue submitting wallet evidence at:

`POST /v1/adapters/solana/evidence`

The wallet payload accepts optional `ownershipVerified: true|false`. Only dedicated Wallet Intelligence snapshots with verified control can affect the v2 wallet dimension. Existing legacy claims remain for backwards compatibility but are not authoritative v2 wallet-score inputs.

`ownershipVerified` is currently an assertion accepted only through the privileged `adapter:solana` trust boundary. Before production activation it must be bound to authoritative GwapOS wallet-auth/proof evidence rather than treated as a public self-attestation mechanism.

## Contents

- `gwap-score-full/` — Full implementation and source
- `gwap-score-full/reputation/composite.ts` — Pure v2 composite scoring engine
- `gwap-score-full/reputation/walletIntelligence.ts` — Wallet Intelligence evidence normalization
- `gwap-score-full/reputation/service.ts` — Evidence composition service
- `gwapscore-docs-publish/` — Generated documentation ready for publishing
- `gwapscore-github-ready/` — Built artifacts prepared for GitHub release
- `assets/` — Project assets (images, icons, etc.)
- [`gwap-score-full/README.md`](gwap-score-full/README.md) — Backend setup and social reputation API

Older protocol code that scores Solana wallet claims is retained as implementation/history evidence. It is not the v2 production scoring contract and must not be re-enabled wholesale.

## Production gate

The v2 implementation is **alpha and not yet authorized as the production scoring model**. Production activation requires:

1. successful full CI and regression tests;
2. authoritative wallet-control proof binding;
3. real-data distribution analysis;
4. calibration of dimension and wallet submodel weights;
5. trusted PPV/GWAP ecosystem evidence integration where applicable;
6. adversarial/Sybil and wallet-switch testing;
7. explicit model-version promotion and Founder approval.

## Requirements

- Node.js 18+ at repository root
- Node.js 20+ for `gwap-score-full/`
- npm

## Quickstart

1. Install dependencies

   `npm ci`

2. Type-check

   `npm run typecheck`

3. Lint

   `npm run lint`

4. Build

   `npm run build`

For the full backend implementation, run the corresponding commands from `gwap-score-full/`.

## Contributing

Please open issues or pull requests. Read `AGENTS.md` and `GWAP-MASTER.md` before changing scoring behavior or evidence ownership.

## License

MIT. See [`LICENSE`](LICENSE).

## Contact

For questions, contact the repository owner: gwapupward-hub
