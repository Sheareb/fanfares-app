create or replace view public.vw_trips as
select
    t.trip_id,
    t.organiser_id,
    t.description,
    t.departure_date,
    t.departure_time,
    t.total_cost,
    t.seat_count,
    t.seat_price,
    p.pickuppoint_id,
    p.description as pickup_description,
    p.time as pickup_time
from public.trips t
left join public.trip_pickuppoints p
    on p.trip_id = t.trip_id
order by
    t.departure_date,
    t.departure_time;
