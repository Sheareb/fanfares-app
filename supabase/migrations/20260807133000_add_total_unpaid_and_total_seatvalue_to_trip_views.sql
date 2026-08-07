-- Add total_unpaid to customer trip view and rename paidamt -> total_seatvalue.
-- Keep compatibility by still exposing unpaid on organiser view.

DROP VIEW IF EXISTS public.vw_org_trips;

CREATE VIEW public.vw_org_trips AS
SELECT
  t.trip_id,
  t.organiser_id,
  t.description,
  t.departure_date,
  t.departure_time,
  t.total_cost,
  t.seat_count,
  t.seat_price,
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
    t.seat_price * (
      SELECT count(*)::numeric
      FROM public.trip_bookings b
      WHERE b.trip_id = t.trip_id
    )
  ) AS total_seatvalue,
  (
    SELECT count(*)::numeric * t.seat_price
    FROM public.trip_bookings b
    WHERE b.trip_id = t.trip_id
      AND b.paid = true
  ) AS total_paid,
  (
    (t.seat_count::numeric * t.seat_price)
    - (
      SELECT count(*)::numeric * t.seat_price
      FROM public.trip_bookings b
      WHERE b.trip_id = t.trip_id
        AND b.paid = true
    )
  ) AS total_unpaid,
  (
    (t.seat_count::numeric * t.seat_price)
    - (
      SELECT count(*)::numeric * t.seat_price
      FROM public.trip_bookings b
      WHERE b.trip_id = t.trip_id
        AND b.paid = true
    )
  ) AS unpaid
FROM public.trips t
LEFT JOIN public.trip_pickuppoints p ON p.trip_id = t.trip_id
WHERE t.organiser_id = auth.uid()
ORDER BY t.departure_date, t.departure_time;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_org_trips TO anon;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.vw_org_trips TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_org_trips TO service_role;

DROP VIEW IF EXISTS public.vw_customer_trips;

CREATE VIEW public.vw_customer_trips AS
SELECT
  t.trip_id,
  t.organiser_id,
  t.description,
  t.departure_date,
  t.departure_time,
  t.total_cost,
  t.seat_count,
  t.seat_price,
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
    t.seat_price * (
      SELECT count(*)::numeric
      FROM public.trip_bookings b
      WHERE b.trip_id = t.trip_id
    )
  ) AS total_seatvalue,
  (
    SELECT count(*)::numeric * t.seat_price
    FROM public.trip_bookings b
    WHERE b.trip_id = t.trip_id
      AND b.paid = true
  ) AS total_paid,
  (
    (t.seat_count::numeric * t.seat_price)
    - (
      SELECT count(*)::numeric * t.seat_price
      FROM public.trip_bookings b
      WHERE b.trip_id = t.trip_id
        AND b.paid = true
    )
  ) AS total_unpaid
FROM public.trips t
LEFT JOIN public.trip_pickuppoints p ON p.trip_id = t.trip_id
ORDER BY t.departure_date, t.departure_time;

GRANT SELECT ON public.vw_customer_trips TO anon;
GRANT SELECT ON public.vw_customer_trips TO authenticated;
GRANT SELECT ON public.vw_customer_trips TO service_role;
