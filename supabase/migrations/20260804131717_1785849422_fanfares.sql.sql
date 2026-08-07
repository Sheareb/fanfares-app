-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.trip_bookings
  ALTER COLUMN seat_price SET NOT NULL;
