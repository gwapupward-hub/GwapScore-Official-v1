-- GwapScore v2 wallet-intelligence evidence storage.
-- These rows are written through the privileged adapter path and are separate
-- from generic profile claims so arbitrary claim writes cannot self-award a
-- wallet reputation contribution.

CREATE TABLE IF NOT EXISTS wallet_intelligence_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    wallet_address VARCHAR(64) NOT NULL,
    ownership_verified BOOLEAN NOT NULL DEFAULT FALSE,
    wallet_age_days INTEGER NOT NULL CHECK (wallet_age_days >= 0),
    tx_count BIGINT NOT NULL CHECK (tx_count >= 0),
    source VARCHAR(100) NOT NULL,
    provenance JSONB NOT NULL DEFAULT '{}',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_intelligence_user_captured
    ON wallet_intelligence_snapshots(user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_intelligence_wallet_captured
    ON wallet_intelligence_snapshots(wallet_address, captured_at DESC);
