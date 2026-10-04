<p align="center">
  <img src="../assets/brand/logo.png" alt="GwapScore Logo" width="200" />
</p>

# GwapScore Trust Protocol v1.0

GwapScore is a **trust protocol**, not an app. It derives explainable reputation from verifiable claims, behavioral events, and signed attestations — without storing mutable scores or deleting history.

## Social reputation module

GwapScore's current product scope is **social reputation and social proof-of-control**. The `social/` API module below adds user-consented Instagram account linking, authorized metric ingestion, and an explainable score. The older protocol sections in this README describe existing repository behavior; they do not expand the current scoring scope. GNS owns financial/on-chain identity context, PPV owns commerce facts, and GwapOS owns user-facing orchestration.

This score is social reputation guidance only. It is **not financial advice and is not credit scoring**. It must not be used as a proxy for ability to repay, lending eligibility, or financial risk.

### Pipeline

```text
User + explicit consent
   → authenticated connect request
   → Instagram OAuth (signed, expiring state)
   → encrypted access token
   → manual/internal ingestion job
   → profile + post metric snapshots
   → deterministic social score + explanation
   → latest score and history endpoints
```

The module stores profile identifiers and the authorized profile/post metrics returned by Instagram; it does not store passwords, private messages, contacts, captions, or post text. Each ingestion currently imports up to 50 available posts, and snapshots are refreshed only when ingestion runs. Disconnecting removes the account's token and linked snapshots, jobs, and scores; `DELETE /v1/social/data` removes all social records and consent records for the authenticated user.

### Instagram OAuth setup

Configure an Instagram app with the redirect URI `https://your-host/v1/social/oauth/callback` (use the matching local URL in development), then set these variables in `.env`:

```dotenv
INSTAGRAM_CLIENT_ID=your_instagram_app_id
INSTAGRAM_CLIENT_SECRET=your_instagram_app_secret
INSTAGRAM_REDIRECT_URI=http://localhost:3000/v1/social/oauth/callback
SOCIAL_OAUTH_STATE_SECRET=<at least 32 random bytes>
SOCIAL_TOKEN_ENCRYPTION_KEY=<base64-encoded 32 random bytes>
```

Generate the application secrets with `openssl rand -base64 32`. The callback uses a signed ten-minute OAuth state; stored access tokens are encrypted with AES-256-GCM. Instagram API access and available insights depend on account type, app review, and granted scopes. Only configure platform-approved read scopes. Apply `database/migrations/002_social_reputation.sql` to an existing database; fresh installs can use the updated `database/schema.sql`.

User-scoped endpoints require an API key with `social:manage` permission and a non-null `api_keys.user_id` bound to an existing `trust_profiles.subject_id`. A platform callback is authorized through its signed OAuth state instead of a bearer API key.

### API example

For these examples, export `AUTHORIZATION_HEADER` as the normal Authorization header containing your user-scoped API key.

```bash
# Start consented Instagram authorization
curl -X POST http://localhost:3000/v1/social/accounts/connect \
  -H "$AUTHORIZATION_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "instagram",
    "accepted": true,
    "policy_version": "2026-10-04",
    "scopes": ["instagram_business_basic", "instagram_business_manage_insights"]
  }'

# List linked accounts
curl http://localhost:3000/v1/social/accounts \
  -H "$AUTHORIZATION_HEADER"

# Trigger a metrics ingestion and score update
curl -X POST "http://localhost:3000/v1/social/accounts/$ACCOUNT_ID/ingest" \
  -H "$AUTHORIZATION_HEADER"

# Retrieve the latest score/explanation and score history/trend
curl http://localhost:3000/v1/social/scores/latest \
  -H "$AUTHORIZATION_HEADER"
curl "http://localhost:3000/v1/social/scores/history?limit=30" \
  -H "$AUTHORIZATION_HEADER"

# Disconnect one account or delete all social data
curl -X DELETE "http://localhost:3000/v1/social/accounts/$ACCOUNT_ID" \
  -H "$AUTHORIZATION_HEADER"
curl -X DELETE http://localhost:3000/v1/social/data \
  -H "$AUTHORIZATION_HEADER"
```

### Social v1 scoring rubric

Each subscore is normalized to 0–100 and contributes its listed share to the overall 0–100 score:

| Factor | Weight | v1 signals |
| --- | ---: | --- |
| Authenticity | 25% | Growth and engagement anomaly signals |
| Engagement Quality | 25% | Engagement rate and meaningful-comment signals |
| Content Safety & Brand Risk | 20% | Platform-approved content safety signals |
| Consistency & Recency | 15% | Recent post cadence and inactivity |
| Audience Trust Signals | 15% | Repeat-audience and positive-feedback signals |

Grades are A (90–100), B (80–89), C (70–79), D (60–69), and F (0–59). Each response contains the weighted factor contributions, strongest positive/negative drivers, and a concise rationale. Missing metrics are neutral rather than treated as adverse. The initial Instagram adapter currently imports profile/media engagement metrics; growth anomalies, comment quality, content safety, and audience trust need platform-authorized signals or a separately reviewed analysis service and therefore remain neutral until available. These signals do not imply real-world identity or audience authenticity.

Consent copy and policy version are returned by `GET /v1/social/consent` and recorded server-side when connect is initiated. Consent explains collection, exclusions, purpose, and disconnect/deletion rights. Review platform terms and privacy requirements before enabling ingestion for real users.

## Core Principles

- **Append-only trust profiles** - History is immutable, never deleted
- **Scores are derived, never stored** - Calculated on-demand from profile data
- **Every score must be explainable** - Full transparency into scoring logic
- **Chain-agnostic by design** - Works across any blockchain or platform
- **Signature verification** - Cryptographic proof for all attestations

## Features

### ✅ v1.0 Release

- **Canonical Trust Profile Schema** - JSON schema with full validation
- **Deterministic Scoring Engine** - Transparent, explainable scoring algorithm
- **PostgreSQL Persistence** - Production-ready database with append-only enforcement
- **REST API** - Complete API with authentication and rate limiting
- **Telegram Adapter** - Link and verify Telegram accounts
- **Solana Evidence Adapter** - Submit blockchain evidence (wallet age, transactions)
- **Signature Verification** - Ed25519 signature verification for attestations
- **Comprehensive Test Suite** - 70%+ code coverage
- **Docker Deployment** - Production-ready containerized deployment
- **Security Hardened** - Input validation, SQL injection protection, rate limiting

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/gwapupward-hub/GwapScore-Official-v1.git
cd GwapScore-Official-v1/gwap-score-full

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env

# Build TypeScript
npm run build

# Run database migrations
psql -h localhost -U gwapscore_user -d gwapscore -f database/schema.sql

# Start the server
npm start
```

### Docker Deployment

```bash
cd deployment
cp ../.env.example .env
# Edit .env with production values
docker-compose up -d
```

## API Documentation

### Base URL

```
http://localhost:3000/v1
```

### Authentication

Most endpoints require an API key passed in the Authorization header:

```bash
Authorization: Bearer YOUR_API_KEY
```

### Endpoints

#### System

- `GET /system/health` - Health check (public)
- `GET /system/version` - API version (public)
- `GET /system/scoring-algorithm` - Scoring algorithm documentation (public)

#### Profiles

- `GET /profiles/:subjectId` - Get trust profile (public)
- `GET /profiles/:subjectId/score` - Get derived score (public)
- `GET /profiles/:subjectId/exists` - Check if profile exists (public)
- `POST /profiles` - Create new profile (requires `profile:create` permission)
- `POST /profiles/:subjectId/claims` - Add claim (requires `profile:write` permission)
- `POST /profiles/:subjectId/events` - Add event (requires `profile:write` permission)
- `POST /profiles/:subjectId/attestations` - Add attestation (requires `profile:attest` permission)

#### Adapters

- `POST /adapters/solana/evidence` - Submit Solana evidence (requires `adapter:solana` permission)
- `POST /adapters/telegram/verify` - Verify Telegram account (requires `adapter:telegram` permission)

### Example: Get Trust Score

```bash
curl http://localhost:3000/v1/profiles/user-123/score
```

Response:
```json
{
  "subject_id": "user-123",
  "score": 45,
  "tier": "Verified",
  "risk": "Medium",
  "explanation": {
    "base_score": 20,
    "contributing_claims": [
      "Wallet ownership verified (+10)",
      "Telegram account linked (+5)"
    ],
    "contributing_events": [
      "Telegram account linked (+2)"
    ],
    "active_attestations": [
      "Attested by trusted-issuer-1 (scope: identity, weight: 0.5)"
    ],
    "penalties_applied": [],
    "multiplier": 1.5,
    "final_score_calculation": "(37 × 1.50) = 45"
  }
}
```

### Example: Submit Solana Evidence

```bash
curl -X POST http://localhost:3000/v1/adapters/solana/evidence \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "subjectId": "user-123",
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "walletAgeDays": 365,
    "txCount": 1200
  }'
```

## Scoring Algorithm

### Base Score: 20 points

### Claim Scores
- Wallet Ownership: +10
- Telegram Linked: +5
- Established Wallet (180+ days): +10
- Active Wallet (100+ txs): +5
- High Activity Wallet (1000+ txs): +10

### Event Scores
- Positive Interaction: +2
- Policy Violation: -15

### Multipliers
- Base Multiplier: 1x
- Attestations: Add their weight to multiplier
- **Final Score = (Base + Claims + Events) × (1 + Attestation Weights)**

### Score Bounds: 0-100

### Tiers
- **Elite**: 80-100 (Low Risk)
- **Trusted**: 60-79 (Low Risk)
- **Verified**: 30-59 (Medium Risk)
- **Rookie**: 0-29 (High Risk)

## Architecture

```
gwap-score-full/
├── api/                    # REST API layer
│   ├── middleware/        # Auth, rate limiting, error handling
│   ├── routes/            # API route handlers
│   └── server.ts          # Express server
├── core-engine/           # Trust profile engine
│   └── src/
│       ├── engine.ts      # Profile CRUD with validation
│       └── types.ts       # TypeScript types
├── protocol/              # Protocol specification
│   ├── scoring.v1.ts      # Scoring algorithm
│   ├── protocol.md        # Protocol documentation
│   └── trust-profile.schema.json
├── adapters/              # Platform adapters
│   ├── solana/           # Solana blockchain adapter
│   └── telegram/         # Telegram bot adapter
├── database/              # Database layer
│   ├── schema.sql        # PostgreSQL schema
│   └── client.ts         # Database client
├── utils/                 # Utilities
│   ├── crypto.ts         # Signature verification
│   ├── errors.ts         # Error types
│   ├── logger.ts         # Logging
│   └── validation.ts     # Input validation
├── deployment/            # Deployment configs
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── README.md
└── __tests__/            # Test suite
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

## Security

- **Input Validation**: All inputs validated with Joi schemas
- **SQL Injection Protection**: Parameterized queries with pg
- **Rate Limiting**: Configurable rate limits on all endpoints
- **Signature Verification**: Ed25519 signature verification for attestations
- **Authentication**: API key-based authentication with bcrypt
- **HTTPS**: Use reverse proxy (nginx/Caddy) with SSL in production
- **Database Triggers**: Prevent deletions on append-only tables
- **Audit Log**: All mutations logged for compliance

## Performance

- **Database Indexing**: Optimized indexes on all query paths
- **Connection Pooling**: PostgreSQL connection pool (default: 20)
- **Async Operations**: Non-blocking I/O throughout
- **Horizontal Scaling**: Stateless API design supports multiple instances

## Monitoring

- Health check endpoint: `/v1/system/health`
- Structured logging with Winston
- Database health checks
- Request/response logging

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

- GitHub Issues: https://github.com/gwapupward-hub/GwapScore-Official-v1/issues
- Documentation: See `/docs` directory
- Email: support@gwapscore.xyz

## Roadmap

### v1.1 (Q1 2025)
- [ ] Ethereum adapter
- [ ] Discord adapter
- [ ] GraphQL API
- [ ] Real-time scoring updates via WebSockets

### v1.2 (Q2 2025)
- [ ] Multi-chain wallet linking
- [ ] Advanced fraud detection
- [ ] Score history timeline
- [ ] Public issuer registry

### v2.0 (Q3 2025)
- [ ] Decentralized issuer network
- [ ] On-chain attestation anchoring
- [ ] zkSNARK privacy layer
- [ ] Cross-protocol trust bridges

## Citations

Built with:
- [Express](https://expressjs.com/) - Web framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [TweetNaCl](https://tweetnacl.js.org/) - Cryptography
- [Joi](https://joi.dev/) - Validation
- [Winston](https://github.com/winstonjs/winston) - Logging
