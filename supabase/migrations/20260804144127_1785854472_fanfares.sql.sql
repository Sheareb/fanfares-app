-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.trip_bookings
  DROP COLUMN seat_paid_amt;