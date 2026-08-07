-- Grant UPDATE privilege so the RLS policy can actually execute
GRANT UPDATE ON public.trip_bookings TO authenticated;
