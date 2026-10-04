# GwapScore

GwapScore-Official-v1 is a TypeScript project for social reputation and social proof-of-control. The repository also contains earlier protocol code and GitHub-ready packaging.

## Cross-system authority

See [`GWAP-MASTER.md`](GWAP-MASTER.md) before changing product scope or cross-system ownership.

## Contents

- gwap-score-full/ — Full implementation and source
- gwapscore-docs-publish/ — Generated documentation ready for publishing
- gwapscore-github-ready/ — Built artifacts prepared for GitHub release
- assets/ — Project assets (images, icons, etc.)
- [`gwap-score-full/README.md`](gwap-score-full/README.md) — Backend setup and social reputation API

The current GwapScore product boundary is social reputation. Financial/on-chain identity context belongs to GNS, commerce facts to PPV, and user-facing orchestration to GwapOS, as described in [`GWAP-MASTER.md`](GWAP-MASTER.md).

## Requirements

- Node.js 18+ (recommended)
- npm

## Quickstart

1. Install dependencies

   npm ci

2. Type-check

   npm run typecheck

3. Lint

   npm run lint

4. Build

   npm run build

## Contributing

Please open issues or pull requests. Use the included GitHub Actions workflow which runs lint and type checks on pushes and pull requests.

## License

Add a LICENSE file or update this section to reflect the project's license.

## Contact

For questions, contact the repository owner: gwapupward-hub
