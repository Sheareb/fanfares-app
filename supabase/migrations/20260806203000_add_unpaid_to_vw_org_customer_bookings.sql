DROP VIEW IF EXISTS public.vw_org_customer_bookings;

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
  b.boarded,
  (
    (t.seat_count::numeric * t.seat_price)
    - (
      SELECT count(*)::numeric * t.seat_price
      FROM public.trip_bookings b_paid
      WHERE b_paid.trip_id = t.trip_id
        AND b_paid.paid = true
    )
  ) AS "Unpaid"
FROM public.trip_bookings b
JOIN public.trips t ON t.trip_id = b.trip_id
LEFT JOIN public.trip_pickuppoints p ON p.pickuppoint_id = b.pickuppoint_id
WHERE t.organiser_id = auth.uid()
ORDER BY t.departure_date, t.departure_time;

GRANT SELECT ON public.vw_org_customer_bookings TO anon;
GRANT SELECT ON public.vw_org_customer_bookings TO authenticated;
GRANT SELECT ON public.vw_org_customer_bookings TO service_role;
