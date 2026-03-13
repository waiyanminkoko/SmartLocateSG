"""
googleApi.py
------------
Fetches nearby retail place data from Google Places API (New) and stores it
in Supabase so competition queries can run from local data.

Main entry point
----------------
    get_competition_count(lat, lng, radius_meters, shop_category)

Returns a dict with the count of competitor shops of the requested category
within the given radius of the supplied coordinates.

Supported shop categories
-------------------------
    fnb         – restaurants, cafes, bars, bakeries …
    clothing    – clothing and shoe stores
    electronics – electronics, phone and computer stores
    beauty      – salons, spas, barbers
    supermarket – supermarkets and grocery stores
    pharmacy    – pharmacies and drugstores
    gym         – gyms and fitness centres
    bank        – banks
    convenience – convenience stores
    retail      – general/department stores and shopping malls

Environment variables required
-------------------------------
    GOOGLE_PLACES_API_KEY      – Google Cloud API key with Places API (New) enabled
    VITE_SUPABASE_URL          – Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY  – Supabase service-role key (preferred; bypasses RLS)
      or VITE_SUPABASE_ANON_KEY

Database prerequisites
-----------------------
Run database/GooglePlacesTables.sql once against your Supabase project to create:
    • google_places              (place storage)
    • count_nearby_google_places (PostGIS RPC function)
"""

import os
import math
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------
SUPABASE_URL: str = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_KEY: str = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("VITE_SUPABASE_ANON_KEY", "")
)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Google Places API (New) – Nearby Search
# ---------------------------------------------------------------------------
GOOGLE_API_KEY: str = (
    os.environ.get("GOOGLE_PLACES_API_KEY")
    or os.environ.get("VITE_GOOGLE_MAPS_API_KEY", "")
)
NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby"

# Google caps Nearby Search responses at 20 results per request.
MAX_RESULTS_PER_REQUEST = 20

# For "fetch all within 100 m", we run multiple overlapping sub-searches.
EXHAUSTIVE_SUBSEARCH_RADIUS_METERS = 50
EXHAUSTIVE_GRID_STEP_METERS = 50

# Cache metadata settings (for reusing nearby query fetches).
CACHE_BUCKET_METERS = 50
DEFAULT_CACHE_TTL_HOURS = 24

# ---------------------------------------------------------------------------
# Shop-category → Google place-type mapping
# Add or extend categories here without touching any other code.
# ---------------------------------------------------------------------------
SHOP_CATEGORY_TO_PLACE_TYPES: dict[str, list[str]] = {
    "fnb": [
        "restaurant",
        "cafe",
        "bar",
        "bakery",
        "fast_food_restaurant",
        "coffee_shop",
        "dessert_shop",
        "ice_cream_shop",
        "juice_shop",
    ],
    "clothing": ["clothing_store", "shoe_store"],
    "electronics": ["electronics_store", "cell_phone_store", "computer_store"],
    "beauty": ["beauty_salon", "hair_salon", "nail_salon", "spa", "barber_shop"],
    "supermarket": ["supermarket", "grocery_store"],
    "pharmacy": ["pharmacy", "drugstore"],
    "gym": ["gym"],
    "bank": ["bank"],
    "convenience": ["convenience_store"],
    "retail": ["store", "department_store"],
}

VALID_CATEGORIES = list(SHOP_CATEGORY_TO_PLACE_TYPES.keys())


def _meters_to_lat_delta(meters: float) -> float:
    return meters / 111_320.0


def _meters_to_lng_delta(meters: float, latitude_deg: float) -> float:
    cos_lat = max(math.cos(math.radians(latitude_deg)), 1e-6)
    return meters / (111_320.0 * cos_lat)


def _distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in metres."""
    r = 6_371_000.0
    lat1r = math.radians(lat1)
    lng1r = math.radians(lng1)
    lat2r = math.radians(lat2)
    lng2r = math.radians(lng2)
    dlat = lat2r - lat1r
    dlng = lng2r - lng1r
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1r) * math.cos(lat2r) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _bucketize_center(lat: float, lng: float, bucket_meters: int) -> tuple[float, float]:
    """Map coordinates into a nearby bucket so close points share cache entries."""
    lat_step = _meters_to_lat_delta(bucket_meters)
    lng_step = _meters_to_lng_delta(bucket_meters, lat)
    bucket_lat = round(round(lat / lat_step) * lat_step, 6)
    bucket_lng = round(round(lng / lng_step) * lng_step, 6)
    return bucket_lat, bucket_lng


def _get_recent_fetch_cache(
    lat: float,
    lng: float,
    radius_meters: int,
    shop_category: str,
    cache_ttl_hours: int,
) -> dict | None:
    bucket_lat, bucket_lng = _bucketize_center(lat, lng, CACHE_BUCKET_METERS)
    cutoff_iso = (datetime.now(timezone.utc) - timedelta(hours=cache_ttl_hours)).isoformat()

    resp = (
        supabase.table("google_places_fetch_cache")
        .select("*")
        .eq("bucket_lat", bucket_lat)
        .eq("bucket_lng", bucket_lng)
        .eq("radius_meters", radius_meters)
        .eq("shop_category", shop_category)
        .gte("last_fetched_at", cutoff_iso)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def _upsert_fetch_cache(
    lat: float,
    lng: float,
    radius_meters: int,
    shop_category: str,
    api_calls: int,
    potentially_incomplete: bool,
) -> None:
    bucket_lat, bucket_lng = _bucketize_center(lat, lng, CACHE_BUCKET_METERS)
    record = {
        "bucket_lat": bucket_lat,
        "bucket_lng": bucket_lng,
        "radius_meters": radius_meters,
        "shop_category": shop_category,
        "last_fetched_at": datetime.now(timezone.utc).isoformat(),
        "api_calls": api_calls,
        "potentially_incomplete": potentially_incomplete,
    }
    supabase.table("google_places_fetch_cache").upsert(
        record,
        on_conflict="bucket_lat,bucket_lng,radius_meters,shop_category",
    ).execute()


def _build_subsearch_centers(
    center_lat: float,
    center_lng: float,
    target_radius_meters: int,
    sub_radius_meters: int,
    grid_step_meters: int,
) -> list[tuple[float, float]]:
    """
    Build a grid of sub-centers such that circles of radius sub_radius_meters
    cover the full target-radius disk around the original center.
    """
    cover_radius = target_radius_meters + sub_radius_meters
    centers: list[tuple[float, float]] = []
    y = -cover_radius
    while y <= cover_radius:
        x = -cover_radius
        while x <= cover_radius:
            if math.hypot(x, y) <= cover_radius:
                lat = center_lat + _meters_to_lat_delta(y)
                lng = center_lng + _meters_to_lng_delta(x, center_lat)
                centers.append((lat, lng))
            x += grid_step_meters
        y += grid_step_meters
    return centers


def fetch_exhaustive_places_within_radius(
    lat: float,
    lng: float,
    target_radius_meters: int,
    shop_category: str,
) -> tuple[list[dict], int, int]:
    """
    Fetch places by scanning multiple overlapping circles, deduplicate by
    place_id, then keep only points truly within target_radius_meters of the
    original center.

    Returns:
        unique_places_in_radius, api_call_count, capped_call_count
    """
    centers = _build_subsearch_centers(
        lat,
        lng,
        target_radius_meters,
        EXHAUSTIVE_SUBSEARCH_RADIUS_METERS,
        EXHAUSTIVE_GRID_STEP_METERS,
    )

    dedup: dict[str, dict] = {}
    api_calls = 0
    capped_calls = 0

    for sub_lat, sub_lng in centers:
        places = fetch_nearby_places_from_google(
            sub_lat,
            sub_lng,
            EXHAUSTIVE_SUBSEARCH_RADIUS_METERS,
            shop_category,
        )
        api_calls += 1
        if len(places) >= MAX_RESULTS_PER_REQUEST:
            capped_calls += 1
        for place in places:
            dedup[place["place_id"]] = place

    unique_places_in_radius: list[dict] = []
    for place in dedup.values():
        p_lat = place.get("latitude")
        p_lng = place.get("longitude")
        if p_lat is None or p_lng is None:
            continue
        if _distance_meters(lat, lng, float(p_lat), float(p_lng)) <= target_radius_meters:
            unique_places_in_radius.append(place)

    print(
        f"[Google Places] Exhaustive scan complete: {api_calls} API calls, "
        f"{len(dedup)} unique fetched, {len(unique_places_in_radius)} within {target_radius_meters} m."
    )
    return unique_places_in_radius, api_calls, capped_calls


# ---------------------------------------------------------------------------
# Google Places API call
# ---------------------------------------------------------------------------

def fetch_nearby_places_from_google(
    lat: float,
    lng: float,
    radius_meters: int,
    shop_category: str,
) -> list[dict]:
    """
    Call Google Places API (New) Nearby Search and return normalised place dicts.

    Raises:
        ValueError       – unknown shop_category
        EnvironmentError – GOOGLE_PLACES_API_KEY not set
        HTTPError        – non-2xx response from Google
    """
    if shop_category not in SHOP_CATEGORY_TO_PLACE_TYPES:
        raise ValueError(
            f"Unknown shop_category '{shop_category}'. "
            f"Valid options: {VALID_CATEGORIES}"
        )

    if not GOOGLE_API_KEY:
        raise EnvironmentError(
            "Google API key not set. Add GOOGLE_PLACES_API_KEY or "
            "VITE_GOOGLE_MAPS_API_KEY to your .env file."
        )

    place_types = SHOP_CATEGORY_TO_PLACE_TYPES[shop_category]

    payload = {
        "includedTypes": place_types,
        "maxResultCount": MAX_RESULTS_PER_REQUEST,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius_meters),
            }
        },
    }

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        # Only request the fields we actually store to minimise billing cost.
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types",
    }

    response = requests.post(
        NEARBY_SEARCH_URL, json=payload, headers=headers, timeout=30
    )
    if not response.ok:
        details = response.text.strip()
        raise RuntimeError(
            "Google Places request failed "
            f"(HTTP {response.status_code}). Response: {details}. "
            "Common causes: API key restrictions, Places API (New) not enabled, "
            "or billing not enabled on the Google Cloud project."
        )
    data = response.json()

    places: list[dict] = []
    for place in data.get("places", []):
        location = place.get("location", {})
        places.append(
            {
                "place_id": place["id"],
                "name": place.get("displayName", {}).get("text", "Unknown"),
                "shop_category": shop_category,
                "latitude": location.get("latitude"),
                "longitude": location.get("longitude"),
                "raw_types": place.get("types", []),
            }
        )

    print(
        f"[Google Places] Fetched {len(places)} '{shop_category}' places "
        f"within {radius_meters} m of ({lat}, {lng})."
    )
    return places


# ---------------------------------------------------------------------------
# Supabase persistence
# ---------------------------------------------------------------------------

def save_places_to_db(places: list[dict]) -> int:
    """
    Upsert a list of normalised place dicts into the google_places table.

    On conflict (same place_id) the record is updated so that name, types and
    updated_at stay current.  Returns the number of records written.
    """
    if not places:
        return 0

    records = [
        {
            "place_id": p["place_id"],
            "name": p["name"],
            "shop_category": p["shop_category"],
            "latitude": p["latitude"],
            "longitude": p["longitude"],
            "raw_types": p["raw_types"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        for p in places
        if p.get("latitude") is not None and p.get("longitude") is not None
    ]

    resp = supabase.table("google_places").upsert(
        records, on_conflict="place_id"
    ).execute()

    count = len(resp.data) if getattr(resp, "data", None) else len(records)
    print(f"[Supabase] Upserted {count} places into google_places.")
    return count


def count_places_in_db(
    lat: float,
    lng: float,
    radius_meters: int,
    shop_category: str,
) -> int:
    """
    Count google_places rows within radius_meters of (lat, lng) for the given
    category.  Delegates to the PostGIS RPC function defined in
    GooglePlacesTables.sql so the geometry calculation stays in the database.
    """
    resp = supabase.rpc(
        "count_nearby_google_places",
        {
            "center_lat": lat,
            "center_lng": lng,
            "radius_m": radius_meters,
            "p_shop_category": shop_category,
        },
    ).execute()

    return int(resp.data) if resp.data is not None else 0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_competition_count(
    lat: float,
    lng: float,
    radius_meters: int = 100,
    shop_category: str = "fnb",
    use_cache: bool = True,
    cache_ttl_hours: int = DEFAULT_CACHE_TTL_HOURS,
) -> dict:
    """
    Return the count of competitor shops of `shop_category` within
    `radius_meters` metres of (lat, lng).

     Workflow
     --------
    1. If a recent bucketed cache entry exists, skip Google API calls.
    2. Otherwise perform exhaustive Google fetch and upsert into google_places.
    3. Return local PostGIS count for the requested radius/category.

    Args:
        lat            : Latitude of the candidate site.
        lng            : Longitude of the candidate site.
        radius_meters  : Search radius in metres (default 500 m).
        shop_category  : One of the VALID_CATEGORIES keys.
        use_cache      : Reuse nearby bucket fetch metadata when True.
        cache_ttl_hours: Freshness window for cache reuse.
    Returns a dict::

        {
            "shop_category": str,
            "radius_meters": int,
            "count":         int,
            "from_cache": bool,
            "api_calls": int,
            "potentially_incomplete": bool,
        }
    """
    if shop_category not in SHOP_CATEGORY_TO_PLACE_TYPES:
        raise ValueError(
            f"Unknown shop_category '{shop_category}'. "
            f"Valid options: {VALID_CATEGORIES}"
        )

    cache_hit = None
    if use_cache:
        cache_hit = _get_recent_fetch_cache(
            lat, lng, radius_meters, shop_category, cache_ttl_hours
        )

    if cache_hit:
        print(
            f"[Google Places] Cache hit for category='{shop_category}', "
            f"radius={radius_meters} m. Skipping Google fetch."
        )
        db_count = count_places_in_db(lat, lng, radius_meters, shop_category)
        return {
            "shop_category": shop_category,
            "radius_meters": radius_meters,
            "count": db_count,
            "from_cache": True,
            "api_calls": 0,
            "potentially_incomplete": bool(cache_hit.get("potentially_incomplete", False)),
        }

    print(
        f"[Google Places] Exhaustive fetch for ({lat}, {lng}) "
        f"r={radius_meters} m category='{shop_category}'"
    )
    places, api_calls, capped_calls = fetch_exhaustive_places_within_radius(
        lat, lng, radius_meters, shop_category
    )
    save_places_to_db(places)
    _upsert_fetch_cache(
        lat,
        lng,
        radius_meters,
        shop_category,
        api_calls,
        capped_calls > 0,
    )
    db_count = count_places_in_db(lat, lng, radius_meters, shop_category)

    return {
        "shop_category": shop_category,
        "radius_meters": radius_meters,
        "count": db_count,
        "from_cache": False,
        "api_calls": api_calls,
        "potentially_incomplete": capped_calls > 0,
    }


# ---------------------------------------------------------------------------
# CLI smoke-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Quick test: count FnB competitors near Orchard Road, Singapore
    result = get_competition_count(
        lat=1.344052,
        lng=103.68256,
        radius_meters=100,
        shop_category="fnb",
    )
    print(result)
