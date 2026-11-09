BEGIN;

ALTER TABLE restaurant.restaurant_tables
    DROP CONSTRAINT IF EXISTS restaurant_tables_status_check;

ALTER TABLE restaurant.restaurant_tables
    ADD CONSTRAINT restaurant_tables_status_check
    CHECK (status IN (
        'vacant',
        'reserved',
        'locked',
        'occupied',
        'needs_cleaning',
        'cleaning'
    ));

COMMIT;
