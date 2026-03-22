-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.Data_db (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT Data_db_pkey PRIMARY KEY (id)
);
CREATE TABLE public.area_demographics (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  planning_area_id character varying,
  effective_year integer NOT NULL,
  population_total integer,
  age_distribution_json jsonb,
  income_distribution_json jsonb,
  household_size_json jsonb,
  household_structure_json jsonb,
  economic_status_json jsonb,
  ingested_at timestamp without time zone DEFAULT now(),
  CONSTRAINT area_demographics_pkey PRIMARY KEY (id),
  CONSTRAINT area_demographics_planning_area_id_fkey FOREIGN KEY (planning_area_id) REFERENCES public.planning_areas(id)
);
CREATE TABLE public.business_profiles (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  user_id character varying NOT NULL,
  business_name character varying NOT NULL,
  sector character varying NOT NULL,
  price_band character varying NOT NULL,
  target_age_groups_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_income_bands_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  operating_model character varying NOT NULL,
  is_active integer NOT NULL DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT business_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT business_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.candidate_sites (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  user_id character varying,
  profile_id character varying,
  site_name character varying NOT NULL,
  address_label character varying,
  postal_code character varying,
  lat numeric,
  lng numeric,
  planning_area_id character varying,
  saved_site_score_id character varying,
  notes text,
  saved_at timestamp without time zone DEFAULT now(),
  CONSTRAINT candidate_sites_pkey PRIMARY KEY (id),
  CONSTRAINT candidate_sites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT candidate_sites_planning_area_id_fkey FOREIGN KEY (planning_area_id) REFERENCES public.planning_areas(id),
  CONSTRAINT candidate_sites_saved_site_score_id_fkey FOREIGN KEY (saved_site_score_id) REFERENCES public.site_scores(id),
  CONSTRAINT fk_candidate_sites_profile_id FOREIGN KEY (profile_id) REFERENCES public.business_profiles(id)
);
CREATE TABLE public.datagov_bus_stops (
  id integer NOT NULL DEFAULT nextval('datagov_bus_stops_id_seq'::regclass),
  bus_stop_number text NOT NULL UNIQUE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  geom USER-DEFINED DEFAULT st_setsrid(st_makepoint((longitude)::double precision, (latitude)::double precision), 4326),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT datagov_bus_stops_pkey PRIMARY KEY (id)
);
CREATE TABLE public.datagov_mrt_exits (
  id integer NOT NULL DEFAULT nextval('datagov_mrt_exits_id_seq'::regclass),
  station_name text NOT NULL,
  exit_number text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  geom USER-DEFINED DEFAULT st_setsrid(st_makepoint((longitude)::double precision, (latitude)::double precision), 4326),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT datagov_mrt_exits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.google_places (
  id integer NOT NULL DEFAULT nextval('google_places_id_seq'::regclass),
  place_id text NOT NULL UNIQUE,
  name text NOT NULL,
  shop_category text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  geom USER-DEFINED DEFAULT st_setsrid(st_makepoint((longitude)::double precision, (latitude)::double precision), 4326),
  raw_types ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT google_places_pkey PRIMARY KEY (id)
);
CREATE TABLE public.google_places_fetch_cache (
  id integer NOT NULL DEFAULT nextval('google_places_fetch_cache_id_seq'::regclass),
  bucket_lat numeric NOT NULL,
  bucket_lng numeric NOT NULL,
  radius_meters integer NOT NULL,
  shop_category text NOT NULL,
  last_fetched_at timestamp with time zone DEFAULT now(),
  api_calls integer NOT NULL DEFAULT 0,
  potentially_incomplete boolean NOT NULL DEFAULT false,
  CONSTRAINT google_places_fetch_cache_pkey PRIMARY KEY (id)
);
CREATE TABLE public.onemap_age_group (
  id integer NOT NULL DEFAULT nextval('onemap_age_group_id_seq'::regclass),
  year integer NOT NULL,
  planning_area character varying NOT NULL,
  total integer NOT NULL,
  age_0_4 integer DEFAULT 0,
  age_5_9 integer DEFAULT 0,
  age_10_14 integer DEFAULT 0,
  age_15_19 integer DEFAULT 0,
  age_20_24 integer DEFAULT 0,
  age_25_29 integer DEFAULT 0,
  age_30_34 integer DEFAULT 0,
  age_35_39 integer DEFAULT 0,
  age_40_44 integer DEFAULT 0,
  age_45_49 integer DEFAULT 0,
  age_50_54 integer DEFAULT 0,
  age_55_59 integer DEFAULT 0,
  age_60_64 integer DEFAULT 0,
  age_65_69 integer DEFAULT 0,
  age_70_74 integer DEFAULT 0,
  age_75_79 integer DEFAULT 0,
  age_80_84 integer DEFAULT 0,
  age_85_over integer DEFAULT 0,
  CONSTRAINT onemap_age_group_pkey PRIMARY KEY (id)
);
CREATE TABLE public.onemap_economic_status (
  id integer NOT NULL DEFAULT nextval('onemap_economic_status_id_seq'::regclass),
  planning_area text NOT NULL,
  year integer NOT NULL,
  employed integer NOT NULL,
  inactive integer NOT NULL,
  unemployed integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT onemap_economic_status_pkey PRIMARY KEY (id)
);
CREATE TABLE public.onemap_household_income (
  id integer NOT NULL DEFAULT nextval('onemap_household_income_id_seq'::regclass),
  year integer NOT NULL,
  planning_area character varying NOT NULL,
  total integer NOT NULL,
  below_sgd_1000 integer DEFAULT 0,
  sgd_1000_to_1999 integer DEFAULT 0,
  sgd_2000_to_2999 integer DEFAULT 0,
  sgd_3000_to_3999 integer DEFAULT 0,
  sgd_4000_to_4999 integer DEFAULT 0,
  sgd_5000_to_5999 integer DEFAULT 0,
  sgd_6000_to_6999 integer DEFAULT 0,
  sgd_7000_to_7999 integer DEFAULT 0,
  sgd_8000_to_8999 integer DEFAULT 0,
  sgd_9000_to_9999 integer DEFAULT 0,
  sgd_10000_to_10999 integer DEFAULT 0,
  sgd_11000_to_11999 integer DEFAULT 0,
  sgd_12000_to_12999 integer DEFAULT 0,
  sgd_13000_to_13999 integer DEFAULT 0,
  sgd_14000_to_14999 integer DEFAULT 0,
  sgd_15000_to_17499 integer DEFAULT 0,
  sgd_17500_to_19999 integer DEFAULT 0,
  sgd_20000_over integer DEFAULT 0,
  sgd_10000_over integer DEFAULT 0,
  sgd_8000_over integer DEFAULT 0,
  no_working_person integer DEFAULT 0,
  CONSTRAINT onemap_household_income_pkey PRIMARY KEY (id)
);
CREATE TABLE public.onemap_household_size (
  id integer NOT NULL DEFAULT nextval('onemap_household_size_id_seq'::regclass),
  year integer NOT NULL,
  planning_area character varying NOT NULL,
  person1 integer DEFAULT 0,
  person2 integer DEFAULT 0,
  person3 integer DEFAULT 0,
  person4 integer DEFAULT 0,
  person5 integer DEFAULT 0,
  person6 integer DEFAULT 0,
  person7 integer DEFAULT 0,
  person_more_8 integer DEFAULT 0,
  CONSTRAINT onemap_household_size_pkey PRIMARY KEY (id)
);
CREATE TABLE public.onemap_household_structure (
  id integer NOT NULL DEFAULT nextval('onemap_household_structure_id_seq'::regclass),
  year integer NOT NULL,
  planning_area character varying NOT NULL,
  ofn_1_gen integer DEFAULT 0,
  ofn_2_gen integer DEFAULT 0,
  ofn_3_more_gen integer DEFAULT 0,
  tfn_1to2_gen integer DEFAULT 0,
  tfn_3_more_gen integer DEFAULT 0,
  no_family_nucleus integer DEFAULT 0,
  three_more_fam_nucleus integer DEFAULT 0,
  CONSTRAINT onemap_household_structure_pkey PRIMARY KEY (id)
);
CREATE TABLE public.onemap_planning_area (
  id integer NOT NULL DEFAULT nextval('onemap_planning_area_id_seq'::regclass),
  planning_area text NOT NULL UNIQUE,
  geojson jsonb NOT NULL,
  geom USER-DEFINED,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT onemap_planning_area_pkey PRIMARY KEY (id)
);
CREATE TABLE public.onemap_work_income (
  id integer NOT NULL DEFAULT nextval('onemap_work_income_id_seq'::regclass),
  year integer NOT NULL,
  planning_area character varying NOT NULL,
  total integer DEFAULT 0,
  below_sgd_1000 integer DEFAULT 0,
  sgd_1000_to_1499 integer DEFAULT 0,
  sgd_1000_to_1999 integer DEFAULT 0,
  sgd_1500_to_1999 integer DEFAULT 0,
  sgd_2000_to_2499 integer DEFAULT 0,
  sgd_2000_to_2999 integer DEFAULT 0,
  sgd_2500_to_2999 integer DEFAULT 0,
  sgd_3000_to_3999 integer DEFAULT 0,
  sgd_4000_to_4999 integer DEFAULT 0,
  sgd_5000_to_5999 integer DEFAULT 0,
  sgd_6000_to_6999 integer DEFAULT 0,
  sgd_7000_to_7999 integer DEFAULT 0,
  sgd_8000_to_8999 integer DEFAULT 0,
  sgd_9000_to_9999 integer DEFAULT 0,
  sgd_10000_to_10999 integer DEFAULT 0,
  sgd_11000_to_11999 integer DEFAULT 0,
  sgd_12000_14999 integer DEFAULT 0,
  sgd_12000_over integer DEFAULT 0,
  sgd_15000_over integer DEFAULT 0,
  sgd_6000_over integer DEFAULT 0,
  sgd_8000_over integer DEFAULT 0,
  CONSTRAINT onemap_work_income_pkey PRIMARY KEY (id)
);
CREATE TABLE public.planning_areas (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  area_name character varying NOT NULL,
  area_code character varying NOT NULL UNIQUE,
  region_name character varying,
  geometry_geojson text,
  centroid_lat numeric,
  centroid_lng numeric,
  last_updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT planning_areas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.site_scores (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  composite_score numeric,
  demographic_score numeric,
  accessibility_score numeric,
  rental_pressure_score numeric,
  competition_score numeric,
  computed_at timestamp without time zone DEFAULT now(),
  breakdown_details_json jsonb,
  notes text DEFAULT ''::text,
  CONSTRAINT site_scores_pkey PRIMARY KEY (id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.ura_retail_transactions (
  id integer NOT NULL DEFAULT nextval('ura_retail_transactions_id_seq'::regclass),
  project_name text NOT NULL,
  street_name text NOT NULL,
  property_type text NOT NULL,
  sale_date date NOT NULL,
  transacted_price bigint NOT NULL,
  unit_price_psf numeric NOT NULL,
  area_sqft numeric NOT NULL,
  postal_district integer NOT NULL,
  floor_level text NOT NULL,
  tenure text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  geom USER-DEFINED DEFAULT st_setsrid(st_makepoint((longitude)::double precision, (latitude)::double precision), 4326),
  geocoded_address text NOT NULL,
  price_level USER-DEFINED NOT NULL,
  psf_level USER-DEFINED NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ura_retail_transactions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);