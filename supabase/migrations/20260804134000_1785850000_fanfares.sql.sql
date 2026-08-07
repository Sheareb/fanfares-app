-- Migration unit 1: booking_schema_compatibility
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS trip_id uuid;

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS customer_name text;

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS seat_price numeric;

ALTER TABLE public.trip_bookings
  ALTER COLUMN status SET DEFAULT 'Pending payment';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trips'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trip_bookings_trip_id_fkey'
  ) THEN
    ALTER TABLE public.trip_bookings
      ADD CONSTRAINT trip_bookings_trip_id_fkey
      FOREIGN KEY (trip_id) REFERENCES public.trips(trip_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.book_seat (
  trip_id uuid,
  pickuppoint_id uuid,
  customer_name text,
  seat_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  new_booking_id uuid;
begin
  insert into public.trip_bookings (
    trip_id,
    pickuppoint_id,
    user_id,
    status,
    customer_name,
    seat_price
  )
  values (
    trip_id,
    pickuppoint_id,
    auth.uid(),
    'Pending payment',
    coalesce(customer_name, ''),
    seat_price
  )
  returning booking_id into new_booking_id;

  return new_booking_id;
end;
$$;

GRANT EXECUTE ON FUNCTION public.book_seat(uuid, uuid, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.book_seat (
  trip_id uuid,
  pickuppoint_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  select public.book_seat(trip_id, pickuppoint_id, '', 0);
$$;

GRANT EXECUTE ON FUNCTION public.book_seat(uuid, uuid) TO authenticated;
