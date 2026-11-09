BEGIN;

ALTER TABLE restaurant.orders
    ADD COLUMN IF NOT EXISTS refund_processing_by_user_id INTEGER
        REFERENCES restaurant.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS refund_processing_started_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE restaurant.orders
    DROP CONSTRAINT IF EXISTS orders_refund_status_check;

ALTER TABLE restaurant.orders
    ADD CONSTRAINT orders_refund_status_check
    CHECK (refund_status IN ('not_applicable', 'pending', 'processing', 'completed'));

CREATE INDEX IF NOT EXISTS orders_refund_status_idx
    ON restaurant.orders (refund_status, arrived_at)
    WHERE deleted_at IS NULL AND type = 'dine_in';

COMMIT;
