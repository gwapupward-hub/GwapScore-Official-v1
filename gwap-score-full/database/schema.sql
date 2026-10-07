-- GwapScore Trust Protocol Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trust Profiles table
CREATE TABLE IF NOT EXISTS trust_profiles (
    subject_id VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_created ON trust_profiles(created_at);

-- Claims table (append-only)
CREATE TABLE IF NOT EXISTS claims (
    claim_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    source VARCHAR(100) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_expires_after_issued CHECK (expires_at IS NULL OR expires_at > issued_at)
);

CREATE INDEX idx_claims_subject ON claims(subject_id);
CREATE INDEX idx_claims_type ON claims(type);
CREATE INDEX idx_claims_issued ON claims(issued_at DESC);
CREATE INDEX idx_claims_expires ON claims(expires_at) WHERE expires_at IS NOT NULL;

-- Events table (append-only)
CREATE TABLE IF NOT EXISTS events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    source VARCHAR(100) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_subject ON events(subject_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_issued ON events(issued_at DESC);

-- Attestations table (append-only)
CREATE TABLE IF NOT EXISTS attestations (
    attestation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    issuer_id VARCHAR(255) NOT NULL,
    scope VARCHAR(100) NOT NULL,
    weight DECIMAL(10, 4) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    signature TEXT NOT NULL,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_weight_positive CHECK (weight >= 0),
    CONSTRAINT chk_attestation_expires CHECK (expires_at IS NULL OR expires_at > issued_at)
);

CREATE INDEX idx_attestations_subject ON attestations(subject_id);
CREATE INDEX idx_attestations_issuer ON attestations(issuer_id);
CREATE INDEX idx_attestations_issued ON attestations(issued_at DESC);
CREATE INDEX idx_attestations_expires ON attestations(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_attestations_verified ON attestations(signature_verified);

-- API Keys table for authentication
CREATE TABLE IF NOT EXISTS api_keys (
    key_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active, expires_at);

-- Trusted Issuers table
CREATE TABLE IF NOT EXISTS trusted_issuers (
    issuer_id VARCHAR(255) PRIMARY KEY,
    public_key TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_weight DECIMAL(10, 4) NOT NULL DEFAULT 1.0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trusted_issuers_active ON trusted_issuers(is_active);

-- Audit log for immutability tracking
CREATE TABLE IF NOT EXISTS audit_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for trust_profiles
CREATE TRIGGER update_trust_profiles_updated_at
    BEFORE UPDATE ON trust_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for trusted_issuers
CREATE TRIGGER update_trusted_issuers_updated_at
    BEFORE UPDATE ON trusted_issuers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to prevent deletion (enforce append-only)
CREATE OR REPLACE FUNCTION prevent_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Deletion is not allowed on append-only tables';
END;
$$ language 'plpgsql';

-- Prevent deletions on append-only tables
CREATE TRIGGER prevent_claims_deletion
    BEFORE DELETE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION prevent_deletion();

CREATE TRIGGER prevent_events_deletion
    BEFORE DELETE ON events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_deletion();

CREATE TRIGGER prevent_attestations_deletion
    BEFORE DELETE ON attestations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_deletion();

-- Insert audit log entries automatically
CREATE OR REPLACE FUNCTION log_append_only_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, metadata)
    VALUES (
        TG_TABLE_NAME,
        CASE TG_TABLE_NAME
            WHEN 'claims' THEN NEW.claim_id
            WHEN 'events' THEN NEW.event_id
            WHEN 'attestations' THEN NEW.attestation_id
        END,
        'INSERT',
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER audit_claims_insert
    AFTER INSERT ON claims
    FOR EACH ROW
    EXECUTE FUNCTION log_append_only_insert();

CREATE TRIGGER audit_events_insert
    AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION log_append_only_insert();

CREATE TRIGGER audit_attestations_insert
    AFTER INSERT ON attestations
    FOR EACH ROW
    EXECUTE FUNCTION log_append_only_insert();

-- Social reputation data is scoped to an existing GwapScore user profile.
CREATE TABLE IF NOT EXISTS social_accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    platform VARCHAR(40) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (platform, platform_user_id),
    UNIQUE (user_id, platform, platform_user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_created ON social_accounts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_created ON social_accounts(platform, created_at DESC);

CREATE TABLE IF NOT EXISTS oauth_tokens (
    account_id UUID PRIMARY KEY REFERENCES social_accounts(account_id) ON DELETE CASCADE,
    encrypted_access_token TEXT NOT NULL,
    access_token_iv TEXT NOT NULL,
    access_token_auth_tag TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    refresh_token_iv TEXT,
    refresh_token_auth_tag TEXT,
    token_expires_at TIMESTAMPTZ,
    refresh_expires_at TIMESTAMPTZ,
    scopes JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_updated ON oauth_tokens(updated_at DESC);

CREATE TABLE IF NOT EXISTS consent_records (
    consent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    platform VARCHAR(40) NOT NULL,
    scopes JSONB NOT NULL,
    policy_version VARCHAR(40) NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consent_user_created ON consent_records(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_platform_created ON consent_records(platform, created_at DESC);
ALTER TABLE social_accounts
    ADD COLUMN IF NOT EXISTS consent_id UUID REFERENCES consent_records(consent_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS social_profile_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES social_accounts(account_id) ON DELETE CASCADE,
    platform VARCHAR(40) NOT NULL,
    metrics JSONB NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_profile_user_created ON social_profile_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_profile_platform_created ON social_profile_snapshots(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_profile_account_captured ON social_profile_snapshots(account_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS social_content_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES social_accounts(account_id) ON DELETE CASCADE,
    platform VARCHAR(40) NOT NULL,
    platform_content_id VARCHAR(255) NOT NULL,
    published_at TIMESTAMPTZ,
    metrics JSONB NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (account_id, platform_content_id, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_social_content_user_created ON social_content_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_content_platform_created ON social_content_snapshots(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_content_account_captured ON social_content_snapshots(account_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS reputation_scores (
    score_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    account_id UUID REFERENCES social_accounts(account_id) ON DELETE CASCADE,
    platform VARCHAR(40),
    score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    grade CHAR(1) NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
    subscores JSONB NOT NULL,
    explanation JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reputation_scores_user_created ON reputation_scores(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_scores_platform_created ON reputation_scores(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_scores_account_created ON reputation_scores(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES trust_profiles(subject_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES social_accounts(account_id) ON DELETE CASCADE,
    platform VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
    error_message TEXT,
    next_retry_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ingestion_user_created ON ingestion_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_platform_created ON ingestion_jobs(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_status_retry ON ingestion_jobs(status, next_retry_at);

-- GwapScore v2 Wallet Intelligence evidence. This table is intentionally
-- separate from generic claims; only privileged adapter ingestion should write
-- evidence that can influence the wallet-reputation dimension.
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
