-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP VIEW public.vw_customer_bookings;

CREATE FUNCTION public.fn_reduce_seat_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
declare
  current_reserved integer;
begin
  -- Get current reserved seat count
  select seat_reserved_count
  into current_reserved
  from public.trips
  where trip_id = new.trip_id;

  -- Prevent going below zero
  if current_reserved <= 0 then
    raise exception 'No seats remaining for this trip';
  end if;

  -- Reduce seat count by 1
  update public.trips
  set seat_reserved_count = seat_reserved_count - 1
  where trip_id = new.trip_id;

  return new;
end;
$function$;

CREATE TRIGGER trg_reduce_seat_count
  AFTER INSERT ON public.trip_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reduce_seat_count();

ALTER TABLE public.trips
  ADD COLUMN total_paid numeric DEFAULT 0;

ALTER TABLE public.trips
  ADD COLUMN seat_reserved_count integer DEFAULT 0;

ALTER TABLE public.trips
  ADD COLUMN remaining_seats integer GENERATED ALWAYS AS ((seat_count - seat_reserved_count)) STORED;

CREATE VIEW public.vw_customer_bookings AS SELECT b.booking_id,
    b.trip_id,
    b.pickuppoint_id,
    b.user_id,
    b.status,
    b.customer_name,
    b.seat_price,
    t.organiser_id,
    t.description AS trip_description,
    t.departure_date,
    t.departure_time,
    t.total_cost,
    t.seat_count,
    t.seat_price AS trip_seat_price,
    p.description AS pickup_description,
    p."time" AS pickup_time
   FROM ((public.trip_bookings b
     JOIN public.trips t ON ((t.trip_id = b.trip_id)))
     LEFT JOIN public.trip_pickuppoints p ON ((p.pickuppoint_id = b.pickuppoint_id)))
  WHERE (b.user_id = auth.uid())
  ORDER BY t.departure_date, t.departure_time;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_customer_bookings TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_customer_bookings TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_customer_bookings TO service_role;