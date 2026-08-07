-- Replace string booking status with a boolean paid flag.

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_bookings'
      AND column_name = 'status'
  ) THEN
    UPDATE public.trip_bookings
    SET paid = CASE
      WHEN lower(trim(coalesce(status, ''))) = 'paid' THEN true
      ELSE false
    END;
  END IF;
END $$;

ALTER TABLE public.trip_bookings
  ALTER COLUMN paid SET DEFAULT false;

ALTER TABLE public.trip_bookings
  ALTER COLUMN paid SET NOT NULL;

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
    paid,
    customer_name,
    seat_price
  )
  values (
    trip_id,
    pickuppoint_id,
    auth.uid(),
    false,
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

DROP VIEW IF EXISTS public.vw_customer_bookings;
DROP VIEW IF EXISTS public.vw_org_customer_bookings;

CREATE VIEW public.vw_customer_bookings AS
SELECT
  b.booking_id,
  b.trip_id,
  b.pickuppoint_id,
  b.user_id,
  b.customer_name,
  b.paid,
  t.organiser_id,
  t.description AS trip_description,
  t.departure_date,
  t.departure_time,
  t.total_cost,
  t.seat_count,
  t.seat_price AS seat_price,
  p.description AS pickup_description,
  p."time" AS pickup_time,
  b.boarded
FROM public.trip_bookings b
JOIN public.trips t ON t.trip_id = b.trip_id
LEFT JOIN public.trip_pickuppoints p ON p.pickuppoint_id = b.pickuppoint_id
WHERE b.user_id = auth.uid()
ORDER BY t.departure_date, t.departure_time;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_customer_bookings TO anon;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.vw_customer_bookings TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_customer_bookings TO service_role;

CREATE VIEW public.vw_org_customer_bookings AS
SELECT
  b.booking_id,
  b.trip_id,
  b.pickuppoint_id,
  b.user_id,
  b.customer_name,
  b.paid,
  b.seat_price,
  t.organiser_id,
  t.description AS trip_description,
  t.departure_date,
  t.departure_time,
  t.total_cost,
  t.seat_count,
  t.seat_price AS trip_seat_price,
  p.description AS pickup_description,
  p."time" AS pickup_time,
  b.boarded
FROM public.trip_bookings b
JOIN public.trips t ON t.trip_id = b.trip_id
LEFT JOIN public.trip_pickuppoints p ON p.pickuppoint_id = b.pickuppoint_id
WHERE t.organiser_id = auth.uid()
ORDER BY t.departure_date, t.departure_time;

GRANT SELECT ON public.vw_org_customer_bookings TO anon;
GRANT SELECT ON public.vw_org_customer_bookings TO authenticated;
GRANT SELECT ON public.vw_org_customer_bookings TO service_role;

CREATE OR REPLACE VIEW public.vw_organiser_trips AS
SELECT
  t.trip_id,
  t.organiser_id,
  t.description,
  t.departure_date,
  t.departure_time,
  t.total_cost,
  t.seat_count,
  p.pickuppoint_id,
  p.description AS pickup_description,
  p."time" AS pickup_time,
  (
    SELECT count(*)::integer
    FROM public.trip_bookings b
    WHERE b.trip_id = t.trip_id
  ) AS seats_booked,
  (
    SELECT count(*)::integer
    FROM public.trip_bookings b
    WHERE b.pickuppoint_id = p.pickuppoint_id
  ) AS pickup_seats_booked,
  (
    SELECT (count(*))::numeric * t.seat_price
    FROM public.trip_bookings b
    WHERE b.trip_id = t.trip_id
      AND b.paid = true
  ) AS total_paid
FROM public.trips t
LEFT JOIN public.trip_pickuppoints p ON p.trip_id = t.trip_id
WHERE t.organiser_id = auth.uid()
ORDER BY t.departure_date, t.departure_time;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_organiser_trips TO anon;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.vw_organiser_trips TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_organiser_trips TO service_role;

DO $$
DECLARE
  had_vw_bookings boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_bookings'
  ) INTO had_vw_bookings;

  IF had_vw_bookings THEN
    EXECUTE 'DROP VIEW public.vw_bookings';

    EXECUTE $view$
      CREATE VIEW public.vw_bookings AS
      SELECT
        b.booking_id,
        b.trip_id,
        b.pickuppoint_id,
        b.user_id,
        b.customer_name,
        b.paid,
        b.seat_price,
        t.organiser_id,
        t.description AS trip_description,
        t.departure_date,
        t.departure_time,
        t.total_cost,
        t.seat_count,
        t.seat_price AS trip_seat_price,
        p.description AS pickup_description,
        p."time" AS pickup_time,
        b.boarded
      FROM public.trip_bookings b
      JOIN public.trips t ON t.trip_id = b.trip_id
      LEFT JOIN public.trip_pickuppoints p ON p.pickuppoint_id = b.pickuppoint_id
      ORDER BY t.departure_date, t.departure_time
    $view$;

    EXECUTE 'GRANT SELECT ON public.vw_bookings TO anon';
    EXECUTE 'GRANT SELECT ON public.vw_bookings TO authenticated';
    EXECUTE 'GRANT SELECT ON public.vw_bookings TO service_role';
  END IF;
END $$;

ALTER TABLE public.trip_bookings
  DROP COLUMN IF EXISTS status;
