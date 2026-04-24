-- ╔══════════════════════════════════════════════════════════════╗
-- ║              UNI-VOTE — Migration initiale                  ║
-- ║              001_init.sql                                    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── Extension UUID ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users (Admins) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(50) DEFAULT 'admin',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Events (Scrutins) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    type            VARCHAR(20) NOT NULL DEFAULT 'free',
    price_per_vote  INTEGER DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'draft',
    show_results    BOOLEAN DEFAULT false,
    opens_at        TIMESTAMP WITH TIME ZONE,
    closes_at       TIMESTAMP WITH TIME ZONE,
    banner_url      VARCHAR(500),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Candidates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    bio         TEXT,
    dossard     VARCHAR(20),
    photo_url   VARCHAR(500),
    gallery     JSONB DEFAULT '[]',
    vote_count  INTEGER DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_candidates_event_id ON candidates(event_id);

-- ─── Transactions (Paiements) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id      UUID REFERENCES candidates(id),
    event_id          UUID REFERENCES events(id),
    phone_number      VARCHAR(20) NOT NULL,
    operator          VARCHAR(20),
    amount            INTEGER NOT NULL,
    vote_count        INTEGER NOT NULL,
    notchpay_ref      VARCHAR(255) UNIQUE,
    idempotency_key   VARCHAR(255) UNIQUE,
    status            VARCHAR(20) DEFAULT 'pending',
    webhook_verified  BOOLEAN DEFAULT false,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_candidate_id ON transactions(candidate_id);
CREATE INDEX idx_transactions_event_id ON transactions(event_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_notchpay_ref ON transactions(notchpay_ref);

-- ─── Audit Logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(255) NOT NULL,
    target      VARCHAR(255),
    details     JSONB,
    ip_address  VARCHAR(50),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
