/** 
 * To count nearby MRT exits within a specified radius.
 */
CREATE OR REPLACE FUNCTION count_nearby_mrt_exits(center_lat double precision, center_lng double precision, radius_m double precision)
RETURNS integer AS $$
  SELECT COUNT(*) FROM datagov_mrt_exits
  WHERE ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_m
  );
$$ LANGUAGE sql STABLE;

/**
 * To count nearby bus stops within a specified radius.
 */
CREATE OR REPLACE FUNCTION count_nearby_bus_stops(center_lat double precision, center_lng double precision, radius_m double precision)
RETURNS integer AS $$
  SELECT COUNT(*) FROM datagov_bus_stops
  WHERE ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_m
  );
$$ LANGUAGE sql STABLE;

/**
 * To get nearby MRT exits within a specified radius.
 */
CREATE OR REPLACE FUNCTION get_nearby_mrt_exits(center_lat double precision, center_lng double precision, radius_m double precision)
RETURNS TABLE(
    id integer,
    station_name text,
    exit_number text,
    latitude numeric,
    longitude numeric
) AS $$
  SELECT id, station_name, exit_number, latitude, longitude
  FROM datagov_mrt_exits
  WHERE ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_m
  );
$$ LANGUAGE sql STABLE;

/**
 * To get nearby bus stops within a specified radius.
 */
CREATE OR REPLACE FUNCTION get_nearby_bus_stops(center_lat double precision, center_lng double precision, radius_m double precision)
RETURNS TABLE(
    id integer,
    bus_stop_number text,
    latitude numeric,
    longitude numeric
) AS $$
  SELECT id, bus_stop_number, latitude, longitude
  FROM datagov_bus_stops
  WHERE ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_m
  ); 
$$ LANGUAGE sql STABLE;

/**
 * To calculate demographic score using selected age groups and income bands
 * If data for the target area is missing, it averages surrounding areas within the radius
 * Score is normalised fraction of selected groups to total population, averaged across age and income
 */
CREATE OR REPLACE FUNCTION get_demographic_score(
    target_area text,
    selected_age_groups text[],
    selected_income_bands text[],
    radius_m double precision DEFAULT 1000
)
RETURNS numeric AS $$
DECLARE
    age_sum numeric := 0;
    income_sum numeric := 0;
    score numeric := 0;
  target_area_norm text := UPPER(BTRIM(target_area));
  age_year integer;
  income_year integer;
    ag RECORD;
    hi RECORD;
    col text;
BEGIN
  -- Use latest available year for each dataset.
    SELECT year INTO age_year
    FROM onemap_age_group
    WHERE UPPER(BTRIM(planning_area)) = target_area_norm
    ORDER BY year DESC
    LIMIT 1;

    IF age_year IS NULL THEN
        SELECT MAX(year) INTO age_year FROM onemap_age_group;
    END IF;

    SELECT year INTO income_year
    FROM onemap_household_income
    WHERE UPPER(BTRIM(planning_area)) = target_area_norm
    ORDER BY year DESC
    LIMIT 1;

    IF income_year IS NULL THEN
        SELECT MAX(year) INTO income_year FROM onemap_household_income;
    END IF;

    -- Fetch target area age data
    SELECT * INTO ag
    FROM onemap_age_group
    WHERE UPPER(BTRIM(planning_area)) = target_area_norm
      AND year = age_year
    LIMIT 1;

    -- Fetch target area income data
    SELECT * INTO hi
    FROM onemap_household_income
    WHERE UPPER(BTRIM(planning_area)) = target_area_norm
      AND year = income_year
    LIMIT 1;

    -- Fallback for age data: Average surrounding planning areas.
    IF ag IS NULL OR ag.total = 0 THEN
        SELECT
            NULL::integer AS id,
            age_year AS year,
            target_area::varchar(100) AS planning_area,
            COALESCE(ROUND(AVG(a.total))::integer, 0) AS total,
            COALESCE(ROUND(AVG(a.age_0_4))::integer, 0) AS age_0_4,
            COALESCE(ROUND(AVG(a.age_5_9))::integer, 0) AS age_5_9,
            COALESCE(ROUND(AVG(a.age_10_14))::integer, 0) AS age_10_14,
            COALESCE(ROUND(AVG(a.age_15_19))::integer, 0) AS age_15_19,
            COALESCE(ROUND(AVG(a.age_20_24))::integer, 0) AS age_20_24,
            COALESCE(ROUND(AVG(a.age_25_29))::integer, 0) AS age_25_29,
            COALESCE(ROUND(AVG(a.age_30_34))::integer, 0) AS age_30_34,
            COALESCE(ROUND(AVG(a.age_35_39))::integer, 0) AS age_35_39,
            COALESCE(ROUND(AVG(a.age_40_44))::integer, 0) AS age_40_44,
            COALESCE(ROUND(AVG(a.age_45_49))::integer, 0) AS age_45_49,
            COALESCE(ROUND(AVG(a.age_50_54))::integer, 0) AS age_50_54,
            COALESCE(ROUND(AVG(a.age_55_59))::integer, 0) AS age_55_59,
            COALESCE(ROUND(AVG(a.age_60_64))::integer, 0) AS age_60_64,
            COALESCE(ROUND(AVG(a.age_65_69))::integer, 0) AS age_65_69,
            COALESCE(ROUND(AVG(a.age_70_74))::integer, 0) AS age_70_74,
            COALESCE(ROUND(AVG(a.age_75_79))::integer, 0) AS age_75_79,
            COALESCE(ROUND(AVG(a.age_80_84))::integer, 0) AS age_80_84,
            COALESCE(ROUND(AVG(a.age_85_over))::integer, 0) AS age_85_over
        INTO ag
        FROM onemap_age_group a
        WHERE a.year = age_year
          AND UPPER(BTRIM(a.planning_area)) IN (
              WITH target AS (
                  SELECT geom
                  FROM onemap_planning_area
                  WHERE UPPER(BTRIM(planning_area)) = target_area_norm
                  LIMIT 1
              ),
              neighbor_areas AS (
                  SELECT UPPER(BTRIM(pa.planning_area)) AS planning_area
                  FROM onemap_planning_area pa
                  CROSS JOIN target t
                  WHERE UPPER(BTRIM(pa.planning_area)) <> target_area_norm
                    AND (
                        ST_Touches(pa.geom, t.geom)
                        OR ST_DWithin(pa.geom::geography, t.geom::geography, radius_m)
                    )
                  ORDER BY
                    CASE WHEN ST_Touches(pa.geom, t.geom) THEN 0 ELSE 1 END,
                    ST_Distance(pa.geom::geography, t.geom::geography)
                  LIMIT 8
              ),
              selected_areas AS (
                  SELECT planning_area FROM neighbor_areas
                  UNION ALL
                  SELECT UPPER(BTRIM(pa.planning_area)) AS planning_area
                  FROM onemap_planning_area pa
                  WHERE UPPER(BTRIM(pa.planning_area)) <> target_area_norm
                    AND NOT EXISTS (SELECT 1 FROM neighbor_areas)
              )
              SELECT planning_area FROM selected_areas
          );
    END IF;

    -- Fallback for income data: average surrounding planning areas.
    IF hi IS NULL OR hi.total = 0 THEN
        SELECT
            NULL::integer AS id,
            income_year AS year,
            target_area::varchar(100) AS planning_area,
            COALESCE(ROUND(AVG(h.total))::integer, 0) AS total,
            COALESCE(ROUND(AVG(h.below_sgd_1000))::integer, 0) AS below_sgd_1000,
            COALESCE(ROUND(AVG(h.sgd_1000_to_1999))::integer, 0) AS sgd_1000_to_1999,
            COALESCE(ROUND(AVG(h.sgd_2000_to_2999))::integer, 0) AS sgd_2000_to_2999,
            COALESCE(ROUND(AVG(h.sgd_3000_to_3999))::integer, 0) AS sgd_3000_to_3999,
            COALESCE(ROUND(AVG(h.sgd_4000_to_4999))::integer, 0) AS sgd_4000_to_4999,
            COALESCE(ROUND(AVG(h.sgd_5000_to_5999))::integer, 0) AS sgd_5000_to_5999,
            COALESCE(ROUND(AVG(h.sgd_6000_to_6999))::integer, 0) AS sgd_6000_to_6999,
            COALESCE(ROUND(AVG(h.sgd_7000_to_7999))::integer, 0) AS sgd_7000_to_7999,
            COALESCE(ROUND(AVG(h.sgd_8000_to_8999))::integer, 0) AS sgd_8000_to_8999,
            COALESCE(ROUND(AVG(h.sgd_9000_to_9999))::integer, 0) AS sgd_9000_to_9999,
            COALESCE(ROUND(AVG(h.sgd_10000_to_10999))::integer, 0) AS sgd_10000_to_10999,
            COALESCE(ROUND(AVG(h.sgd_11000_to_11999))::integer, 0) AS sgd_11000_to_11999,
            COALESCE(ROUND(AVG(h.sgd_12000_to_12999))::integer, 0) AS sgd_12000_to_12999,
            COALESCE(ROUND(AVG(h.sgd_13000_to_13999))::integer, 0) AS sgd_13000_to_13999,
            COALESCE(ROUND(AVG(h.sgd_14000_to_14999))::integer, 0) AS sgd_14000_to_14999,
            COALESCE(ROUND(AVG(h.sgd_15000_to_17499))::integer, 0) AS sgd_15000_to_17499,
            COALESCE(ROUND(AVG(h.sgd_17500_to_19999))::integer, 0) AS sgd_17500_to_19999,
            COALESCE(ROUND(AVG(h.sgd_20000_over))::integer, 0) AS sgd_20000_over,
            COALESCE(ROUND(AVG(h.sgd_10000_over))::integer, 0) AS sgd_10000_over,
            COALESCE(ROUND(AVG(h.sgd_8000_over))::integer, 0) AS sgd_8000_over,
            COALESCE(ROUND(AVG(h.no_working_person))::integer, 0) AS no_working_person
        INTO hi
        FROM onemap_household_income h
        WHERE h.year = income_year
          AND UPPER(BTRIM(h.planning_area)) IN (
              WITH target AS (
                  SELECT geom
                  FROM onemap_planning_area
                  WHERE UPPER(BTRIM(planning_area)) = target_area_norm
                  LIMIT 1
              ),
              neighbor_areas AS (
                  SELECT UPPER(BTRIM(pa.planning_area)) AS planning_area
                  FROM onemap_planning_area pa
                  CROSS JOIN target t
                  WHERE UPPER(BTRIM(pa.planning_area)) <> target_area_norm
                    AND (
                        ST_Touches(pa.geom, t.geom)
                        OR ST_DWithin(pa.geom::geography, t.geom::geography, radius_m)
                    )
                  ORDER BY
                    CASE WHEN ST_Touches(pa.geom, t.geom) THEN 0 ELSE 1 END,
                    ST_Distance(pa.geom::geography, t.geom::geography)
                  LIMIT 8
              ),
              selected_areas AS (
                  SELECT planning_area FROM neighbor_areas
                  UNION ALL
                  SELECT UPPER(BTRIM(pa.planning_area)) AS planning_area
                  FROM onemap_planning_area pa
                  WHERE UPPER(BTRIM(pa.planning_area)) <> target_area_norm
                    AND NOT EXISTS (SELECT 1 FROM neighbor_areas)
              )
              SELECT planning_area FROM selected_areas
          );
    END IF;

    -- If we still have no usable data after fallback, return 0.
    IF ag IS NULL OR hi IS NULL OR ag.total = 0 OR hi.total = 0 THEN
        RETURN 0;
    END IF;

    -- Sum age groups
    FOREACH col IN ARRAY selected_age_groups LOOP
        CASE col
            WHEN '18-24' THEN age_sum := age_sum + (ag.age_15_19 + ag.age_20_24)::numeric;
            WHEN '25-34' THEN age_sum := age_sum + (ag.age_25_29 + ag.age_30_34)::numeric;
            WHEN '35-44' THEN age_sum := age_sum + (ag.age_35_39 + ag.age_40_44)::numeric;
            WHEN '45-54' THEN age_sum := age_sum + (ag.age_45_49 + ag.age_50_54)::numeric;
            WHEN '55-64' THEN age_sum := age_sum + (ag.age_55_59 + ag.age_60_64)::numeric;
            WHEN '65+'   THEN age_sum := age_sum + (ag.age_65_69 + ag.age_70_74 + ag.age_75_79 + ag.age_80_84 + ag.age_85_over)::numeric;
        END CASE;
    END LOOP;

    -- Sum income bands
    FOREACH col IN ARRAY selected_income_bands LOOP
        CASE col
            WHEN 'Low' THEN income_sum := income_sum + (hi.below_sgd_1000 + hi.sgd_1000_to_1999 + hi.sgd_2000_to_2999 + hi.sgd_3000_to_3999)::numeric;
            WHEN 'Lower-Middle' THEN income_sum := income_sum + (hi.sgd_3000_to_3999 + hi.sgd_4000_to_4999 + hi.sgd_5000_to_5999)::numeric;
            WHEN 'Middle' THEN income_sum := income_sum + (hi.sgd_5000_to_5999 + hi.sgd_6000_to_6999 + hi.sgd_7000_to_7999 + hi.sgd_8000_to_8999)::numeric;
            WHEN 'Upper-Middle' THEN income_sum := income_sum + (hi.sgd_8000_to_8999 + hi.sgd_9000_to_9999 + hi.sgd_10000_to_10999 + hi.sgd_11000_to_11999 + hi.sgd_12000_to_12999)::numeric;
            WHEN 'High' THEN income_sum := income_sum + (hi.sgd_12000_to_12999 + hi.sgd_13000_to_13999 + hi.sgd_14000_to_14999 + hi.sgd_15000_to_17499 + hi.sgd_17500_to_19999 + hi.sgd_20000_over)::numeric;
        END CASE;
    END LOOP;

    -- Normalise score
    score := ((age_sum::numeric / NULLIF(ag.total,0)) + (income_sum::numeric / NULLIF(hi.total,0))) / 2;

    RETURN score;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * To calculate accessibility score based on nearby MRT exits and bus stops within a specified radius.
 */
CREATE OR REPLACE FUNCTION get_accessibility_score(
    center_lat double precision,
    center_lng double precision,
    radius_m double precision DEFAULT 1000,
    mrt_weight numeric DEFAULT 0.6,
    bus_weight numeric DEFAULT 0.4
)
RETURNS numeric AS $$
DECLARE
    mrt_count integer;
    bus_count integer;
    max_mrt integer := 5;  -- for normalisation
    max_bus integer := 20;  -- for normalisation
    score numeric;
    center_point geography;
BEGIN
    -- Create a geography point from input lat/lng
    center_point := ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography;

    -- Count MRT exits within radius
    SELECT COUNT(*) INTO mrt_count
    FROM datagov_mrt_exits
    WHERE ST_DWithin(geom::geography, center_point, radius_m);

    -- Count Bus stops within radius
    SELECT COUNT(*) INTO bus_count
    FROM datagov_bus_stops
    WHERE ST_DWithin(geom::geography, center_point, radius_m);

    -- Compute weighted normalised score
    score := ((mrt_count::numeric / max_mrt) * mrt_weight) +
             ((bus_count::numeric / max_bus) * bus_weight);

    -- Cap score to 1
    IF score > 1 THEN
        score := 1;
    END IF;

    RETURN score;
END;
$$ LANGUAGE plpgsql STABLE;