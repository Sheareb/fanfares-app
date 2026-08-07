-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE VIEW public.vw_organiser_trips AS SELECT t.trip_id,
    t.organiser_id,
    t.description,
    t.departure_date,
    t.departure_time,
    t.total_cost,
    t.seat_count,
    t.seat_price,
    p.pickuppoint_id,
    p.description AS pickup_description,
    p."time" AS pickup_time
   FROM (public.trips t
     LEFT JOIN public.trip_pickuppoints p ON ((p.trip_id = t.trip_id)))
  WHERE (t.organiser_id = auth.uid());

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_organiser_trips TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.vw_organiser_trips TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_organiser_trips TO service_role;