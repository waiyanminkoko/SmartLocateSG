type ReverseGeocodeProvider = "google" | "onemap" | "fallback";

type ReverseGeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
  postalCode: string | null;
  provider: ReverseGeocodeProvider;
};

type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GoogleReverseGeocodeResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    address_components?: GoogleAddressComponent[];
  }>;
};

type OneMapTokenResponse = {
  access_token?: string;
  expiry_timestamp?: string;
};

type OneMapReverseGeocodeResponse = {
  GeocodeInfo?: Array<{
    BUILDINGNAME?: string;
    BLOCK?: string;
    ROAD?: string;
    POSTALCODE?: string;
  }>;
};

type OneMapGeocodeInfoEntry = {
  BUILDINGNAME?: string;
  BLOCK?: string;
  ROAD?: string;
  POSTALCODE?: string;
};

type OneMapTokenCache = {
  token: string;
  expiresAtMs: number;
};

const GOOGLE_REVERSE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const ONEMAP_TOKEN_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const ONEMAP_REVERSE_GEOCODE_URL = "https://www.onemap.gov.sg/api/public/revgeocode";

const FALLBACK_ONEMAP_TOKEN_TTL_MS = 45 * 60 * 1000;
let cachedOneMapToken: OneMapTokenCache | null = null;

const ONEMAP_NULL_LIKE_VALUES = new Set(["NIL", "NA", "NULL", "N/A"]);

function toFiniteNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("lat/lng must be finite numbers");
  }
  return value;
}

function formatCoordinateFallback(lat: number, lng: number): string {
  return `Singapore (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}

function cleanOneMapField(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  return ONEMAP_NULL_LIKE_VALUES.has(trimmed.toUpperCase()) ? null : trimmed;
}

function sanitizePostalCode(value: string | null | undefined): string | null {
  const trimmed = cleanOneMapField(value);
  if (!trimmed) {
    return null;
  }

  const sixDigitMatch = trimmed.match(/\b\d{6}\b/);
  if (sixDigitMatch) {
    return sixDigitMatch[0];
  }

  return trimmed;
}

function extractPostalCodeFromAddress(value: string | null | undefined): string | null {
  return sanitizePostalCode(value);
}

function extractGooglePostalCode(components: GoogleAddressComponent[] | undefined): string | null {
  if (!components || components.length === 0) {
    return null;
  }

  const postal = components.find((component) =>
    Array.isArray(component.types) && component.types.includes("postal_code"),
  );

  return sanitizePostalCode(postal?.long_name ?? postal?.short_name);
}

async function reverseGeocodeWithGoogle(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    `${GOOGLE_REVERSE_GEOCODE_URL}?latlng=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(apiKey)}`,
  );

  if (!response.ok) {
    throw new Error(`Google reverse geocode failed with status ${response.status}`);
  }

  const data = (await response.json()) as GoogleReverseGeocodeResponse;
  const topResult = data.results?.[0];
  const formattedAddress = topResult?.formatted_address?.trim();

  if (!formattedAddress) {
    return null;
  }

  const topAddressComponents = topResult?.address_components;

  const postalCode =
    extractGooglePostalCode(topAddressComponents) ?? extractPostalCodeFromAddress(formattedAddress);

  return {
    lat,
    lng,
    formattedAddress,
    postalCode,
    provider: "google",
  };
}

async function requestOneMapToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedOneMapToken && cachedOneMapToken.expiresAtMs > now + 60_000) {
    return cachedOneMapToken.token;
  }

  const email = process.env.ONEMAP_EMAIL?.trim();
  const password = process.env.ONEMAP_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("Missing ONEMAP_EMAIL/ONEMAP_PASSWORD credentials");
  }

  const response = await fetch(ONEMAP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`OneMap token request failed with status ${response.status}`);
  }

  const data = (await response.json()) as OneMapTokenResponse;
  const token = data.access_token?.trim();
  if (!token) {
    throw new Error("OneMap token response missing access_token");
  }

  let expiresAtMs = now + FALLBACK_ONEMAP_TOKEN_TTL_MS;
  if (data.expiry_timestamp) {
    const parsed = Date.parse(data.expiry_timestamp);
    if (Number.isFinite(parsed)) {
      expiresAtMs = parsed;
    }
  }

  cachedOneMapToken = { token, expiresAtMs };
  return token;
}

function formatOneMapAddress(entry: OneMapGeocodeInfoEntry): string | null {
  const buildingName = cleanOneMapField(entry.BUILDINGNAME);
  const block = cleanOneMapField(entry.BLOCK);
  const road = cleanOneMapField(entry.ROAD);
  const postalCode = sanitizePostalCode(entry.POSTALCODE);

  const buildingSegment = buildingName;
  const blockRoadSegment = [block, road].filter(Boolean).join(" ").trim() || null;

  const parts = [buildingSegment, blockRoadSegment].filter(Boolean);
  if (postalCode) {
    parts.push(`Singapore ${postalCode}`);
  } else {
    parts.push("Singapore");
  }

  const formatted = parts.join(", ").trim();
  return formatted || null;
}

function pickBestOneMapEntry(entries: OneMapGeocodeInfoEntry[]): OneMapGeocodeInfoEntry | null {
  if (!entries.length) {
    return null;
  }

  const scored = entries.map((entry, index) => {
    const hasPostal = Boolean(sanitizePostalCode(entry.POSTALCODE));
    const hasRoad = Boolean(cleanOneMapField(entry.ROAD));
    const hasBlock = Boolean(cleanOneMapField(entry.BLOCK));
    const hasNamedBuilding = Boolean(cleanOneMapField(entry.BUILDINGNAME));

    const score =
      (hasPostal ? 8 : 0) +
      (hasRoad ? 4 : 0) +
      (hasBlock ? 2 : 0) +
      (hasNamedBuilding ? 1 : 0);

    return { index, entry, score };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0]?.entry ?? null;
}

async function callOneMapReverseGeocode(lat: number, lng: number, token: string): Promise<Response> {
  return fetch(
    `${ONEMAP_REVERSE_GEOCODE_URL}?location=${encodeURIComponent(`${lat},${lng}`)}&buffer=40&addressType=All`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

async function reverseGeocodeWithOneMap(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  let token = await requestOneMapToken();
  let response = await callOneMapReverseGeocode(lat, lng, token);

  if (response.status === 401) {
    token = await requestOneMapToken(true);
    response = await callOneMapReverseGeocode(lat, lng, token);
  }

  if (!response.ok) {
    throw new Error(`OneMap reverse geocode failed with status ${response.status}`);
  }

  const data = (await response.json()) as OneMapReverseGeocodeResponse;
  console.log("[reverse-geocode][onemap][raw]", {
    lat,
    lng,
    count: data.GeocodeInfo?.length ?? 0,
    geocodeInfo: data.GeocodeInfo ?? [],
  });
  const entry = pickBestOneMapEntry(data.GeocodeInfo ?? []);
  if (!entry) {
    console.log("[reverse-geocode][onemap][reject]", {
      reason: "No address candidates returned by OneMap.",
      lat,
      lng,
    });
    return null;
  }

  const formattedAddress = formatOneMapAddress(entry);
  if (!formattedAddress) {
    console.log("[reverse-geocode][onemap][reject]", {
      reason: "Selected OneMap candidate could not be formatted.",
      candidate: entry,
    });
    return null;
  }

  console.log("[reverse-geocode][onemap][selected]", {
    lat,
    lng,
    selected: entry,
    formattedAddress,
    postalCode: sanitizePostalCode(entry.POSTALCODE),
  });

  return {
    lat,
    lng,
    formattedAddress,
    postalCode: sanitizePostalCode(entry.POSTALCODE),
    provider: "onemap",
  };
}

export async function reverseGeocodeWithFallback(latInput: number, lngInput: number): Promise<ReverseGeocodeResult> {
  const lat = toFiniteNumber(latInput);
  const lng = toFiniteNumber(lngInput);

  try {
    const googleResult = await reverseGeocodeWithGoogle(lat, lng);
    if (googleResult && googleResult.formattedAddress && googleResult.postalCode) {
      console.log("[reverse-geocode][google][resolved]", {
        provider: googleResult.provider,
        lat,
        lng,
        formattedAddress: googleResult.formattedAddress,
        postalCode: googleResult.postalCode,
      });
      return googleResult;
    }

    const oneMapResult = await reverseGeocodeWithOneMap(lat, lng);
    if (oneMapResult) {
      console.log("[reverse-geocode][onemap][resolved]", {
        provider: oneMapResult.provider,
        lat,
        lng,
        formattedAddress: oneMapResult.formattedAddress,
        postalCode: oneMapResult.postalCode,
      });
      return oneMapResult;
    }

    if (googleResult) {
      console.log("[reverse-geocode][google][resolved]", {
        provider: googleResult.provider,
        lat,
        lng,
        formattedAddress: googleResult.formattedAddress,
        postalCode: googleResult.postalCode,
      });
      return googleResult;
    }
  } catch (googleError) {
    console.warn("[reverse-geocode] Google path failed, trying OneMap fallback", googleError);
    try {
      const oneMapResult = await reverseGeocodeWithOneMap(lat, lng);
      if (oneMapResult) {
        console.log("[reverse-geocode][onemap][resolved]", {
          provider: oneMapResult.provider,
          lat,
          lng,
          formattedAddress: oneMapResult.formattedAddress,
          postalCode: oneMapResult.postalCode,
        });
        return oneMapResult;
      }
    } catch (oneMapError) {
      console.warn("[reverse-geocode] OneMap fallback failed", oneMapError);
    }
  }

  const fallbackResult: ReverseGeocodeResult = {
    lat,
    lng,
    formattedAddress: formatCoordinateFallback(lat, lng),
    postalCode: null,
    provider: "fallback",
  };

  console.log("[reverse-geocode][fallback][resolved]", {
    provider: fallbackResult.provider,
    lat,
    lng,
    formattedAddress: fallbackResult.formattedAddress,
    postalCode: fallbackResult.postalCode,
  });

  return fallbackResult;
}
