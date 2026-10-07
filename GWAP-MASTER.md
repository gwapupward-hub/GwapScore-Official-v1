# GWAP MASTER integration

Canonical cross-system authority:
https://github.com/gwapupward-hub/gwapspot-web/blob/main/docs/master/README.md

## Current product boundary

GWAP MASTER defines the current cross-system product direction. The Founder-approved `GWAP-REPUTATION-001` decision revises the earlier social-only boundary:

- GwapScore owns **social-reputation-first, multidimensional reputation scoring** and social proof-of-control.
- Reputation-eligible Wallet Intelligence may be consumed by GwapScore as supporting evidence and may materially affect the overall score.
- GNS owns `.gwap` identity, naming, resolution, and identity context.
- Wallet Exposure Risk remains separate from GwapScore reputation and must not be silently converted into reputation points.
- PPV records proof/commerce facts and receipts; GwapScore may interpret approved factual evidence downstream.
- GwapOS owns user-facing orchestration.

Older GwapScore implementation assumptions remain implementation/history evidence. Older wallet scoring code may be mined for reusable evidence extraction, but it is not permission to restore a wallet-only, financial-risk, or credit-scoring model.

## Canonical v2 scoring principles

1. Preserve the public 300–900 GwapScore range.
2. Keep social reputation as the primary reputation surface.
3. Allow reputation-eligible Wallet Intelligence to contribute through an explicit Wallet Reputation dimension.
4. Preserve separate dimensions rather than allowing one strong source to erase a weak source.
5. Missing/unavailable evidence is never zero and must not be silently imputed as negative reputation.
6. Report evidence coverage and confidence separately from the headline score.
7. Keep provenance and user-facing explanations for material contributions.
8. Keep Wallet Exposure Risk outside the reputation formula.
9. Version scoring weights and model behavior; weight changes require regression evidence.
10. A single evidence source may produce a provisional result, but a production-strength composite result should require multi-domain evidence according to the versioned model policy.

See [`GWAPSCORE_REPUTATION_MODEL_V2.md`](GWAPSCORE_REPUTATION_MODEL_V2.md).

## Resolution order

1. Explicit Founder/current product decision.
2. Current GwapScore repo implementation + tests for behavior that remains in scope.
3. GWAP MASTER for cross-system ownership and direction.
4. Current official upstream sources where applicable.

## Change rule

Before implementing a scoring factor, data source, credential, or integration, state:
- which GwapScore dimension it belongs to;
- what proof/provenance source it uses;
- whether the source is reputation-eligible or belongs to a separate risk product;
- how it decays/updates;
- how missing data is represented;
- what confidence/coverage effect it has;
- what user-facing explanation is available.

Cross-system ownership changes require a MASTER decision record.
