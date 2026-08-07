-- Recreate vw_bookings with the requested column order.

DROP VIEW IF EXISTS public.vw_bookings;

CREATE VIEW public.vw_bookings AS
SELECT
  b.booking_id,
  b.created_at,
  b.trip_id,
  b.pickuppoint_id,
  b.user_id,
  b.customer_name,
  b.seat_price,
  b.paid,
  b.boarded
FROM public.trip_bookings b;

GRANT SELECT ON public.vw_bookings TO anon;
GRANT SELECT ON public.vw_bookings TO authenticated;
GRANT SELECT ON public.vw_bookings TO service_role;
