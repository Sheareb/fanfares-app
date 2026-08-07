-- Keep organiser reporting on vwbookings instead of vw_bookings.
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
WHERE t.organiser_id = auth.uid()
ORDER BY t.departure_date, t.departure_time;

GRANT SELECT ON public.vwbookings TO anon;
GRANT SELECT ON public.vwbookings TO authenticated;
GRANT SELECT ON public.vwbookings TO service_role;
