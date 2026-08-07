create view public.vw_organiser_trips as
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
  p."time" as pickup_time,
  (
    select
      count(*) as count
    from
      trip_bookings b
    where
      b.trip_id = t.trip_id
  ) as seats_booked,
  (
    select
      count(*)::numeric * t.seat_price
    from
      trip_bookings b
    where
      b.trip_id = t.trip_id
      and b.status = 'paid'::text
  ) as total_paid
from
  trips t
  left join trip_pickuppoints p on p.trip_id = t.trip_id
where
  t.organiser_id = auth.uid ()
order by
  t.departure_date,
  t.departure_time;