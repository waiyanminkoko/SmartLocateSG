-- Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'price_level_enum') THEN
        CREATE TYPE price_level_enum AS ENUM ('<1M', '1-3M', '3-10M', '>10M');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'psf_level_enum') THEN
        CREATE TYPE psf_level_enum AS ENUM ('<2k PSF', '2-4k PSF', '4-7k PSF', '>7k PSF');
    END IF;
END$$;

DROP TABLE IF EXISTS ura_retail_transactions;

CREATE TABLE IF NOT EXISTS ura_retail_transactions (
    id SERIAL PRIMARY KEY,
    project_name TEXT NOT NULL,
    street_name TEXT NOT NULL,
    property_type TEXT NOT NULL,
    sale_date DATE NOT NULL,
    transacted_price BIGINT NOT NULL, 
    unit_price_psf NUMERIC NOT NULL,
    area_sqft NUMERIC NOT NULL, 
    postal_district INT NOT NULL,
    floor_level TEXT NOT NULL,
    tenure TEXT NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    ) STORED,
    geocoded_address TEXT NOT NULL,
    price_level price_level_enum NOT NULL,
    psf_level psf_level_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (project_name, street_name, sale_date, floor_level)
);