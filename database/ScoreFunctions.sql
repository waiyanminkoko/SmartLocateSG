-- ============================================================
-- Score helper RPC functions
-- Run this file once in your Supabase SQL editor before
-- deploying the score-* edge functions.
-- ============================================================

-- ------------------------------------------------------------
-- 1. count_nearby_transit
--    Returns the number of MRT exits and bus stops within
--    a given radius of a coordinate.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION count_nearby_transit(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_m   DOUBLE PRECISION DEFAULT 500
)
RETURNS TABLE(mrt_count BIGINT, bus_count BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT
    (
      SELECT COUNT(*)
      FROM datagov_mrt_exits
      WHERE ST_DWithin(
        geom::geography,
        ST_MakePoint(center_lng, center_lat)::geography,
        radius_m
      )
    ) AS mrt_count,
    (
      SELECT COUNT(*)
      FROM datagov_bus_stops
      WHERE ST_DWithin(
        geom::geography,
        ST_MakePoint(center_lng, center_lat)::geography,
        radius_m
      )
    ) AS bus_count;
$$;

-- ------------------------------------------------------------
-- 2. median_psf_nearby
--    Returns the median unit_price_psf from URA retail
--    transactions within radius_m of a coordinate, looking
--    back years_back years.  Returns NULL if no data.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION median_psf_nearby(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_m   DOUBLE PRECISION DEFAULT 1000,
  years_back INTEGER          DEFAULT 3
)
RETURNS NUMERIC
LANGUAGE SQL STABLE AS $$
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY unit_price_psf)
  FROM ura_retail_transactions
  WHERE ST_DWithin(
    geom::geography,
    ST_MakePoint(center_lng, center_lat)::geography,
    radius_m
  )
  AND sale_date >= CURRENT_DATE - (years_back * 365 || ' days')::INTERVAL;
$$;

-- ------------------------------------------------------------
-- 3. get_planning_area_demographics
--    Returns the most recent age and household income data for
--    the planning area that contains the given point.
--    Returns one row with planning_area name plus all columns
--    from onemap_age_group and onemap_household_income.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_planning_area_demographics(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION
)
RETURNS TABLE (
  planning_area          TEXT,
  -- age columns
  ag_year                INTEGER,
  ag_total               INTEGER,
  age_0_4                INTEGER,
  age_5_9                INTEGER,
  age_10_14              INTEGER,
  age_15_19              INTEGER,
  age_20_24              INTEGER,
  age_25_29              INTEGER,
  age_30_34              INTEGER,
  age_35_39              INTEGER,
  age_40_44              INTEGER,
  age_45_49              INTEGER,
  age_50_54              INTEGER,
  age_55_59              INTEGER,
  age_60_64              INTEGER,
  age_65_69              INTEGER,
  age_70_74              INTEGER,
  age_75_79              INTEGER,
  age_80_84              INTEGER,
  age_85_over            INTEGER,
  -- income columns
  hi_year                INTEGER,
  hi_total               INTEGER,
  below_sgd_1000         INTEGER,
  sgd_1000_to_1999       INTEGER,
  sgd_2000_to_2999       INTEGER,
  sgd_3000_to_3999       INTEGER,
  sgd_4000_to_4999       INTEGER,
  sgd_5000_to_5999       INTEGER,
  sgd_6000_to_6999       INTEGER,
  sgd_7000_to_7999       INTEGER,
  sgd_8000_to_8999       INTEGER,
  sgd_9000_to_9999       INTEGER,
  sgd_10000_to_10999     INTEGER,
  sgd_11000_to_11999     INTEGER
)
LANGUAGE SQL STABLE AS $$
  WITH area AS (
    SELECT planning_area
    FROM onemap_planning_area
    WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326))
    LIMIT 1
  ),
  latest_age AS (
    SELECT ag.*
    FROM onemap_age_group ag
    JOIN area ON UPPER(ag.planning_area) = UPPER(area.planning_area)
    ORDER BY ag.year DESC
    LIMIT 1
  ),
  latest_income AS (
    SELECT hi.*
    FROM onemap_household_income hi
    JOIN area ON UPPER(hi.planning_area) = UPPER(area.planning_area)
    ORDER BY hi.year DESC
    LIMIT 1
  )
  SELECT
    area.planning_area,
    la.year,
    la.total,
    la.age_0_4, la.age_5_9, la.age_10_14, la.age_15_19, la.age_20_24,
    la.age_25_29, la.age_30_34, la.age_35_39, la.age_40_44, la.age_45_49,
    la.age_50_54, la.age_55_59, la.age_60_64, la.age_65_69, la.age_70_74,
    la.age_75_79, la.age_80_84, la.age_85_over,
    li.year,
    li.total,
    li.below_sgd_1000, li.sgd_1000_to_1999, li.sgd_2000_to_2999,
    li.sgd_3000_to_3999, li.sgd_4000_to_4999, li.sgd_5000_to_5999,
    li.sgd_6000_to_6999, li.sgd_7000_to_7999, li.sgd_8000_to_8999,
    li.sgd_9000_to_9999, li.sgd_10000_to_10999, li.sgd_11000_to_11999
  FROM area, latest_age la, latest_income li;
$$;
