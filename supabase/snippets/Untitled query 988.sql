create or replace function public.fn_reduce_seat_count()
returns trigger
language plpgsql
as $$
declare
  current_reserved integer;
begin
  -- Get current reserved seat count
  select seat_reserved_count
  into current_reserved
  from public.trips
  where trip_id = new.trip_id;

  -- Prevent going below zero
  if current_reserved <= 0 then
    raise exception 'No seats remaining for this trip';
  end if;

  -- Reduce seat count by 1
  update public.trips
  set seat_reserved_count = seat_reserved_count - 1
  where trip_id = new.trip_id;

  return new;
end;
$$;
