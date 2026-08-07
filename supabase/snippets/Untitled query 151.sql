create trigger trg_reduce_seat_count
after insert on public.trip_bookings
for each row
execute function public.fn_reduce_seat_count();
