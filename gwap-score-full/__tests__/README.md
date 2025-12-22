# GwapScore Test Suite

This directory contains comprehensive tests for the GwapScore Trust Protocol.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Test Structure

- `scoring.test.ts` - Tests for the trust score derivation algorithm
- `validation.test.ts` - Tests for input validation schemas
- `crypto.test.ts` - Tests for cryptographic signature verification

## Test Coverage Goals

- Minimum 70% coverage across all metrics
- 100% coverage for scoring algorithm
- 100% coverage for signature verification

## Integration Testing

For integration tests with a real database, ensure PostgreSQL is running:

```bash
# Set test database URL
export DATABASE_URL=postgresql://user:password@localhost:5432/gwapscore_test

# Run integration tests
npm run test:integration
```

## Notes

- Tests use in-memory or mocked database connections by default
- Cryptographic tests use generated test keypairs
- API tests mock authentication middleware
