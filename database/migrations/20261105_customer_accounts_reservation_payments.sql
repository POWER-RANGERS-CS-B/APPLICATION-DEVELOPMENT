BEGIN;

ALTER TABLE restaurant.users
    ADD COLUMN IF NOT EXISTS contact_number TEXT;

ALTER TABLE restaurant.reservations
    ADD COLUMN IF NOT EXISTS gcash_sender_name TEXT;

ALTER TABLE restaurant.reservations
    ADD COLUMN IF NOT EXISTS reservation_rejection_reason TEXT;

DO $$
DECLARE
    role_attnum SMALLINT;
    constraint_row RECORD;
BEGIN
    SELECT attnum INTO role_attnum
    FROM pg_attribute
    WHERE attrelid = 'restaurant.users'::regclass
      AND attname = 'role'
      AND NOT attisdropped;

    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'restaurant.users'::regclass
          AND contype = 'c'
          AND conkey @> ARRAY[role_attnum]
    LOOP
        EXECUTE format(
            'ALTER TABLE restaurant.users DROP CONSTRAINT %I',
            constraint_row.conname
        );
    END LOOP;

    ALTER TABLE restaurant.users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('staff', 'admin', 'customer'));
END
$$;

CREATE INDEX IF NOT EXISTS reservations_pending_review_created_idx
    ON restaurant.reservations (created_at)
    WHERE deleted_at IS NULL AND status = 'pending_verification';

COMMIT;
