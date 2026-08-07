-- Allow authenticated organisers to delete only their own trips.

GRANT DELETE ON public.trips TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trips'
      AND policyname = 'organisers_can_delete_own_trips'
  ) THEN
    CREATE POLICY "organisers_can_delete_own_trips"
      ON public.trips
      FOR DELETE
      TO authenticated
      USING (organiser_id = auth.uid());
  END IF;
END $$;
