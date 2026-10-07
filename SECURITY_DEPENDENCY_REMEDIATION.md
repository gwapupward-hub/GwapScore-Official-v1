# Dependency Security Remediation Gate

**Status:** OPEN  
**Observed:** 2026-10-07  
**Scope:** existing `gwap-score-full` dependency tree

## Finding

The CI dependency audit currently reports 57 advisories:

- 1 low
- 7 moderate
- 46 high
- 3 critical

The findings are dependency-tree debt in the existing repository and are not evidence that the GwapScore v2 scoring logic introduced those vulnerabilities.

Examples reported by `npm audit` include advisories affecting transitive/direct dependency paths involving `proxy-addr`, `tar`, `handlebars`, `joi`, `browserslist`, `flatted`, `js-yaml`, `minimatch`, and related tooling packages.

## Policy

Do **not** run `npm audit fix --force` blindly. The audit indicates that some complete remediations require breaking upgrades such as major changes to Jest, TypeScript ESLint packages, and bcrypt-related dependencies.

Remediation should be handled as a dedicated dependency/security change with:

1. direct-vs-transitive dependency classification;
2. runtime-vs-development exposure classification;
3. minimal safe version upgrades first;
4. explicit review of major-version changes;
5. full test/build/database regression validation;
6. container/security rescan;
7. lockfile review;
8. release notes for behavior-affecting upgrades.

## GwapScore v2 release boundary

This debt does not justify weakening GwapScore v2 scoring tests or security scanning. Production activation of GwapScore v2 remains gated on a reviewed disposition of critical/high runtime-relevant findings.

The CI security job should continue to:

- run `npm audit` and preserve its evidence;
- run Trivy;
- upload SARIF through CodeQL Action v3 with `security-events: write` permission.
