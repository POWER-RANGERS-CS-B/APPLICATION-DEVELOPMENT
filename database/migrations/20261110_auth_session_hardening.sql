BEGIN;

CREATE TABLE IF NOT EXISTS restaurant.revoked_auth_tokens (
    token_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES restaurant.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS revoked_auth_tokens_expiry_idx
    ON restaurant.revoked_auth_tokens (expires_at);

DELETE FROM restaurant.revoked_auth_tokens
WHERE expires_at <= CURRENT_TIMESTAMP;

COMMIT;
