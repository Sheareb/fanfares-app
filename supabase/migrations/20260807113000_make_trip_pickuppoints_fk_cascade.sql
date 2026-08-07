-- Ensure pickup points are removed automatically when a trip is deleted.
-- This avoids requiring client-side deletes on public.trip_pickuppoints.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trip_pickuppoints_trip_id_fkey'
      AND conrelid = 'public.trip_pickuppoints'::regclass
  ) THEN
    ALTER TABLE public.trip_pickuppoints
      DROP CONSTRAINT trip_pickuppoints_trip_id_fkey;
  END IF;

  ALTER TABLE public.trip_pickuppoints
    ADD CONSTRAINT trip_pickuppoints_trip_id_fkey
    FOREIGN KEY (trip_id)
    REFERENCES public.trips(trip_id)
    ON DELETE CASCADE;
END $$;
