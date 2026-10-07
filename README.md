<p align="center">
  <img src="assets/brand/banner.png" alt="GwapScore" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/gwapupward-hub/gwapscore-official-v1/actions/workflows/ci.yml"><img src="https://github.com/gwapupward-hub/gwapscore-official-v1/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/model-v2%20alpha-13DD13?labelColor=000000" alt="Model: v2 alpha" />
  <img src="https://img.shields.io/badge/score-300%E2%80%93900-13DD13?labelColor=000000" alt="Score range: 300-900" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-13DD13?labelColor=000000&logo=typescript&logoColor=white" alt="TypeScript" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-13DD13?labelColor=000000" alt="License: MIT" /></a>
</p>

<p align="center">
  <a href="GWAPSCORE_REPUTATION_MODEL_V2.md">Reputation Model</a> ·
  <a href="GWAP-MASTER.md">GWAP Master</a> ·
  <a href="gwap-score-full/README.md">Backend</a> ·
  <a href="assets/brand/README.md">Brand Kit</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

**GwapScore** is a **social-reputation-first, multidimensional reputation system**. This repository is the canonical TypeScript implementation.

Social proof-of-control and longitudinal social evidence remain the primary product surface, while reputation-eligible Wallet Intelligence may contribute supporting evidence to the overall GwapScore. Wallet portfolio exposure risk remains a separate product signal and is not reputation.

## Cross-system authority

See [`GWAP-MASTER.md`](GWAP-MASTER.md) before changing product scope or cross-system ownership.

Canonical cross-system authority lives at:

`gwapupward-hub/gwapspot-web/docs/master/README.md`

The Founder-approved composite-reputation direction is recorded there as `GWAP-REPUTATION-001`.

## Current model direction

The v2 alpha model preserves the public **300–900 GwapScore** contract while exposing the evidence behind the number.

| Dimension | What it measures | Status |
| --- | --- | --- |
| **Social reputation** | Verified social ownership plus observed authenticity, engagement quality, consistency, audience trust, and related social evidence. Missing metrics are excluded rather than converted to an invented neutral value. | Alpha |
| **Wallet reputation** | Privileged Wallet Intelligence snapshots derived from verified wallet control, wallet longevity, and transaction activity. Generic profile claims are not eligible to self-award this dimension. | Alpha |
| **Identity / proof** | Verified social OAuth control and verified wallet control, measured as separate proof classes. | Alpha |
| **GWAP ecosystem reputation** | Reserved for trusted PPV/GWAP evidence. | Unavailable until adapters are connected |

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

## Repository layout

| Path | Description |
| --- | --- |
| [`gwap-score-full/`](gwap-score-full/) | Full implementation and source — see its [README](gwap-score-full/README.md) for backend setup and the social reputation API |
| `gwap-score-full/reputation/composite.ts` | Pure v2 composite scoring engine |
| `gwap-score-full/reputation/walletIntelligence.ts` | Wallet Intelligence evidence normalization |
| `gwap-score-full/reputation/service.ts` | Evidence composition service |
| [`gwapscore-docs-publish/`](gwapscore-docs-publish/) | Generated documentation ready for publishing |
| [`gwapscore-github-ready/`](gwapscore-github-ready/) | Built artifacts prepared for GitHub release |
| [`assets/brand/`](assets/brand/) | Official brand kit — logos, favicons, social preview |

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

```bash
npm ci             # install dependencies
npm run typecheck  # type-check
npm run lint       # lint
npm run build      # build
```

For the full backend implementation, run the corresponding commands from `gwap-score-full/`.

## Contributing

Please open issues or pull requests. Read `AGENTS.md` and `GWAP-MASTER.md` before changing scoring behavior or evidence ownership.

## License

MIT. See [`LICENSE`](LICENSE).

## Contact

For questions, contact the repository owner: [@gwapupward-hub](https://github.com/gwapupward-hub).
