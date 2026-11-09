BEGIN;

ALTER TABLE restaurant.orders
    ADD COLUMN IF NOT EXISTS table_id INTEGER
    REFERENCES restaurant.restaurant_tables (id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_table_id_idx
    ON restaurant.orders (table_id)
    WHERE table_id IS NOT NULL;

COMMIT;
