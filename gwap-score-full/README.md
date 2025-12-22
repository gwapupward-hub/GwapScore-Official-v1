<p align="center">
  <img src="../assets/brand/logo.png" alt="GwapScore Logo" width="200" />
</p>

# GwapScore Trust Protocol v1.0

GwapScore is a **trust protocol**, not an app. It derives explainable reputation from verifiable claims, behavioral events, and signed attestations — without storing mutable scores or deleting history.

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
