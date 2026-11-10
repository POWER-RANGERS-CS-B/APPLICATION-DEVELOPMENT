BEGIN;

ALTER TABLE restaurant.users
    ADD COLUMN IF NOT EXISTS google_sub TEXT,
    ADD COLUMN IF NOT EXISTS google_full_name TEXT,
    ADD COLUMN IF NOT EXISTS google_picture_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique_idx
    ON restaurant.users (google_sub)
    WHERE google_sub IS NOT NULL;

ALTER TABLE restaurant.users
    DROP CONSTRAINT IF EXISTS users_google_picture_https_check;

ALTER TABLE restaurant.users
    ADD CONSTRAINT users_google_picture_https_check
    CHECK (google_picture_url IS NULL OR google_picture_url ~ '^https://');

COMMIT;
