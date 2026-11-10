BEGIN;

ALTER TABLE restaurant.orders
    ADD COLUMN IF NOT EXISTS gcash_reference TEXT,
    ADD COLUMN IF NOT EXISTS gcash_sender_name TEXT,
    ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS payment_rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS dine_in_status TEXT,
    ADD COLUMN IF NOT EXISTS arrival_deadline_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'not_applicable';

DO $$
DECLARE
    status_attnum SMALLINT;
    constraint_row RECORD;
BEGIN
    SELECT attnum INTO status_attnum
    FROM pg_attribute
    WHERE attrelid = 'restaurant.orders'::regclass
      AND attname = 'status'
      AND NOT attisdropped;

    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'restaurant.orders'::regclass
          AND contype = 'c'
          AND conkey @> ARRAY[status_attnum]
    LOOP
        EXECUTE format('ALTER TABLE restaurant.orders DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;

    ALTER TABLE restaurant.orders
        ADD CONSTRAINT orders_status_check
        CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled'));
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'restaurant.orders'::regclass
          AND conname = 'orders_dine_in_status_check'
    ) THEN
        ALTER TABLE restaurant.orders
            ADD CONSTRAINT orders_dine_in_status_check
            CHECK (dine_in_status IS NULL OR dine_in_status IN (
                'pending_verification', 'awaiting_arrival', 'arrived', 'expired', 'rejected'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'restaurant.orders'::regclass
          AND conname = 'orders_refund_amount_check'
    ) THEN
        ALTER TABLE restaurant.orders
            ADD CONSTRAINT orders_refund_amount_check CHECK (refund_amount >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'restaurant.orders'::regclass
          AND conname = 'orders_refund_status_check'
    ) THEN
        ALTER TABLE restaurant.orders
            ADD CONSTRAINT orders_refund_status_check
            CHECK (refund_status IN ('not_applicable', 'pending'));
    END IF;
END
$$;

ALTER TABLE restaurant.customer_notifications
    ADD COLUMN IF NOT EXISTS order_id INTEGER
    REFERENCES restaurant.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_pending_payment_review_idx
    ON restaurant.orders (created_at)
    WHERE deleted_at IS NULL
      AND type = 'dine_in'
      AND payment_status = 'pending_verification';

CREATE UNIQUE INDEX IF NOT EXISTS orders_dine_in_gcash_reference_unique
    ON restaurant.orders (gcash_reference)
    WHERE type = 'dine_in' AND gcash_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_dine_in_expiry_idx
    ON restaurant.orders (arrival_deadline_at)
    WHERE deleted_at IS NULL
      AND dine_in_status = 'awaiting_arrival';

CREATE INDEX IF NOT EXISTS customer_notifications_order_idx
    ON restaurant.customer_notifications (order_id)
    WHERE order_id IS NOT NULL;

COMMIT;
