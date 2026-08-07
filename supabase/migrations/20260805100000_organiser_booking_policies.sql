-- Allow organisers to read and update bookings for trips they own
CREATE POLICY "organisers_can_read_own_trip_bookings"
  ON public.trip_bookings
  FOR SELECT
  TO authenticated
  USING (
    trip_id IN (
      SELECT trip_id FROM public.trips WHERE organiser_id = auth.uid()
    )
  );

CREATE POLICY "organisers_can_update_own_trip_bookings"
  ON public.trip_bookings
  FOR UPDATE
  TO authenticated
  USING (
    trip_id IN (
      SELECT trip_id FROM public.trips WHERE organiser_id = auth.uid()
    )
  )
  WITH CHECK (
    trip_id IN (
      SELECT trip_id FROM public.trips WHERE organiser_id = auth.uid()
    )
  );
