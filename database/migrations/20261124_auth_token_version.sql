BEGIN;

ALTER TABLE restaurant.users
    ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'restaurant.users'::regclass
          AND conname = 'users_auth_version_nonnegative'
    ) THEN
        ALTER TABLE restaurant.users
            ADD CONSTRAINT users_auth_version_nonnegative
            CHECK (auth_version >= 0);
    END IF;
END
$$;

COMMIT;
