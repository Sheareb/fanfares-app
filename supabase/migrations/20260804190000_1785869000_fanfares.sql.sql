-- Migration unit 1: seat_capacity_fix
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP TRIGGER IF EXISTS trg_reduce_seat_count ON public.trip_bookings;
DROP FUNCTION IF EXISTS public.fn_reduce_seat_count();

CREATE FUNCTION public.fn_reduce_seat_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
declare
  current_reserved integer;
  total_capacity integer;
begin
  select
    coalesce(seat_reserved_count, 0),
    coalesce(seat_count, 0)
  into current_reserved, total_capacity
  from public.trips
  where trip_id = new.trip_id;

  if total_capacity <= 0 then
    raise exception 'No seats available for this trip';
  end if;

  if current_reserved >= total_capacity then
    raise exception 'No seats available for this trip';
  end if;

  update public.trips
  set seat_reserved_count = coalesce(seat_reserved_count, 0) + 1
  where trip_id = new.trip_id;

  return new;
end;
$function$;

CREATE TRIGGER trg_reduce_seat_count
  AFTER INSERT ON public.trip_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reduce_seat_count();
