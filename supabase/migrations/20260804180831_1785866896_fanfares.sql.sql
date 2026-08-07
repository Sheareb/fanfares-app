-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP FUNCTION public.book_seat(trip_id uuid, pickuppoint_id uuid, customer_name text);

DROP FUNCTION public.book_seat(trip_id uuid, pickuppoint_id uuid);

CREATE VIEW public.vw_customer_bookings AS SELECT b.booking_id,
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
    p."time" AS pickup_time
   FROM ((public.trip_bookings b
     JOIN public.trips t ON ((t.trip_id = b.trip_id)))
     LEFT JOIN public.trip_pickuppoints p ON ((p.pickuppoint_id = b.pickuppoint_id)))
  WHERE (b.user_id = auth.uid())
  ORDER BY t.departure_date, t.departure_time;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_customer_bookings TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.vw_customer_bookings TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_customer_bookings TO service_role;