DROP TABLE IF EXISTS datagov_mrt_exits;

CREATE TABLE IF NOT EXISTS datagov_mrt_exits (
    id SERIAL PRIMARY KEY,
    station_name TEXT NOT NULL,
    exit_number TEXT NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (station_name, exit_number)
);

DROP TABLE IF EXISTS datagov_bus_stops;

CREATE TABLE IF NOT EXISTS datagov_bus_stops (
    id SERIAL PRIMARY KEY,
    bus_stop_number TEXT NOT NULL UNIQUE,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (bus_stop_number)
);