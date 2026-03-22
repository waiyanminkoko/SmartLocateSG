-- Stores retail places fetched from Google Places API (New).
-- place_id is the stable identifier assigned by Google.
-- This table is populated once (or refreshed periodically) via googleApi.py
-- and then queried locally — no Google API calls are made at query time.
CREATE TABLE IF NOT EXISTS google_places (
    id SERIAL PRIMARY KEY,
    place_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    shop_category TEXT NOT NULL,  -- our category key: fnb, clothing, electronics, etc.
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    ) STORED,
    raw_types TEXT[],             -- original type array returned by Google
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS google_places_geom_idx
    ON google_places USING GIST (geom);

CREATE INDEX IF NOT EXISTS google_places_category_idx
    ON google_places (shop_category);

-- Query-fetch metadata cache.
-- We bucket nearby coordinates (for example, 50 m buckets) so users selecting
-- slightly different points can reuse the same recent fetch and avoid calling
-- Google repeatedly.
CREATE TABLE IF NOT EXISTS google_places_fetch_cache (
    id SERIAL PRIMARY KEY,
    bucket_lat NUMERIC(9, 6) NOT NULL,
    bucket_lng NUMERIC(9, 6) NOT NULL,
    radius_meters INTEGER NOT NULL,
    shop_category TEXT NOT NULL,
    last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    api_calls INTEGER NOT NULL DEFAULT 0,
    potentially_incomplete BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (bucket_lat, bucket_lng, radius_meters, shop_category)
);

CREATE INDEX IF NOT EXISTS google_places_fetch_cache_last_fetched_idx
    ON google_places_fetch_cache (last_fetched_at);

-- PostGIS RPC function used by the application to count nearby competitors.
-- Distance unit: metres (ST_DWithin with geography cast).
CREATE OR REPLACE FUNCTION count_nearby_google_places(
    center_lat NUMERIC,
    center_lng NUMERIC,
    radius_m   INTEGER,
    p_shop_category TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    result INTEGER;
BEGIN
    SELECT COUNT(*) INTO result
    FROM google_places
    WHERE shop_category = p_shop_category
      AND ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
          radius_m
      );
    RETURN result;
END;
$$;
