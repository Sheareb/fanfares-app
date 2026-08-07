-- Add boarded tracking for trip bookings and include it in booking views.
ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS boarded boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.vw_customer_bookings AS
SELECT
  b.booking_id,
  b.trip_id,
  b.pickuppoint_id,
  b.user_id,
  b.customer_name,
  b.status,
  t.organiser_id,
  t.description AS trip_description,
  t.departure_date,
  t.departure_time,
  t.total_cost,
  t.seat_count,
  t.seat_price,
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

CREATE OR REPLACE VIEW public.vwbookings AS
SELECT
  b.booking_id,
  b.trip_id,
  b.pickuppoint_id,
  b.user_id,
  b.customer_name,
  b.status,
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
ORDER BY t.departure_date, t.departure_time;

GRANT SELECT ON public.vwbookings TO anon;
GRANT SELECT ON public.vwbookings TO authenticated;
GRANT SELECT ON public.vwbookings TO service_role;
