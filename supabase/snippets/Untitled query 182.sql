create or replace view public.vw_customer_bookings as
select
    b.booking_id,
    b.trip_id,
    b.pickuppoint_id,
    b.user_id,
    b.customer_name,
    b.status,

    -- Trip details
    t.organiser_id,
    t.description as trip_description,
    t.departure_date,
    t.departure_time,
    t.total_cost,
    t.seat_count,
    t.seat_price,

    -- Pickup point details
    p.description as pickup_description,
    p.time as pickup_time

from public.trip_bookings b
join public.trips t
    on t.trip_id = b.trip_id
left join public.trip_pickuppoints p
    on p.pickuppoint_id = b.pickuppoint_id
where b.user_id = auth.uid()
order by
    t.departure_date asc,
    t.departure_time asc;
