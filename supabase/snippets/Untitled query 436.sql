create or replace function public.book_seat(
  trip_id uuid,
  pickuppoint_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_booking_id uuid;
begin
  insert into public.trip_bookings (
    trip_id,
    pickuppoint_id,
    user_id,
    booked_at,
    status
  )
  values (
    trip_id,
    pickuppoint_id,
    auth.uid(),
    now(),
    'pending'
  )
  returning booking_id into new_booking_id;

  return new_booking_id;
end;
$$;

