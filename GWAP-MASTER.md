# GWAP MASTER integration

Canonical cross-system authority:
https://github.com/gwapupward-hub/gwapspot-web/blob/main/docs/master/README.md

## Current product boundary

GWAP MASTER defines the current cross-system product direction:

- GwapScore owns **social reputation** and social proof-of-control.
- GNS owns `.gwap` identity and financial/on-chain identity context.
- PPV records proof/commerce facts and receipts.
- GwapOS owns user-facing orchestration.

Older GwapScore implementation assumptions in this repository are implementation/history evidence, not permission to reintroduce financial/on-chain scoring into the current product without an explicit Founder decision.

## Resolution order

1. Explicit Founder/current product decision.
2. Current GwapScore repo implementation + tests for behavior that remains in scope.
3. GWAP MASTER for cross-system ownership and direction.
4. Current official upstream sources where applicable.

## Change rule

Before implementing a scoring factor, data source, credential, or integration, state:
- whether it is social reputation;
- what proof source it uses;
- whether the source belongs to GNS or PPV instead;
- how it decays/updates;
- what user-facing explanation is available.

Cross-system ownership changes require a MASTER decision record.
