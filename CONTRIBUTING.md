# Contributing

Thanks for wanting to contribute! Please follow these guidelines:

- Fork the repository and create a new branch for your change.
- Run tests and linting locally before opening a PR:
  - npm ci
  - npm run typecheck
  - npm run lint
  - npm test
- Keep commits small and focused. Use clear commit messages.
- Open a pull request and include a description of what you changed and why.

Guidelines for PRs:
- PRs should target the `main` branch (or `develop` if present).
- All checks (lint/typecheck/tests) should pass before merging.

Code style:
- Follow the ESLint rules in .eslintrc.json.
