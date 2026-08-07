create or replace view public.vw_organiser_trips as
select
    t.trip_id,
    t.organiser_id,
    t.description,
    t.departure_date,
    t.departure_time,
    t.total_cost,
    t.seat_count,
    p.pickuppoint_id,
    p.description as pickup_description,
    p.time as pickup_time,

    -- total seats booked for this trip
    (
        select count(*)
        from public.trip_bookings b
        where b.trip_id = t.trip_id
    ) as seats_booked,

    -- total paid amount for this trip
    (
        select coalesce(sum(b.paid_amount), 0)
        from public.trip_bookings b
        where b.trip_id = t.trip_id
          and b.status = 'paid'
    ) as total_paid

from public.trips t
left join public.trip_pickuppoints p
    on p.trip_id = t.trip_id
where t.organiser_id = auth.uid()
order by
    t.departure_date,
    t.departure_time;
