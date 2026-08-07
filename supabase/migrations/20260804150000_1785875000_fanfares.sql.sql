-- Allow the app's anonymous and authenticated clients to read trip availability rows
GRANT SELECT ON public.trips TO anon;
GRANT SELECT ON public.trips TO authenticated;
GRANT SELECT ON public.trips TO service_role;

CREATE POLICY "Allow public read access to trips"
  ON public.trips
  FOR SELECT
  TO public
  USING (true);
