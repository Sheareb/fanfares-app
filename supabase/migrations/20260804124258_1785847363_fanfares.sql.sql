-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

ALTER TABLE public.trip_bookings
  DROP CONSTRAINT trip_bookings_trip_id_fkey;

ALTER TABLE public.trip_bookings
  DROP COLUMN fk_trip_booking;

CREATE FUNCTION public.book_seat (
  trip_id        uuid,
  pickuppoint_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
declare
  new_booking_id uuid;
begin
  insert into public.trip_bookings (
    trip_id,
    pickuppoint_id,
    user_id,
    booked_at,
    status
  )
  values (
    trip_id,
    pickuppoint_id,
    auth.uid(),
    now(),
    'pending'
  )
  returning booking_id into new_booking_id;

  return new_booking_id;
end;
$function$;

GRANT ALL ON FUNCTION public.book_seat(uuid, uuid) TO authenticated;

ALTER TABLE public.trip_bookings
  ADD COLUMN trip_id uuid NOT NULL;

ALTER TABLE public.trip_bookings
  ADD CONSTRAINT trip_bookings_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(trip_id);

ALTER TABLE public.trip_bookings
  ADD COLUMN customer_name text NOT NULL;

GRANT SELECT ON public.trip_bookings TO authenticated;