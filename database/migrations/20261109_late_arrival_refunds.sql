BEGIN;

ALTER TABLE restaurant.orders
    ADD COLUMN IF NOT EXISTS refund_completed_by_user_id INTEGER
        REFERENCES restaurant.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE restaurant.orders
    DROP CONSTRAINT IF EXISTS orders_refund_status_check;

ALTER TABLE restaurant.orders
    ADD CONSTRAINT orders_refund_status_check
    CHECK (refund_status IN ('not_applicable', 'pending', 'completed'));

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
        EXECUTE format('ALTER TABLE restaurant.users DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;

    ALTER TABLE restaurant.users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('staff', 'cashier', 'admin', 'customer'));
END
$$;

CREATE INDEX IF NOT EXISTS orders_refund_status_idx
    ON restaurant.orders (refund_status, arrived_at)
    WHERE deleted_at IS NULL AND type = 'dine_in';

COMMIT;
