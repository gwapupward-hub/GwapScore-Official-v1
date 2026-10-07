# GwapScore

GwapScore-Official-v1 is the canonical TypeScript implementation repository for GwapScore.

GwapScore is a **social-reputation-first, multidimensional reputation system**. Social proof-of-control and longitudinal social evidence remain the primary product surface, while reputation-eligible Wallet Intelligence may contribute supporting evidence to the overall GwapScore. Wallet portfolio exposure risk remains a separate product signal and is not reputation.

## Cross-system authority

See [`GWAP-MASTER.md`](GWAP-MASTER.md) before changing product scope or cross-system ownership.

Canonical cross-system authority lives at:

`gwapupward-hub/gwapspot-web/docs/master/README.md`

The Founder-approved composite-reputation direction is recorded there as `GWAP-REPUTATION-001`.

## Current model direction

The v2 model preserves the public **300–900 GwapScore** contract while exposing the evidence behind the number.

Planned dimensions:

- **Social reputation** — verified social ownership, authenticity, engagement quality, consistency, audience trust, longitudinal behavior.
- **Wallet reputation** — reputation-eligible Wallet Intelligence such as verified wallet control, longevity, transaction history, protocol participation, and behavioral continuity.
- **Identity / proof** — verified identity relationships and proof-of-control evidence.
- **GWAP ecosystem reputation** — verified PPV/GWAP activity and other explicitly approved ecosystem facts.

The score must also expose evidence coverage, confidence, provenance, and explanations. Missing evidence is not scored as zero and must not be silently imputed as bad reputation.

Wallet Exposure Risk is excluded from the GwapScore reputation calculation. Portfolio concentration, volatility, token-risk exposure, and similar financial-risk signals remain separate even when returned beside GwapScore by a broader intelligence API.

See [`GWAPSCORE_REPUTATION_MODEL_V2.md`](GWAPSCORE_REPUTATION_MODEL_V2.md).

## Contents

- `gwap-score-full/` — Full implementation and source
- `gwapscore-docs-publish/` — Generated documentation ready for publishing
- `gwapscore-github-ready/` — Built artifacts prepared for GitHub release
- `assets/` — Project assets (images, icons, etc.)
- [`gwap-score-full/README.md`](gwap-score-full/README.md) — Backend setup and current social reputation API

Older protocol code that scores Solana wallet claims is retained as implementation/history evidence. It is not the v2 production scoring contract and must not be re-enabled wholesale. Reusable wallet facts should flow through the v2 Wallet Reputation dimension under the current evidence rules.

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
