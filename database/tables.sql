create extension if not exists pgcrypto;

create table if not exists users (
	id varchar primary key default gen_random_uuid(),
	username text not null unique,
	password text not null
);

create table if not exists planning_areas (
	id varchar primary key default gen_random_uuid(),
	area_name varchar(80) not null,
	area_code varchar(16) not null unique,
	region_name varchar(40),
	geometry_geojson text,
	centroid_lat numeric(9, 6),
	centroid_lng numeric(9, 6),
	last_updated_at timestamp default now()
);

create table if not exists area_demographics (
	id varchar primary key default gen_random_uuid(),
	planning_area_id varchar references planning_areas(id),
	effective_year integer not null,
	population_total integer,
	age_distribution_json jsonb,
	income_distribution_json jsonb,
	household_size_json jsonb,
	household_structure_json jsonb,
	economic_status_json jsonb,
	ingested_at timestamp default now()
);

create table if not exists site_scores (
	id varchar primary key default gen_random_uuid(),
	composite_score numeric(6, 2),
	demographic_score numeric(6, 2),
	accessibility_score numeric(6, 2),
	rental_pressure_score numeric(6, 2),
	competition_score numeric(6, 2),
	computed_at timestamp default now(),
	breakdown_details_json jsonb
);

create table if not exists candidate_sites (
	id varchar primary key default gen_random_uuid(),
	user_id varchar references users(id),
	profile_id varchar,
	site_name varchar(80) not null,
	address_label varchar(160),
	postal_code varchar(16),
	lat numeric(9, 6),
	lng numeric(9, 6),
	planning_area_id varchar references planning_areas(id),
	saved_site_score_id varchar references site_scores(id),
	notes text,
	saved_at timestamp default now()
);
