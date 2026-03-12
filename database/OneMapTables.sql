CREATE TABLE IF NOT EXISTS onemap_planning_area (
    id SERIAL PRIMARY KEY,
    planning_area TEXT NOT NULL,
    geojson JSONB NOT NULL,
    geom geometry(MultiPolygon, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_planning_area_name UNIQUE (planning_area)
);

CREATE TABLE IF NOT EXISTS onemap_economic_status (
    id SERIAL PRIMARY KEY,
    planning_area TEXT NOT NULL,
    year INTEGER NOT NULL, 
    employed INTEGER NOT NULL,
    inactive INTEGER NOT NULL,
    unemployed INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_area_year UNIQUE (planning_area, year)
);

CREATE TABLE IF NOT EXISTS onemap_age_group (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    planning_area VARCHAR(100) NOT NULL,
    total INTEGER NOT NULL,
    age_0_4 INTEGER DEFAULT 0,
    age_5_9 INTEGER DEFAULT 0,
    age_10_14 INTEGER DEFAULT 0,
    age_15_19 INTEGER DEFAULT 0,
    age_20_24 INTEGER DEFAULT 0,
    age_25_29 INTEGER DEFAULT 0,
    age_30_34 INTEGER DEFAULT 0,
    age_35_39 INTEGER DEFAULT 0,
    age_40_44 INTEGER DEFAULT 0,
    age_45_49 INTEGER DEFAULT 0,
    age_50_54 INTEGER DEFAULT 0,
    age_55_59 INTEGER DEFAULT 0,
    age_60_64 INTEGER DEFAULT 0,
    age_65_69 INTEGER DEFAULT 0,
    age_70_74 INTEGER DEFAULT 0,
    age_75_79 INTEGER DEFAULT 0,
    age_80_84 INTEGER DEFAULT 0,
    age_85_over INTEGER DEFAULT 0,
    UNIQUE (year, planning_area)
);

CREATE TABLE IF NOT EXISTS onemap_household_income (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    planning_area VARCHAR(100) NOT NULL,
    total INTEGER NOT NULL,
    below_sgd_1000 INTEGER DEFAULT 0,
    sgd_1000_to_1999 INTEGER DEFAULT 0,
    sgd_2000_to_2999 INTEGER DEFAULT 0,
    sgd_3000_to_3999 INTEGER DEFAULT 0,
    sgd_4000_to_4999 INTEGER DEFAULT 0,
    sgd_5000_to_5999 INTEGER DEFAULT 0,
    sgd_6000_to_6999 INTEGER DEFAULT 0,
    sgd_7000_to_7999 INTEGER DEFAULT 0,
    sgd_8000_to_8999 INTEGER DEFAULT 0,
    sgd_9000_to_9999 INTEGER DEFAULT 0,
    sgd_10000_to_10999 INTEGER DEFAULT 0,
    sgd_11000_to_11999 INTEGER DEFAULT 0,
    sgd_12000_to_12999 INTEGER DEFAULT 0,
    sgd_13000_to_13999 INTEGER DEFAULT 0,
    sgd_14000_to_14999 INTEGER DEFAULT 0,
    sgd_15000_to_17499 INTEGER DEFAULT 0,
    sgd_17500_to_19999 INTEGER DEFAULT 0,
    sgd_20000_over INTEGER DEFAULT 0,
    sgd_10000_over INTEGER DEFAULT 0,
    sgd_8000_over INTEGER DEFAULT 0,
    no_working_person INTEGER DEFAULT 0,
    UNIQUE (year, planning_area)
);

CREATE TABLE IF NOT EXISTS onemap_household_size (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    planning_area VARCHAR(100) NOT NULL,
    person1 INTEGER DEFAULT 0,
    person2 INTEGER DEFAULT 0,
    person3 INTEGER DEFAULT 0,
    person4 INTEGER DEFAULT 0,
    person5 INTEGER DEFAULT 0,
    person6 INTEGER DEFAULT 0,
    person7 INTEGER DEFAULT 0,
    person_more_8 INTEGER DEFAULT 0,
    UNIQUE (year, planning_area)
);

CREATE TABLE IF NOT EXISTS onemap_work_income (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    planning_area VARCHAR(100) NOT NULL,
    total INTEGER DEFAULT 0,
    below_sgd_1000 INTEGER DEFAULT 0,
    sgd_1000_to_1499 INTEGER DEFAULT 0,
    sgd_1000_to_1999 INTEGER DEFAULT 0,
    sgd_1500_to_1999 INTEGER DEFAULT 0,
    sgd_2000_to_2499 INTEGER DEFAULT 0,
    sgd_2000_to_2999 INTEGER DEFAULT 0,
    sgd_2500_to_2999 INTEGER DEFAULT 0,
    sgd_3000_to_3999 INTEGER DEFAULT 0,
    sgd_4000_to_4999 INTEGER DEFAULT 0,
    sgd_5000_to_5999 INTEGER DEFAULT 0,
    sgd_6000_to_6999 INTEGER DEFAULT 0,
    sgd_7000_to_7999 INTEGER DEFAULT 0,
    sgd_8000_to_8999 INTEGER DEFAULT 0,
    sgd_9000_to_9999 INTEGER DEFAULT 0,
    sgd_10000_to_10999 INTEGER DEFAULT 0,
    sgd_11000_to_11999 INTEGER DEFAULT 0,
    sgd_12000_14999 INTEGER DEFAULT 0,
    sgd_12000_over INTEGER DEFAULT 0,
    sgd_15000_over INTEGER DEFAULT 0,
    sgd_6000_over INTEGER DEFAULT 0,
    sgd_8000_over INTEGER DEFAULT 0,
    UNIQUE (year, planning_area)
);

CREATE TABLE IF NOT EXISTS onemap_household_structure (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    planning_area VARCHAR(100) NOT NULL,
    ofn_1_gen INTEGER DEFAULT 0,
    ofn_2_gen INTEGER DEFAULT 0,
    ofn_3_more_gen INTEGER DEFAULT 0,
    tfn_1to2_gen INTEGER DEFAULT 0,
    tfn_3_more_gen INTEGER DEFAULT 0,
    no_family_nucleus INTEGER DEFAULT 0,
    three_more_fam_nucleus INTEGER DEFAULT 0,
    UNIQUE (year, planning_area)
);