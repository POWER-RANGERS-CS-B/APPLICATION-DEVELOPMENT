BEGIN;

ALTER TABLE restaurant.reservations
    ADD COLUMN IF NOT EXISTS reservation_rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS reservations_pending_review_created_idx
    ON restaurant.reservations (created_at)
    WHERE deleted_at IS NULL AND status = 'pending_verification';

COMMIT;
