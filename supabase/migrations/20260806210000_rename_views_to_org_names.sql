DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_customer_bookings'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_org_bookings'
  ) THEN
    EXECUTE 'ALTER VIEW public.vw_customer_bookings RENAME TO vw_org_bookings';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_organiser_trips'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_org_trips'
  ) THEN
    EXECUTE 'ALTER VIEW public.vw_organiser_trips RENAME TO vw_org_trips';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_org_bookings'
  ) THEN
    GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_org_bookings TO anon;
    GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.vw_org_bookings TO authenticated;
    GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_org_bookings TO service_role;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'vw_org_trips'
  ) THEN
    GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_org_trips TO anon;
    GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.vw_org_trips TO authenticated;
    GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.vw_org_trips TO service_role;
  END IF;
END $$;
