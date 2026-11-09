BEGIN;

ALTER TABLE restaurant.orders
    ADD COLUMN IF NOT EXISTS arrived_by_user_id INTEGER
        REFERENCES restaurant.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS arrival_qr_revoked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE restaurant.reservations
    ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS arrived_by_user_id INTEGER
        REFERENCES restaurant.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS arrival_qr_revoked_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS orders_receipt_token_unique
    ON restaurant.orders (receipt_token)
    WHERE receipt_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_reservation_token_unique
    ON restaurant.reservations (reservation_token)
    WHERE reservation_token IS NOT NULL;

COMMIT;
