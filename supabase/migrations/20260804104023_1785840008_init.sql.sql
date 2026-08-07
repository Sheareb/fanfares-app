-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE SCHEMA audit AUTHORIZATION postgres;

CREATE SEQUENCE audit.audit_log_id_seq;

CREATE FUNCTION audit.log_event (
  p_event_type text,
  p_message    text,
  p_table_name text DEFAULT NULL::text,
  p_record_id  uuid DEFAULT NULL::uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
begin
  insert into audit.audit_log (
    event_type,
    message,
    table_name,
    record_id,
    triggered_by
  )
  values (
    p_event_type,
    p_message,
    p_table_name,
    p_record_id,
    auth.uid()
  );
end;
$function$;

CREATE FUNCTION audit.log_trigger()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
begin
  insert into audit.audit_log (
    event_type,
    table_name,
    record_id,
    old_data,
    new_data,
    triggered_by
  )
  values (
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    to_jsonb(old),
    to_jsonb(new),
    auth.uid()
  );

  if (tg_op = 'DELETE') then
    return old;
  else
    return new;
  end if;
end;
$function$;

CREATE TABLE audit.audit_log (
  id           bigint                   DEFAULT nextval('audit.audit_log_id_seq'::regclass) NOT NULL,
  event_type   text                     NOT NULL,
  table_name   text,
  record_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  message      text,
  triggered_by uuid,
  created_at   timestamp with time zone DEFAULT now()
);

ALTER SEQUENCE audit.audit_log_id_seq OWNED BY audit.audit_log.id;

ALTER TABLE audit.audit_log
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.audit_log
  ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE audit.audit_log
  ADD CONSTRAINT audit_log_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES auth.users(id);

CREATE POLICY "allow inserts from triggers" ON audit.audit_log
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service role only" ON audit.audit_log
  FOR SELECT
  USING ((auth.role() = 'service_role'::text));

CREATE FUNCTION public.create_trip_with_pickups (
  pickup_points jsonb,
  trip_data     jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
declare
  new_trip_id uuid;
begin
  insert into public.trips (
    organiser_id,
    description,
    departure_date,
    departure_time,
    total_cost,
    seat_count,
    seat_price
  )
  values (
    (trip_data->>'organiser_id')::uuid,
    trip_data->>'description',
    (trip_data->>'departure_date')::date,
    (trip_data->>'departure_time')::time,
    (trip_data->>'total_cost')::numeric,
    (trip_data->>'seat_count')::int,
    (trip_data->>'seat_price')::numeric
  )
  returning trip_id into new_trip_id;

  insert into public.trip_pickuppoints (trip_id, description, time)
  select
    new_trip_id,
    p->>'description',
    (p->>'time')::time
  from jsonb_array_elements(pickup_points) as p;

  return new_trip_id;
end;
$function$;

GRANT ALL ON FUNCTION public.create_trip_with_pickups(jsonb, jsonb) TO authenticated;

CREATE TABLE public.profiles (
  id             uuid                        NOT NULL,
  full_name      text,
  "Is_organiser" boolean                     NOT NULL,
  created_at     timestamp without time zone DEFAULT now()
);

COMMENT ON COLUMN public.profiles."Is_organiser" IS 'Is the user an organiser';

ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.profiles TO anon;

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.profiles TO service_role;

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can select their own profile" ON public.profiles
  FOR SELECT
  USING ((auth.uid() = id));

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING ((auth.uid() = id));

CREATE TABLE public.trip_bookings (
  booking_id      uuid                     DEFAULT gen_random_uuid() NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  fk_trip_booking uuid                     NOT NULL,
  pickuppoint_id  uuid                     NOT NULL,
  user_id         uuid                     DEFAULT auth.uid() NOT NULL,
  seat_price      numeric                  NOT NULL,
  seat_paid_amt   numeric                  NOT NULL
);

ALTER TABLE public.trip_bookings
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.trip_bookings
  ADD CONSTRAINT trip_bookings_pkey PRIMARY KEY (booking_id);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.trip_bookings TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.trip_bookings TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.trip_bookings TO service_role;

CREATE TABLE public.trip_pickuppoints (
  pickuppoint_id uuid                     DEFAULT gen_random_uuid() NOT NULL,
  trip_id        uuid                     NOT NULL,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  description    text,
  "time"         time without time zone
);

ALTER TABLE public.trip_pickuppoints
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.trip_pickuppoints
  ADD CONSTRAINT trip_pickuppoints_pkey PRIMARY KEY (pickuppoint_id);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.trip_pickuppoints TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.trip_pickuppoints TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.trip_pickuppoints TO service_role;

CREATE TABLE public.trips (
  trip_id        uuid                     DEFAULT gen_random_uuid() NOT NULL,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  organiser_id   uuid                     DEFAULT auth.uid() NOT NULL,
  description    text                     NOT NULL,
  departure_date date                     NOT NULL,
  departure_time time without time zone   NOT NULL,
  total_cost     numeric                  DEFAULT '0'::numeric,
  seat_count     smallint                 NOT NULL,
  seat_price     numeric                  NOT NULL
);

ALTER TABLE public.trips
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_pkey PRIMARY KEY (trip_id);

ALTER TABLE public.trip_bookings
  ADD CONSTRAINT trip_bookings_trip_id_fkey FOREIGN KEY (fk_trip_booking) REFERENCES public.trips(trip_id);

ALTER TABLE public.trip_pickuppoints
  ADD CONSTRAINT trip_pickuppoints_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(trip_id);

ALTER TABLE public.trips
  ADD CONSTRAINT trips_seat_count_check CHECK (seat_count > 0);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.trips TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.trips TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.trips TO service_role;