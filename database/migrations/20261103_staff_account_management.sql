-- Add unique staff usernames without deleting or rewriting user accounts.
CREATE SCHEMA IF NOT EXISTS restaurant;

ALTER TABLE restaurant.users
    ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE restaurant.users
SET username = 'user_' || id::TEXT
WHERE username IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM restaurant.users
        GROUP BY lower(username)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add unique usernames: duplicate usernames already exist.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM restaurant.users
        GROUP BY lower(email)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add case-insensitive email uniqueness: duplicate email addresses already exist.';
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique_idx
    ON restaurant.users (lower(username))
    WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
    ON restaurant.users (lower(email));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_staff_username_required'
          AND conrelid = 'restaurant.users'::regclass
    ) THEN
        ALTER TABLE restaurant.users
            ADD CONSTRAINT users_staff_username_required
            CHECK (role <> 'staff' OR username IS NOT NULL);
    END IF;
END
$$;
