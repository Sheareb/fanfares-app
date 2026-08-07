DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_org_bookings'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_fan_bookings'
  ) THEN
    EXECUTE 'ALTER VIEW public.vw_org_bookings RENAME TO vw_fan_bookings';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_fan_bookings'
  ) THEN
    GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_fan_bookings TO anon;
    GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.vw_fan_bookings TO authenticated;
    GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_fan_bookings TO service_role;
  END IF;
END $$;
