-- ============================================================
--  Migration: add Google Sign-In support to an EXISTING database
--  Run this once if you already ran setup-db.js before this change:
--    psql -U postgres -d nexus_db -f src/config/migration_google_auth.sql
-- ============================================================

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
