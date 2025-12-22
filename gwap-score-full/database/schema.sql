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
