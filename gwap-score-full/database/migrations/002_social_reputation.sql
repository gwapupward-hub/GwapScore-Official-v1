ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)
    REFERENCES trust_profiles(subject_id) ON DELETE CASCADE;

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
