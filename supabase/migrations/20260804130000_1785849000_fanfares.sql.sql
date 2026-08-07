-- Migration unit 1: booking_function_update
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION public.book_seat (
  trip_id uuid,
  pickuppoint_id uuid,
  customer_name text
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
    booked_at,
    status,
    customer_name
  )
  values (
    trip_id,
    pickuppoint_id,
    auth.uid(),
    now(),
    'pending',
    customer_name
  )
  returning booking_id into new_booking_id;

  return new_booking_id;
end;
$$;

GRANT EXECUTE ON FUNCTION public.book_seat(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.book_seat (
  trip_id uuid,
  pickuppoint_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  select public.book_seat(trip_id, pickuppoint_id, '');
$$;

GRANT EXECUTE ON FUNCTION public.book_seat(uuid, uuid) TO authenticated;
