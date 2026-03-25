import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  SquarePlus,
  RotateCcw,
} from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AppShell } from "@/components/app-shell";
import { ExplanationFeedbackButtons } from "@/components/explanation-feedback-buttons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { openChatbot } from "@/lib/chatbot";
import { fetchJsonWithCache, writeApiCache } from "@/lib/api-cache";
import { demoOverlayCollection, demoPointLayers } from "@/lib/demo-map-data";
import { mockProfiles, type BusinessProfile, type CandidateSite } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";

const PROFILES_CACHE_TTL_MS = 2 * 60 * 1000;
const SITES_CACHE_TTL_MS = 60 * 1000;

type Overlay = "Composite" | "Demographics" | "Accessibility" | "Vacancy";
type OverlayMetricKey = "composite" | "demographics" | "accessibility" | "vacancy";
type LayerToggleKey = "mrtStations" | "mrtExits" | "busStops";

type Weights = {
  demographic: number;
  accessibility: number;
  rental: number;
  competition: number;
};

const presets: Record<string, Weights> = {
  Normal: { demographic: 30, accessibility: 30, rental: 20, competition: 20 },
  "Holiday Peak": { demographic: 35, accessibility: 35, rental: 15, competition: 15 },
  "Pandemic / Delivery": { demographic: 20, accessibility: 40, rental: 25, competition: 15 },
  "Cost-Saving": { demographic: 20, accessibility: 25, rental: 35, competition: 20 },
};

const defaultCenter = { lat: 1.3521, lng: 103.8198 };

type OverlayAreaDetails = {
  planningAreaId: string;
  planningAreaName: string;
  areaCode?: string;
  regionName?: string | null;
  composite: number | null;
  demographics: number | null;
  accessibility: number | null;
  vacancy: number | null;
  populationTotal: number | null;
  effectiveYear: number | null;
  busStopCount: number;
  mrtExitCount: number;
  avgUnitPricePsf: number | null;
  retailTransactionCount: number;
};

type OverlayCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: unknown;
    properties: OverlayAreaDetails;
  }>;
  metadata: {
    availableMetrics: Record<OverlayMetricKey, boolean>;
    requestedMetric: OverlayMetricKey;
    featureCount: number;
    source?: "live" | "demo";
  };
};

type PointLayerCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, unknown>;
  }>;
  metadata: {
    layer: "bus-stops" | "mrt-exits" | "mrt-stations";
    featureCount: number;
    source?: "live" | "demo";
  };
};

type SelectedTransportFeature = {
  layerKey: LayerToggleKey;
  label: string;
  source: "live" | "demo";
  fields: Array<{ label: string; value: string }>;
};

type SiteScoreResponse = {
  lat: number;
  lng: number;
  planningArea: {
    planningAreaId: string;
    planningAreaName: string;
    areaCode: string;
    regionName: string | null;
    populationTotal: number | null;
    effectiveYear: number | null;
    busStopCount: number;
    mrtExitCount: number;
    avgUnitPricePsf: number | null;
    retailTransactionCount: number;
    demographicScore: number | null;
    accessibilityScore: number | null;
    vacancyScore: number | null;
    compositeScore: number | null;
  } | null;
  scores: {
    composite: number | null;
    demographic: number | null;
    accessibility: number | null;
    rental: number | null;
    competition: number | null;
  };
  breakdownDetails: {
    analysisRadiusMeters: number;
    busStopsWithinRadius: number;
    mrtExitsWithinRadius: number;
    competitionCountWithinRadius: number | null;
    competitionCategory: string;
    populationTotal: number | null;
    avgUnitPricePsf: number | null;
    retailTransactionCount: number;
  };
};

const focusRadiusOptions = [500, 750, 1000, 1500, 2000] as const;

const overlayMetricMap: Record<Overlay, OverlayMetricKey> = {
  Composite: "composite",
  Demographics: "demographics",
  Accessibility: "accessibility",
  Vacancy: "vacancy",
};

const overlayDescriptions: Record<Overlay, string> = {
  Composite: "Area readiness score from demographics, accessibility, and rental proxy.",
  Demographics: "Population-based demographic potential by planning area.",
  Accessibility: "Transit access from MRT exits and bus stop density.",
  Vacancy: "Rental pressure proxy using available URA retail transactions.",
};

const overlayColorBands = [
  { label: "80 - 100", meaning: "Very strong", color: "#0f766e" },
  { label: "65 - 79", meaning: "Strong", color: "#0ea5e9" },
  { label: "50 - 64", meaning: "Moderate", color: "#f59e0b" },
  { label: "0 - 49", meaning: "Weak", color: "#dc2626" },
  { label: "No data", meaning: "Metric unavailable", color: "#cbd5e1" },
] as const;

const layerMarkerStyles: Record<LayerToggleKey, { label: string; color: string; description: string }> = {
  mrtStations: {
    label: "MRT stations",
    color: "#7c3aed",
    description: "Purple circle markers",
  },
  mrtExits: {
    label: "MRT exits",
    color: "#2563eb",
    description: "Blue circle markers",
  },
  busStops: {
    label: "Bus stops",
    color: "#059669",
    description: "Green circle markers",
  },
};

const pointLayerFallbacks: Record<LayerToggleKey, PointLayerCollection> = {
  mrtStations: demoPointLayers.mrtStations as unknown as PointLayerCollection,
  mrtExits: demoPointLayers.mrtExits as unknown as PointLayerCollection,
  busStops: demoPointLayers.busStops as unknown as PointLayerCollection,
};

const pointLayerEndpoints: Record<LayerToggleKey, string> = {
  mrtStations: "/api/map/layers/mrt-stations",
  mrtExits: "/api/map/layers/mrt-exits",
  busStops: "/api/map/layers/bus-stops",
};

const MRT_EXITS_MIN_ZOOM = 15;

type GeoJsonPolygonCoordinates = number[][][];
type GeoJsonMultiPolygonCoordinates = number[][][][];

function formatRadiusLabel(radiusMeters: number) {
  return radiusMeters >= 1000 ? `${(radiusMeters / 1000).toFixed(radiusMeters % 1000 === 0 ? 0 : 1)} km` : `${radiusMeters} m`;
}

function formatLatLng(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toDisplayText(value: unknown, fallback = "—") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function isPlusCodeAddress(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /\b[A-Z0-9]{4,}\+[A-Z0-9]{2,}\b/i.test(value);
}

function toLocalMeters(lat: number, lng: number, originLat: number) {
  const metersPerLatDegree = 111_320;
  const metersPerLngDegree = 111_320 * Math.cos((originLat * Math.PI) / 180);

  return {
    x: lng * metersPerLngDegree,
    y: lat * metersPerLatDegree,
  };
}

function distancePointToSegmentMeters(
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  const pointXY = toLocalMeters(point.lat, point.lng, point.lat);
  const startXY = toLocalMeters(start.lat, start.lng, point.lat);
  const endXY = toLocalMeters(end.lat, end.lng, point.lat);
  const dx = endXY.x - startXY.x;
  const dy = endXY.y - startXY.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(pointXY.x - startXY.x, pointXY.y - startXY.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((pointXY.x - startXY.x) * dx + (pointXY.y - startXY.y) * dy) / (dx * dx + dy * dy),
    ),
  );
  const projection = {
    x: startXY.x + t * dx,
    y: startXY.y + t * dy,
  };

  return Math.hypot(pointXY.x - projection.x, pointXY.y - projection.y);
}

function pointInRing(point: { lat: number; lng: number }, ring: number[][]) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function getPolygonRings(
  geometry: OverlayCollection["features"][number]["geometry"],
) {
  const normalized = geometry as { type?: string; coordinates?: unknown };

  if (normalized.type === "Polygon") {
    return [normalized.coordinates as GeoJsonPolygonCoordinates];
  }

  if (normalized.type === "MultiPolygon") {
    return normalized.coordinates as GeoJsonMultiPolygonCoordinates;
  }

  return [];
}

function pointInGeometry(
  geometry: OverlayCollection["features"][number]["geometry"],
  point: { lat: number; lng: number },
) {
  const polygons = getPolygonRings(geometry);

  return polygons.some((polygon) => {
    const [outerRing, ...holes] = polygon;
    if (!outerRing?.length || !pointInRing(point, outerRing)) {
      return false;
    }

    return !holes.some((ring) => ring.length > 0 && pointInRing(point, ring));
  });
}

function geometryIntersectsRadius(
  geometry: OverlayCollection["features"][number]["geometry"],
  focus: { lat: number; lng: number },
  radiusMeters: number,
) {
  if (pointInGeometry(geometry, focus)) {
    return true;
  }

  const polygons = getPolygonRings(geometry);

  return polygons.some((polygon) =>
    polygon.some((ring) => {
      if (!ring?.length) {
        return false;
      }

      for (let index = 0; index < ring.length; index += 1) {
        const [lng, lat] = ring[index];
        if (haversineDistanceMeters(focus.lat, focus.lng, lat, lng) <= radiusMeters) {
          return true;
        }

        const [nextLng, nextLat] = ring[(index + 1) % ring.length];
        if (
          distancePointToSegmentMeters(
            focus,
            { lat, lng },
            { lat: nextLat, lng: nextLng },
          ) <= radiusMeters
        ) {
          return true;
        }
      }

      return false;
    }),
  );
}

function buildTransportFeatureDetails(
  key: LayerToggleKey,
  properties: Record<string, unknown>,
  source: "live" | "demo",
): SelectedTransportFeature {
  if (key === "mrtStations") {
    return {
      layerKey: key,
      label: toDisplayText(properties.label, "MRT station"),
      source,
      fields: [
        { label: "Station", value: toDisplayText(properties.stationName) },
        { label: "Line", value: toDisplayText(properties.lineName, "Not provided") },
        { label: "Mapped exits", value: toDisplayText(properties.exitCount, "0") },
      ],
    };
  }

  if (key === "mrtExits") {
    return {
      layerKey: key,
      label: toDisplayText(properties.label, "MRT exit"),
      source,
      fields: [
        { label: "Station", value: toDisplayText(properties.stationName) },
        { label: "Exit", value: toDisplayText(properties.exitNumber, "Not provided") },
      ],
    };
  }

  return {
    layerKey: key,
    label: toDisplayText(properties.label, "Bus stop"),
    source,
    fields: [
      { label: "Bus stop", value: toDisplayText(properties.busStopNumber) },
    ],
  };
}

function clamp100(v: number) {
  return Math.max(0, Math.min(100, v));
}

function normalize(w: Weights): Weights {
  const total = w.demographic + w.accessibility + w.rental + w.competition;
  if (total === 0) return presets.Normal;
  const mult = 100 / total;
  return {
    demographic: Math.round(w.demographic * mult),
    accessibility: Math.round(w.accessibility * mult),
    rental: Math.round(w.rental * mult),
    competition: Math.round(w.competition * mult),
  };
}

function computeCompositeFromScores(
  scores: Pick<SiteScoreResponse["scores"], "demographic" | "accessibility" | "rental" | "competition">,
  weights: Weights,
) {
  const normalizedWeights = normalize(weights);
  const weightedValues = [
    { value: scores.demographic, weight: normalizedWeights.demographic },
    { value: scores.accessibility, weight: normalizedWeights.accessibility },
    { value: scores.rental, weight: normalizedWeights.rental },
    { value: scores.competition, weight: normalizedWeights.competition },
  ].filter((entry): entry is { value: number; weight: number } => typeof entry.value === "number");

  if (!weightedValues.length) {
    return null;
  }

  const totalWeight = weightedValues.reduce((sum, entry) => sum + entry.weight, 0) || 100;
  return Math.round(
    weightedValues.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight,
  );
}

function formatScoreValue(value: number | null) {
  return value === null ? "—" : String(value);
}

function formatMetricValue(value: number | null, suffix = "") {
  return value === null ? "No data" : `${value}${suffix}`;
}

export default function MapPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const markerRef = useRef<any | null>(null);
  const googleRef = useRef<any | null>(null);
  const autocompleteRef = useRef<any | null>(null);
  const overlayLayerRef = useRef<any | null>(null);
  const focusCircleRef = useRef<any | null>(null);
  const mrtStationsLayerRef = useRef<any | null>(null);
  const busStopsLayerRef = useRef<any | null>(null);
  const mrtExitsLayerRef = useRef<any | null>(null);
  const overlayCacheRef = useRef<OverlayCollection | null>(null);
  const pointLayerCacheRef = useRef<Record<string, PointLayerCollection>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const mapStyleId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;
  const [selectedLatLng, setSelectedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [focusRadiusMeters, setFocusRadiusMeters] = useState<number>(1000);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [pendingSelection, setPendingSelection] = useState<{
    lat: number;
    lng: number;
    profileId?: string;
    siteName?: string;
    siteAddress?: string;
  } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(12);
  const [overlayData, setOverlayData] = useState<OverlayCollection | null>(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState<OverlayAreaDetails | null>(null);
  const [availableOverlays, setAvailableOverlays] = useState<Record<Overlay, boolean>>({
    Composite: true,
    Demographics: true,
    Accessibility: true,
    Vacancy: false,
  });
  const [layerVisibility, setLayerVisibility] = useState<Record<LayerToggleKey, boolean>>({
    mrtStations: false,
    mrtExits: false,
    busStops: false,
  });
  const [selectedTransportFeature, setSelectedTransportFeature] = useState<SelectedTransportFeature | null>(null);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [siteScore, setSiteScore] = useState<SiteScoreResponse | null>(null);
  const [siteScoreError, setSiteScoreError] = useState<string | null>(null);

  const [profiles, setProfiles] = useLocalStorageState<BusinessProfile[]>("smartlocate:profiles", []);
  const [, setSites] = useLocalStorageState<CandidateSite[]>("smartlocate:sites", []);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [scenario, setScenario] = useState<string>("Normal");
  const [overlay, setOverlay] = useState<Overlay>("Composite");
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationSummary, setExplanationSummary] = useState<string>("");
  const [serverExplanationItems, setServerExplanationItems] = useState<
    Array<{ label: string; score: number; detail: string }>
  >([]);
  const [detailedBreakdownText, setDetailedBreakdownText] = useState<string>("");
  const [isBreakdownSheetOpen, setIsBreakdownSheetOpen] = useState(false);
  const [isBreakdownEditMode, setIsBreakdownEditMode] = useState(false);
  const [isNotesSheetOpen, setIsNotesSheetOpen] = useState(false);
  const [scoreNotes, setScoreNotes] = useState("");

  const [weights, setWeights] = useState<Weights>(() => presets.Normal);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId),
    [profiles, activeProfileId],
  );

  const scores = useMemo(() => {
    const rawScores = siteScore?.scores ?? {
      demographic: null,
      accessibility: null,
      rental: null,
      competition: null,
      composite: null,
    };

    return {
      demographic: rawScores.demographic,
      accessibility: rawScores.accessibility,
      rental: rawScores.rental,
      competition: rawScores.competition,
      composite: computeCompositeFromScores(rawScores, weights),
    };
  }, [siteScore, weights]);

  const composite = scores.composite;
  const hasSelectedSite = Boolean(selectedLatLng);
  const mapMode = hasSelectedSite ? "focus" : "overview";
  const scoreValues = {
    demographic: scores.demographic ?? 0,
    accessibility: scores.accessibility ?? 0,
    rental: scores.rental ?? 0,
    competition: scores.competition ?? 0,
  };

  const fallbackExplanationItems = useMemo(() => {
    const demographicDetail =
      scoreValues.demographic >= 75
        ? "Strong overlap with target age groups and mid-income households."
        : scoreValues.demographic >= 60
          ? "Moderate overlap with target demographics; consider niche positioning."
          : "Lower match to target demographics; consider alternative areas.";

    const accessibilityDetail =
      scoreValues.accessibility >= 80
        ? "Transit access is strong with multiple MRT/bus options nearby."
        : scoreValues.accessibility >= 65
          ? "Reasonable transit access with some gaps during off-peak hours."
          : "Transit access is limited; expect lower walk-in traffic.";

    const rentalDetail =
      scoreValues.rental >= 75
        ? "Rental pressure is low, indicating more availability."
        : scoreValues.rental >= 60
          ? "Rental pressure is moderate; balance cost against demand."
          : "Rental pressure is high; expect higher leasing costs.";

    const competitionDetail =
      scoreValues.competition >= 75
        ? "Competition density is manageable with room for differentiation."
        : scoreValues.competition >= 60
          ? "Competition is moderate; watch pricing and positioning."
          : "Competition is intense; differentiation is critical.";

    return [
      {
        label: "Demographic match",
        score: scoreValues.demographic,
        detail: demographicDetail,
      },
      {
        label: "Accessibility",
        score: scoreValues.accessibility,
        detail: accessibilityDetail,
      },
      {
        label: "Rental pressure",
        score: scoreValues.rental,
        detail: rentalDetail,
      },
      {
        label: "Competition density",
        score: scoreValues.competition,
        detail: competitionDetail,
      },
    ];
  }, [scoreValues.accessibility, scoreValues.competition, scoreValues.demographic, scoreValues.rental]);

  const displayedExplanationItems =
    serverExplanationItems.length > 0 ? serverExplanationItems : fallbackExplanationItems;

  const quickRecommendations = useMemo(
    () => [...displayedExplanationItems].sort((a, b) => a.score - b.score).slice(0, 2),
    [displayedExplanationItems],
  );

  const resolvedPlanningAreaName =
    selectedArea?.planningAreaName ?? siteScore?.planningArea?.planningAreaName ?? null;

  const selectedLocationText = useMemo(() => {
    if (selectedAddress && !isPlusCodeAddress(selectedAddress)) {
      return selectedAddress;
    }
    if (selectedLatLng) {
      return resolvedPlanningAreaName
        ? `${resolvedPlanningAreaName} • ${formatLatLng(selectedLatLng.lat, selectedLatLng.lng)}`
        : `Selected site • ${formatLatLng(selectedLatLng.lat, selectedLatLng.lng)}`;
    }
    return "No location selected yet.";
  }, [resolvedPlanningAreaName, selectedAddress, selectedLatLng]);

  const modeSummary = hasSelectedSite
    ? `Focus mode: ${formatRadiusLabel(focusRadiusMeters)} around selected site`
    : "Overview mode: all planning areas";

  const shortBreakdownPreview = useMemo(() => {
    if (!detailedBreakdownText) {
      return "Click Generate to create a detailed AI breakdown for this location.";
    }

    const compact = detailedBreakdownText
      .replace(/[#*_`>-]/g, "")
      .replace(/\n+/g, " ")
      .trim();

    return compact.length > 220 ? `${compact.slice(0, 220)}...` : compact;
  }, [detailedBreakdownText]);

  const focusLatLng = useMemo(
    () => selectedLatLng ?? defaultCenter,
    [selectedLatLng],
  );

  const displayedOverlayData = useMemo(
    () =>
      mapMode === "overview"
        ? overlayData
        : filterOverlayCollectionByRadius(
            overlayData,
            focusLatLng,
            focusRadiusMeters,
            selectedArea?.planningAreaId ?? siteScore?.planningArea?.planningAreaId ?? null,
          ),
    [focusLatLng, focusRadiusMeters, mapMode, overlayData, selectedArea, siteScore],
  );

  const overlayStats = useMemo(() => {
    const metricKey = overlayMetricMap[overlay];
    const values =
      displayedOverlayData?.features
        .map((feature) => feature.properties[metricKey])
        .filter((value): value is number => typeof value === "number") ?? [];

    if (!values.length) {
      return null;
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      metricKey,
    };
  }, [displayedOverlayData, overlay]);

  const mrtExitZoomBlocked = hasSelectedSite && layerVisibility.mrtExits && mapZoom < MRT_EXITS_MIN_ZOOM;
  const selectedSiteChipMeta = [
    resolvedPlanningAreaName ? `Planning area: ${resolvedPlanningAreaName}` : null,
    hasSelectedSite ? `Radius: ${formatRadiusLabel(focusRadiusMeters)}` : null,
  ].filter(Boolean) as string[];

  const isAnySidePanelOpen = isBreakdownSheetOpen || isNotesSheetOpen;

  /*
  Legacy static explanation source (pre `/api/explain-score` integration)
  const explanationItems = useMemo(() => {
    const demographicDetail =
      scores.demographic >= 75
        ? "Strong overlap with target age groups and mid-income households."
        : scores.demographic >= 60
          ? "Moderate overlap with target demographics; consider niche positioning."
          : "Lower match to target demographics; consider alternative areas.";

    const accessibilityDetail =
      scores.accessibility >= 80
        ? "Transit access is strong with multiple MRT/bus options nearby."
        : scores.accessibility >= 65
          ? "Reasonable transit access with some gaps during off-peak hours."
          : "Transit access is limited; expect lower walk-in traffic.";

    const rentalDetail =
      scores.rental >= 75
        ? "Rental pressure is low, indicating more availability."
        : scores.rental >= 60
          ? "Rental pressure is moderate; balance cost against demand."
          : "Rental pressure is high; expect higher leasing costs.";

    const competitionDetail =
      scores.competition >= 75
        ? "Competition density is manageable with room for differentiation."
        : scores.competition >= 60
          ? "Competition is moderate; watch pricing and positioning."
          : "Competition is intense; differentiation is critical.";

    return [
      { label: "Demographic match", score: scores.demographic, detail: demographicDetail },
      { label: "Accessibility", score: scores.accessibility, detail: accessibilityDetail },
      { label: "Rental pressure", score: scores.rental, detail: rentalDetail },
      { label: "Competition density", score: scores.competition, detail: competitionDetail },
    ];
  }, [scores]);
  */

  const clearPin = () => {
    if (!markerRef.current) return;

    if (typeof markerRef.current.setMap === "function") {
      markerRef.current.setMap(null);
    } else if ("map" in markerRef.current) {
      markerRef.current.map = null;
    }

    markerRef.current = null;
  };

  const setPin = (latlng: any) => {
    const googleMaps = googleRef.current;
    if (!mapRef.current || !googleMaps) return;

    clearPin();

    const canUseAdvancedMarker = Boolean(googleMaps.marker?.AdvancedMarkerElement && mapStyleId);
    if (canUseAdvancedMarker) {
      markerRef.current = new googleMaps.marker.AdvancedMarkerElement({
        position: latlng,
        map: mapRef.current,
        title: "Selected site",
      });
      return;
    }

    markerRef.current = new googleMaps.maps.Marker({
      position: latlng,
      map: mapRef.current,
      title: "Selected site",
    });
  };

  const handleProfileChange = async (id: string) => {
    setActiveProfileId(id);
    setProfiles((prev) => {
      const next = prev.map((p) => ({ ...p, active: p.id === id }));
      writeApiCache(`profiles:${userId}`, next, PROFILES_CACHE_TTL_MS);
      return next;
    });

    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(id)}/activate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error("failed");
      }
    } catch {
      toast({
        title: "Failed to update active profile",
        description: "Using local profile state for now.",
        variant: "destructive",
      });
    }
  };

  const createId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const clearDataLayer = (layer: any | null) => {
    if (!layer) {
      return;
    }

    const toRemove: any[] = [];
    layer.forEach((feature: any) => {
      toRemove.push(feature);
    });
    toRemove.forEach((feature) => layer.remove(feature));
  };

  const getOverlayColor = (value: number | null) => {
    if (value === null) return "#cbd5e1";
    if (value >= 80) return "#0f766e";
    if (value >= 65) return "#0ea5e9";
    if (value >= 50) return "#f59e0b";
    return "#dc2626";
  };

  const applyOverlayStyles = () => {
    if (!overlayLayerRef.current) {
      return;
    }

    const metricKey = overlayMetricMap[overlay];
    const selectedAreaId = selectedArea?.planningAreaId ?? siteScore?.planningArea?.planningAreaId ?? null;

    overlayLayerRef.current.setStyle((feature: any) => {
      const value = feature.getProperty(metricKey);
      const planningAreaId = feature.getProperty("planningAreaId");
      const isSelected = selectedAreaId && planningAreaId === selectedAreaId;

      return {
        fillColor: getOverlayColor(typeof value === "number" ? value : null),
        fillOpacity: overlayVisible ? (typeof value === "number" ? (isSelected ? 0.68 : 0.56) : 0.22) : 0,
        strokeColor: isSelected ? "#0f172a" : "#64748b",
        strokeWeight: isSelected ? 3.25 : 1.1,
        clickable: true,
      };
    });
  };

  const applyPointLayer = async (
    key: LayerToggleKey,
    ref: { current: any | null },
    style: Record<string, unknown>,
    enabled: boolean,
    focus: { lat: number; lng: number },
    radiusMeters: number,
  ) => {
    const googleMaps = googleRef.current;
    if (!googleMaps?.maps || !mapRef.current) {
      return;
    }

    if (!ref.current) {
      ref.current = new googleMaps.maps.Data();
      ref.current.setStyle(style);
      ref.current.addListener("click", (event: any) => {
        const properties = event.feature?.forEachProperty
          ? (() => {
              const next: Record<string, unknown> = {};
              event.feature.forEachProperty((value: unknown, name: string) => {
                next[name] = value;
              });
              return next;
            })()
          : {};

        setSelectedTransportFeature(
          buildTransportFeatureDetails(
            key,
            properties,
            ref.current?.__smartlocateSource ?? "live",
          ),
        );
      });
    }

    if (!enabled) {
      ref.current.setMap(null);
      return;
    }

    const cacheKey =
      overlayData?.metadata.source === "demo"
        ? `demo:${key}`
        : `${key}:${focus.lat.toFixed(4)}:${focus.lng.toFixed(4)}:${radiusMeters}`;
    const cache = pointLayerCacheRef.current[cacheKey];
    const demoOnly = overlayData?.metadata.source === "demo";
    const collection =
      cache ??
      (await (demoOnly
        ? Promise.resolve(pointLayerFallbacks[key])
        : fetch(
            `${pointLayerEndpoints[key]}?lat=${encodeURIComponent(String(focus.lat))}&lng=${encodeURIComponent(
              String(focus.lng),
            )}&radiusMeters=${encodeURIComponent(String(radiusMeters))}`,
          )
            .then(async (response) => {
              if (!response.ok) {
                throw new Error("failed");
              }
              const data = (await response.json()) as PointLayerCollection;
              pointLayerCacheRef.current[cacheKey] = data;
              return data;
            })
            .catch(() => {
              const fallback = pointLayerFallbacks[key];
              pointLayerCacheRef.current[cacheKey] = fallback;
              return fallback;
            })));

    if (!pointLayerCacheRef.current[cacheKey]) {
      pointLayerCacheRef.current[cacheKey] = collection;
    }

    const focusedCollection = filterPointLayerCollectionByRadius(collection, focus, radiusMeters);
    clearDataLayer(ref.current);
    ref.current.addGeoJson(focusedCollection as any);
    ref.current.__smartlocateSource = collection.metadata.source ?? "live";
    ref.current.setMap(mapRef.current);
  };

  function getAreaCenter(feature: OverlayCollection["features"][number]) {
    const geometry = feature.geometry as {
      type?: string;
      coordinates?: unknown;
    };

    const firstRing =
      geometry.type === "Polygon"
        ? (geometry.coordinates as number[][][] | undefined)?.[0]
        : geometry.type === "MultiPolygon"
          ? (geometry.coordinates as number[][][][] | undefined)?.[0]?.[0]
          : undefined;

    if (!firstRing?.length) {
      return null;
    }

    const lngs = firstRing.map(([lng]) => lng);
    const lats = firstRing.map(([, lat]) => lat);

    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  }

  function filterOverlayCollectionByRadius(
    collection: OverlayCollection | null,
    focus: { lat: number; lng: number },
    radiusMeters: number,
    selectedAreaId: string | null,
  ): OverlayCollection | null {
    if (!collection) {
      return null;
    }

    const filteredFeatures = collection.features.filter((feature) => {
      if (feature.properties.planningAreaId === selectedAreaId) {
        return true;
      }

      return geometryIntersectsRadius(feature.geometry, focus, radiusMeters);
    });

    return {
      ...collection,
      features: filteredFeatures,
      metadata: {
        ...collection.metadata,
        featureCount: filteredFeatures.length,
      },
    };
  }

  function filterPointLayerCollectionByRadius(
    collection: PointLayerCollection,
    focus: { lat: number; lng: number },
    radiusMeters: number,
  ): PointLayerCollection {
    const filteredFeatures = collection.features.filter((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      return haversineDistanceMeters(focus.lat, focus.lng, lat, lng) <= radiusMeters;
    });

    return {
      ...collection,
      features: filteredFeatures,
      metadata: {
        ...collection.metadata,
        featureCount: filteredFeatures.length,
      },
    };
  }

  function findNearestOverlayArea(
    collection: OverlayCollection | null,
    latlng: { lat: number; lng: number } | null,
  ) {
    if (!collection || !latlng) {
      return null;
    }

    let nearest: OverlayAreaDetails | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    collection.features.forEach((feature) => {
      const center = getAreaCenter(feature);
      if (!center) {
        return;
      }

      const distance =
        (center.lat - latlng.lat) * (center.lat - latlng.lat) +
        (center.lng - latlng.lng) * (center.lng - latlng.lng);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = feature.properties;
      }
    });

    return nearest;
  }

  function buildDemoSiteScore(
    area: OverlayAreaDetails,
    latlng: { lat: number; lng: number },
    radiusMeters: number,
  ): SiteScoreResponse {
    const demographic = area.demographics;
    const accessibility = area.accessibility;
    const rental = area.vacancy;
    const competition = Math.max(40, Math.min(92, Math.round((area.composite ?? 70) - 8)));
    const radiusFactor = Math.max(1, radiusMeters / 500);

    return {
      lat: latlng.lat,
      lng: latlng.lng,
      planningArea: {
        planningAreaId: area.planningAreaId,
        planningAreaName: area.planningAreaName,
        areaCode: area.areaCode ?? area.planningAreaName.toUpperCase().replace(/\s+/g, "_"),
        regionName: area.regionName ?? null,
        populationTotal: area.populationTotal,
        effectiveYear: area.effectiveYear,
        busStopCount: area.busStopCount,
        mrtExitCount: area.mrtExitCount,
        avgUnitPricePsf: area.avgUnitPricePsf,
        retailTransactionCount: area.retailTransactionCount,
        demographicScore: area.demographics,
        accessibilityScore: area.accessibility,
        vacancyScore: area.vacancy,
        compositeScore: area.composite,
      },
      scores: {
        composite: area.composite,
        demographic,
        accessibility,
        rental,
        competition,
      },
      breakdownDetails: {
        analysisRadiusMeters: radiusMeters,
        busStopsWithinRadius: Math.max(3, Math.round((area.busStopCount / 5) * radiusFactor)),
        mrtExitsWithinRadius: Math.max(1, Math.round((area.mrtExitCount / 2) * radiusFactor)),
        competitionCountWithinRadius: Math.max(1, Math.round(((100 - competition) / 6) * radiusFactor)),
        competitionCategory: "demo-retail",
        populationTotal: area.populationTotal,
        avgUnitPricePsf: area.avgUnitPricePsf,
        retailTransactionCount: area.retailTransactionCount,
      },
    };
  }

  const applySelection = (selection: {
    lat: number;
    lng: number;
    profileId?: string;
    siteName?: string;
    siteAddress?: string;
  }) => {
    if (!mapRef.current) return;
    const loc = { lat: selection.lat, lng: selection.lng };
    mapRef.current.setCenter(loc);
    mapRef.current.setZoom(16);
    setSelectedLatLng(loc);
    const fallback = selection.siteAddress ?? selection.siteName ?? `Lat ${formatLatLng(loc.lat, loc.lng)}`;
    setSelectedAddress(fallback);
    setSearchQuery(fallback);
    setSelectedTransportFeature(null);
    setPin(loc);
    reverseGeocode(loc.lat, loc.lng);
    if (selection.profileId && profiles.some((p) => p.id === selection.profileId)) {
      handleProfileChange(selection.profileId);
    }
  };

  const reverseGeocode = (lat: number, lng: number) => {
    const googleMaps = googleRef.current;
    if (!googleMaps?.maps) {
      setSelectedAddress(`Lat ${formatLatLng(lat, lng)}`);
      return;
    }

    const geocoder = new googleMaps.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === "OK" && results?.length) {
        const address = results[0]?.formatted_address;
        if (address) {
          setSelectedAddress(address);
          setSearchQuery(address);
          return;
        }
      }
      setSelectedAddress(`Lat ${formatLatLng(lat, lng)}`);
    });
  };

  const runSearch = async () => {
    if (!apiKey) {
      toast({
        title: "Missing API key",
        description: "Set VITE_GOOGLE_MAPS_API_KEY to enable search.",
        variant: "destructive",
      });
      return;
    }
    if (!mapRef.current) {
      toast({
        title: "Map loading",
        description: "Please wait for the map to initialize.",
        variant: "destructive",
      });
      return;
    }
    const query = searchQuery.trim();
    if (!query) {
      toast({
        title: "Enter a postal code",
        description: "Try a 6-digit Singapore postal code.",
        variant: "destructive",
      });
      return;
    }

    const isPostal = /^\d{6}$/.test(query);
    const address = isPostal ? `${query} Singapore` : query;

    setSearching(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`,
      );
      const data = await res.json();
      if (data.status !== "OK" || !data.results?.length) {
        throw new Error("No results");
      }
      const result = data.results[0];
      const loc = result.geometry.location;
      mapRef.current.setCenter(loc);
      mapRef.current.setZoom(16);
      setSelectedLatLng({ lat: loc.lat, lng: loc.lng });
      setSelectedAddress(result.formatted_address ?? address);
      setPin(loc);
      setSearchQuery(result.formatted_address ?? query);
      toast({
        title: "Location found",
        description: result.formatted_address ?? address,
      });
    } catch {
      toast({
        title: "Address not found",
        description: "Check the postal code and try again.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const saveToPortfolio = () => {
    if (!activeProfile) {
      toast({
        title: "Select an active profile",
        description: "Choose a business profile before saving a site.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedLatLng) {
      toast({
        title: "Drop a pin first",
        description: "Click on the map to pick a location.",
        variant: "destructive",
      });
      return;
    }

    if (!siteScore || composite === null) {
      toast({
        title: "Score still loading",
        description: "Wait for the live site score before saving this location.",
        variant: "destructive",
      });
      return;
    }

    const savedAt = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const newSite = {
      id: createId(),
      name: `${activeProfile.name} site`,
      address: selectedLocationText,
      composite,
      demographic: scoreValues.demographic,
      accessibility: scoreValues.accessibility,
      rental: scoreValues.rental,
      competition: scoreValues.competition,
      savedAt,
      profileId: activeProfile.id,
      lat: selectedLatLng.lat,
      lng: selectedLatLng.lng,
      notes: scoreNotes,
      planningAreaId: siteScore.planningArea?.planningAreaId,
    };

    const breakdownPayload = {
      markdown: detailedBreakdownText || null,
      summary:
        explanationSummary ||
        `Composite score is ${composite ?? "unavailable"}. Scores are sourced from live backend data for the selected location.`,
      items: displayedExplanationItems,
      location: {
        address: hasSelectedSite ? selectedLocationText : undefined,
        lat: selectedLatLng.lat,
        lng: selectedLatLng.lng,
      },
      scores,
      profile: activeProfile
        ? {
            id: activeProfile.id,
            name: activeProfile.name,
            sector: activeProfile.sector,
            priceBand: activeProfile.priceBand,
          }
        : null,
      generatedAt: new Date().toISOString(),
      planningArea: siteScore.planningArea,
      rawBreakdown: siteScore.breakdownDetails,
    };

    void (async () => {
      try {
        const response = await fetch("/api/sites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            profileId: activeProfile.id,
            name: newSite.name,
            address: newSite.address,
            lat: newSite.lat,
            lng: newSite.lng,
            planningAreaId: newSite.planningAreaId ?? undefined,
            composite: newSite.composite,
            demographic: newSite.demographic,
            accessibility: newSite.accessibility,
            rental: newSite.rental,
            competition: newSite.competition,
            notes: scoreNotes,
            scoreNotes,
            breakdownDetailsJson: breakdownPayload,
          }),
        });

        if (!response.ok) {
          throw new Error("failed");
        }
      } catch {
        toast({
          title: "Server sync unavailable",
          description: "Saved in local state for now. Database sync can be retried later.",
          variant: "destructive",
        });
      } finally {
        setSites((prev) => {
          const next = [newSite, ...prev];
          writeApiCache(`sites:${userId}`, next, SITES_CACHE_TTL_MS);
          return next;
        });
        toast({ title: "Saved to portfolio", description: "Site added to your list." });
      }
    })();
  };

  const buildDetailedBreakdownMarkdown = (
    summary: string,
    items: Array<{ label: string; score: number; detail: string }>,
  ) => {
    const locationLine = hasSelectedSite ? selectedLocationText : "No location selected";

    const lines = [
      "# Detailed Score Breakdown",
      "",
      `- **Location:** ${locationLine}`,
      `- **Composite Score:** ${composite ?? "Unavailable"}`,
      `- **Scenario:** ${scenario}`,
      activeProfile
        ? `- **Active Profile:** ${activeProfile.name} (${activeProfile.sector})`
        : "- **Active Profile:** Not selected",
      "",
      "## Summary",
      summary,
      "",
      "## Dimension Details",
      ...items.flatMap((item) => [
        `### ${item.label} (${item.score}/100)`,
        item.detail,
        "",
      ]),
      "## Recommended Next Actions",
      ...quickRecommendations.map((item, index) => `${index + 1}. Improve ${item.label.toLowerCase()}: ${item.detail}`),
    ];

    return lines.join("\n").trim();
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("map-sidepanel-open", isAnySidePanelOpen);

    return () => {
      document.body.classList.remove("map-sidepanel-open");
    };
  }, [isAnySidePanelOpen]);

  const generateDetailedBreakdown = async () => {
    const result = await requestExplanation();

    const summary =
      result?.summary ||
      explanationSummary ||
      `Composite score is ${composite ?? "unavailable"}. Scores are sourced from live backend data for the selected location.`;
    const items = result?.items ?? displayedExplanationItems;
    const markdown = buildDetailedBreakdownMarkdown(summary, items);
    setDetailedBreakdownText(markdown);
  };

  const requestExplanation = async () => {
    if (!hasSelectedSite) {
      return {
        summary: "Select a site first to generate a location-specific explanation.",
        items: fallbackExplanationItems,
      };
    }

    setExplanationLoading(true);
    setServerExplanationItems([]);

    try {
      const response = await fetch("/api/explain-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile: activeProfile
            ? {
                name: activeProfile.name,
                sector: activeProfile.sector,
                priceBand: activeProfile.priceBand,
                ageGroups: activeProfile.ageGroups,
                incomeBands: activeProfile.incomeBands,
                operatingModel: activeProfile.operatingModel,
              }
            : undefined,
          location: {
            address: hasSelectedSite ? selectedLocationText : undefined,
            lat: selectedLatLng?.lat,
            lng: selectedLatLng?.lng,
            planningArea: siteScore?.planningArea?.planningAreaName,
          },
          scores: {
            composite: composite ?? 0,
            demographic: scoreValues.demographic,
            accessibility: scoreValues.accessibility,
            rental: scoreValues.rental,
            competition: scoreValues.competition,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("failed");
      }

      const data = (await response.json()) as {
        summary?: string;
        items?: Array<{ label: string; score: number; detail: string }>;
      };

      const resolvedSummary =
        data.summary ??
        `Composite score is ${composite ?? "unavailable"}. Scores are sourced from live backend data for the selected location.`;
      const resolvedItems = Array.isArray(data.items) ? data.items : fallbackExplanationItems;

      setExplanationSummary(resolvedSummary);
      setServerExplanationItems(resolvedItems);

      return {
        summary: resolvedSummary,
        items: resolvedItems,
      };
    } catch {
      const fallbackSummary =
        `Composite score is ${composite ?? "unavailable"}. Showing fallback explanation because the AI endpoint is unavailable.`;

      setExplanationSummary(fallbackSummary);
      setServerExplanationItems(fallbackExplanationItems);

      return {
        summary: fallbackSummary,
        items: fallbackExplanationItems,
      };
    } finally {
      setExplanationLoading(false);
    }
  };

  /*
  Legacy dialog behavior: no API request, always static explanation
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="secondary" className="justify-between" data-testid="button-explain-score">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Explain score
        </span>
        <span className="text-muted-foreground">↵</span>
      </Button>
    </DialogTrigger>
  </Dialog>
  */

  useEffect(() => {
    let cancelled = false;

    const fetchProfiles = async () => {
      if (authLoading || !userId) {
        return;
      }

      try {
        const rows = await fetchJsonWithCache<
          Array<{
          id: string;
          name: string;
          sector: string;
          priceBand: string;
          ageGroups: string[];
          incomeBands: string[];
          operatingModel: string;
          active: boolean;
          updatedAt: string;
          }>
        >(
          `profiles:${userId}`,
          `/api/profiles?userId=${encodeURIComponent(userId)}`,
          { ttlMs: PROFILES_CACHE_TTL_MS },
        );

        const mapped: BusinessProfile[] = rows.map((row) => ({
          id: row.id,
          name: row.name,
          sector: row.sector,
          priceBand: row.priceBand,
          ageGroups: row.ageGroups,
          incomeBands: row.incomeBands,
          operatingModel: row.operatingModel,
          active: row.active,
          updatedAt: new Date(row.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        }));

        if (!cancelled) {
          setProfiles(mapped);
        }
      } catch {
        if (!cancelled && profiles.length === 0) {
          setProfiles(mockProfiles);
        }
      }
    };

    fetchProfiles();

    return () => {
      cancelled = true;
    };
  }, [profiles.length, setProfiles, userId, authLoading]);

  /*
  Legacy local-only active profile init behavior
  useEffect(() => {
    const active = profiles.find((p) => p.active)?.id ?? "";
    setActiveProfileId(active);
  }, [profiles]);
  */

  useEffect(() => {
    const active = profiles.find((p) => p.active)?.id ?? "";
    setActiveProfileId(active);
  }, [profiles]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("smartlocate:mapSelection");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as {
        lat: number;
        lng: number;
        profileId?: string;
        siteName?: string;
      };
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        setPendingSelection(data);
      }
    } catch {
      // ignore malformed data
    }
  }, []);

  useEffect(() => {
    if (!mapReady || !pendingSelection) return;
    applySelection(pendingSelection);
    setPendingSelection(null);
    localStorage.removeItem("smartlocate:mapSelection");
  }, [mapReady, pendingSelection]);

  useEffect(() => {
    if (!mapReady || overlayCacheRef.current) {
      if (overlayCacheRef.current && !overlayData) {
        setOverlayData(overlayCacheRef.current);
      }
      return;
    }

    let cancelled = false;

    const fetchOverlayData = async () => {
      setOverlayLoading(true);
      try {
        const response = await fetch(
          `/api/map/overlays?metric=${encodeURIComponent(overlayMetricMap[overlay])}`,
        );

        if (!response.ok) {
          throw new Error("failed");
        }

        const data = (await response.json()) as OverlayCollection;
        if (cancelled) {
          return;
        }

        overlayCacheRef.current = data;
        setOverlayData(data);
        setAvailableOverlays({
          Composite: data.metadata.availableMetrics.composite,
          Demographics: data.metadata.availableMetrics.demographics,
          Accessibility: data.metadata.availableMetrics.accessibility,
          Vacancy: data.metadata.availableMetrics.vacancy,
        });
      } catch {
        if (!cancelled) {
          const fallbackData = {
            ...demoOverlayCollection,
            metadata: {
              ...demoOverlayCollection.metadata,
              requestedMetric: overlayMetricMap[overlay],
            },
          } as unknown as OverlayCollection;

          overlayCacheRef.current = fallbackData;
          setOverlayData(fallbackData);
          setAvailableOverlays({
            Composite: fallbackData.metadata.availableMetrics.composite,
            Demographics: fallbackData.metadata.availableMetrics.demographics,
            Accessibility: fallbackData.metadata.availableMetrics.accessibility,
            Vacancy: fallbackData.metadata.availableMetrics.vacancy,
          });
          toast({
            title: "Using demo overlay data",
            description: "Live overlay data is unavailable, so demo planning areas are shown instead.",
          });
        }
      } finally {
        if (!cancelled) {
          setOverlayLoading(false);
        }
      }
    };

    void fetchOverlayData();

    return () => {
      cancelled = true;
    };
  }, [mapReady, overlay, overlayData, toast]);

  useEffect(() => {
    if (!overlayData) {
      return;
    }

    const nextAvailability = {
      Composite: overlayData.metadata.availableMetrics.composite,
      Demographics: overlayData.metadata.availableMetrics.demographics,
      Accessibility: overlayData.metadata.availableMetrics.accessibility,
      Vacancy: overlayData.metadata.availableMetrics.vacancy,
    };
    setAvailableOverlays(nextAvailability);

    if (!nextAvailability[overlay]) {
      setOverlay("Composite");
    }
  }, [overlay, overlayData]);

  useEffect(() => {
    if (!overlayLayerRef.current) {
      return;
    }

    clearDataLayer(overlayLayerRef.current);
    if (displayedOverlayData) {
      overlayLayerRef.current.addGeoJson(displayedOverlayData as any);
    }
    overlayLayerRef.current.setMap(overlayVisible ? mapRef.current : null);
    applyOverlayStyles();
  }, [displayedOverlayData, overlayVisible]);

  useEffect(() => {
    applyOverlayStyles();
  }, [overlay, overlayVisible, selectedArea, siteScore]);

  useEffect(() => {
    const googleMaps = googleRef.current;
    if (!mapReady || !mapRef.current || !googleMaps?.maps) {
      return;
    }

    if (!focusCircleRef.current) {
      focusCircleRef.current = new googleMaps.maps.Circle({
        map: mapRef.current,
        strokeColor: "#0f766e",
        strokeOpacity: 0.9,
        strokeWeight: 1.5,
        fillColor: "#14b8a6",
        fillOpacity: 0.08,
      });
    }

    if (hasSelectedSite) {
      focusCircleRef.current.setCenter(focusLatLng);
      focusCircleRef.current.setRadius(focusRadiusMeters);
      focusCircleRef.current.setMap(mapRef.current);
    } else {
      focusCircleRef.current.setMap(null);
    }
  }, [focusLatLng, focusRadiusMeters, hasSelectedSite, mapReady]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    void (async () => {
      try {
        await applyPointLayer(
          "mrtStations",
          mrtStationsLayerRef,
          {
            icon: {
              path: googleRef.current?.maps?.SymbolPath?.CIRCLE ?? 0,
              scale: 5,
              fillColor: "#7c3aed",
              fillOpacity: 0.9,
              strokeColor: "#ffffff",
              strokeWeight: 1.5,
            },
          },
          layerVisibility.mrtStations && hasSelectedSite,
          focusLatLng,
          focusRadiusMeters,
        );
      } catch {
        toast({
          title: "MRT stations unavailable",
          description: "Could not load the MRT station layer from the server.",
          variant: "destructive",
        });
      }
    })();
  }, [focusLatLng, focusRadiusMeters, hasSelectedSite, layerVisibility.mrtStations, mapReady, toast]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    void (async () => {
      try {
        await applyPointLayer(
          "mrtExits",
          mrtExitsLayerRef,
          {
            icon: {
              path: googleRef.current?.maps?.SymbolPath?.CIRCLE ?? 0,
              scale: 4,
              fillColor: "#2563eb",
              fillOpacity: 0.9,
              strokeColor: "#ffffff",
              strokeWeight: 1,
            },
          },
          layerVisibility.mrtExits && hasSelectedSite && mapZoom >= MRT_EXITS_MIN_ZOOM,
          focusLatLng,
          focusRadiusMeters,
        );
      } catch {
        toast({
          title: "MRT exits unavailable",
          description: "Could not load the MRT exit layer from the server.",
          variant: "destructive",
        });
      }
    })();
  }, [focusLatLng, focusRadiusMeters, hasSelectedSite, layerVisibility.mrtExits, mapReady, mapZoom, toast]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    void (async () => {
      try {
        await applyPointLayer(
          "busStops",
          busStopsLayerRef,
          {
            icon: {
              path: googleRef.current?.maps?.SymbolPath?.CIRCLE ?? 0,
              scale: 3,
              fillColor: "#059669",
              fillOpacity: 0.85,
              strokeColor: "#ffffff",
              strokeWeight: 1,
            },
          },
          layerVisibility.busStops && hasSelectedSite,
          focusLatLng,
          focusRadiusMeters,
        );
      } catch {
        toast({
          title: "Bus stops unavailable",
          description: "Could not load the bus stop layer from the server.",
          variant: "destructive",
        });
      }
    })();
  }, [focusLatLng, focusRadiusMeters, hasSelectedSite, layerVisibility.busStops, mapReady, toast]);

  useEffect(() => {
    if (!selectedLatLng) {
      setSiteScore(null);
      setSiteScoreError(null);
      return;
    }

    let cancelled = false;

    const fetchSiteScore = async () => {
      setScoringLoading(true);
      setSiteScoreError(null);

      try {
        if (overlayData?.metadata.source === "demo") {
          const fallbackArea = findNearestOverlayArea(overlayData, selectedLatLng);
          if (!fallbackArea) {
            throw new Error("missing-demo-area");
          }

          const fallbackScore = buildDemoSiteScore(fallbackArea, selectedLatLng, focusRadiusMeters);
          if (!cancelled) {
            setSiteScore(fallbackScore);
            setSelectedArea(fallbackArea);
            setSiteScoreError("Using demo site scoring because live backend data is unavailable.");
          }
          return;
        }

        const response = await fetch("/api/map/site-score", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lat: selectedLatLng.lat,
            lng: selectedLatLng.lng,
            profileId: activeProfileId || undefined,
            radiusMeters: focusRadiusMeters,
          }),
        });

        if (!response.ok) {
          throw new Error("failed");
        }

        const data = (await response.json()) as SiteScoreResponse;
        if (cancelled) {
          return;
        }

        setSiteScore(data);

        if (data.planningArea) {
          setSelectedArea({
            planningAreaId: data.planningArea.planningAreaId,
            planningAreaName: data.planningArea.planningAreaName,
            areaCode: data.planningArea.areaCode,
            regionName: data.planningArea.regionName,
            composite: data.planningArea.compositeScore,
            demographics: data.planningArea.demographicScore,
            accessibility: data.planningArea.accessibilityScore,
            vacancy: data.planningArea.vacancyScore,
            populationTotal: data.planningArea.populationTotal,
            effectiveYear: data.planningArea.effectiveYear,
            busStopCount: data.planningArea.busStopCount,
            mrtExitCount: data.planningArea.mrtExitCount,
            avgUnitPricePsf: data.planningArea.avgUnitPricePsf,
            retailTransactionCount: data.planningArea.retailTransactionCount,
          });
        }
      } catch {
        if (!cancelled) {
          const fallbackArea = findNearestOverlayArea(overlayData, selectedLatLng);

          if (fallbackArea) {
            const fallbackScore = buildDemoSiteScore(fallbackArea, selectedLatLng, focusRadiusMeters);
            setSiteScore(fallbackScore);
            setSelectedArea(fallbackArea);
            setSiteScoreError("Using demo site scoring because live backend data is unavailable.");
          } else {
            setSiteScore(null);
            setSiteScoreError("Could not score this site using backend data.");
          }
        }
      } finally {
        if (!cancelled) {
          setScoringLoading(false);
        }
      }
    };

    void fetchSiteScore();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, focusRadiusMeters, overlayData, selectedLatLng]);

  useEffect(() => {
    if (selectedTransportFeature && !layerVisibility[selectedTransportFeature.layerKey]) {
      setSelectedTransportFeature(null);
    }
  }, [layerVisibility, selectedTransportFeature]);

  useEffect(() => {
    if (selectedTransportFeature?.layerKey === "mrtExits" && mrtExitZoomBlocked) {
      setSelectedTransportFeature(null);
    }
  }, [mrtExitZoomBlocked, selectedTransportFeature]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!apiKey) {
      setMapError("Missing Google Maps API key. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.");
      toast({
        title: "Google Maps key required",
        description: "Set VITE_GOOGLE_MAPS_API_KEY to load the interactive map.",
        variant: "destructive",
      });
      return;
    }

    let cancelled = false;
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places", "marker"],
    });

    loader
      .load()
      .then((googleMaps) => {
        if (cancelled || !mapContainerRef.current) return;
        googleRef.current = googleMaps;

        const map = new googleMaps.maps.Map(mapContainerRef.current, {
          center: { lat: 1.3521, lng: 103.8198 },
          zoom: 12,
          minZoom: 11,
          maxZoom: 19,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapId: mapStyleId,
        });

        setMapZoom(map.getZoom() ?? 12);
        map.addListener("zoom_changed", () => {
          setMapZoom(map.getZoom() ?? 12);
        });

        setMapZoom(map.getZoom() ?? 12);
        map.addListener("zoom_changed", () => {
          setMapZoom(map.getZoom() ?? 12);
        });

        map.addListener("click", (event: any) => {
          if (!event?.latLng) return;
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          setSelectedTransportFeature(null);
          setSelectedLatLng({ lat, lng });
          reverseGeocode(lat, lng);
          setPin(event.latLng);
          toast({
            title: "Pin dropped",
            description: "Fetching live site score for the selected location.",
          });
        });

        const overlayLayer = new googleMaps.maps.Data();
        overlayLayer.setMap(map);
        overlayLayer.addListener("click", (event: any) => {
          const feature = event.feature;
          setSelectedTransportFeature(null);
          setSelectedArea({
            planningAreaId: String(feature.getProperty("planningAreaId") ?? ""),
            planningAreaName: String(feature.getProperty("planningAreaName") ?? "Planning area"),
            areaCode: String(feature.getProperty("areaCode") ?? ""),
            regionName: (feature.getProperty("regionName") as string | null | undefined) ?? null,
            composite:
              typeof feature.getProperty("composite") === "number"
                ? feature.getProperty("composite")
                : null,
            demographics:
              typeof feature.getProperty("demographics") === "number"
                ? feature.getProperty("demographics")
                : null,
            accessibility:
              typeof feature.getProperty("accessibility") === "number"
                ? feature.getProperty("accessibility")
                : null,
            vacancy:
              typeof feature.getProperty("vacancy") === "number"
                ? feature.getProperty("vacancy")
                : null,
            populationTotal:
              typeof feature.getProperty("populationTotal") === "number"
                ? feature.getProperty("populationTotal")
                : null,
            effectiveYear:
              typeof feature.getProperty("effectiveYear") === "number"
                ? feature.getProperty("effectiveYear")
                : null,
            busStopCount:
              typeof feature.getProperty("busStopCount") === "number"
                ? feature.getProperty("busStopCount")
                : 0,
            mrtExitCount:
              typeof feature.getProperty("mrtExitCount") === "number"
                ? feature.getProperty("mrtExitCount")
                : 0,
            avgUnitPricePsf:
              typeof feature.getProperty("avgUnitPricePsf") === "number"
                ? feature.getProperty("avgUnitPricePsf")
                : null,
            retailTransactionCount:
              typeof feature.getProperty("retailTransactionCount") === "number"
                ? feature.getProperty("retailTransactionCount")
                : 0,
          });
        });
        overlayLayerRef.current = overlayLayer;

        mapRef.current = map;
        setMapError(null);
        setMapReady(true);

        if (searchInputRef.current && !autocompleteRef.current) {
          const autocomplete = new googleMaps.maps.places.Autocomplete(searchInputRef.current, {
            fields: ["geometry", "formatted_address", "name"],
            componentRestrictions: { country: "sg" },
          });
          autocomplete.bindTo("bounds", map);
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            const location = place.geometry?.location;
            if (!location) {
              toast({
                title: "Location not found",
                description: "Select a location from the suggestions.",
                variant: "destructive",
              });
              return;
            }
            const lat = location.lat();
            const lng = location.lng();
            map.setCenter(location);
            map.setZoom(16);
            setSelectedTransportFeature(null);
            setSelectedLatLng({ lat, lng });
            const address = place.formatted_address || place.name || `Lat ${formatLatLng(lat, lng)}`;
            setSelectedAddress(address);
            setSearchQuery(address);
            setPin(location);
          });
          autocompleteRef.current = autocomplete;
        }
      })
      .catch(() => {
        setMapError("Unable to load Google Maps. Check your API key and billing status.");
        toast({
          title: "Map failed to load",
          description: "Verify Maps JavaScript API, billing, and key referrer/API restrictions.",
          variant: "destructive",
        });
      });

    return () => {
      cancelled = true;
      overlayLayerRef.current?.setMap?.(null);
      focusCircleRef.current?.setMap?.(null);
      mrtStationsLayerRef.current?.setMap?.(null);
      busStopsLayerRef.current?.setMap?.(null);
      mrtExitsLayerRef.current?.setMap?.(null);
      overlayLayerRef.current = null;
      focusCircleRef.current = null;
      mrtStationsLayerRef.current = null;
      busStopsLayerRef.current = null;
      mrtExitsLayerRef.current = null;
      clearPin();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [apiKey, mapStyleId, toast]);

  return (
    <AppShell title="Map">
      <div
        className={`map-page-grid-wrap transition-[padding-right] duration-200 ${
          isAnySidePanelOpen ? "is-sidepanel-open" : ""
        }`}
      >
        <div className="grid gap-3 lg:items-start lg:grid-cols-[360px_minmax(0,1fr)_360px] xl:grid-cols-[380px_minmax(0,1fr)_380px]">
        <Card className="border bg-card p-4 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold" data-testid="text-map-controls-title">Controls</div>
              <div className="mt-1 text-xs text-muted-foreground" data-testid="text-map-controls-sub">
                Select profile, scenario, overlays, and layers.
              </div>
            </div>

            <div className="space-y-2 rounded-xl border bg-muted/10 p-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Choose the active business profile used for live scoring.
                </div>
              </div>
              <Select value={activeProfileId} onValueChange={handleProfileChange}>
                <SelectTrigger data-testid="select-active-profile">
                  <SelectValue placeholder="Select a profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} data-testid={`select-item-profile-${p.id}`}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!activeProfile && (
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="status-no-profile">
                  No active profile selected. Create/select a profile to score locations.
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <div className="space-y-2 rounded-xl border bg-muted/10 p-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scenario</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Apply preset priorities before adjusting the weighting mix.
                  </div>
                </div>
                <Select
                  value={scenario}
                  onValueChange={(v) => {
                    setScenario(v);
                    setWeights(presets[v] ?? presets.Normal);
                  }}
                >
                  <SelectTrigger data-testid="select-scenario">
                    <SelectValue placeholder="Scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(presets).map((k) => (
                      <SelectItem key={k} value={k} data-testid={`select-item-scenario-${k}`}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary" className="justify-between" data-testid="button-adjust-weights">
                    <span className="inline-flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                      Weight adjustment
                    </span>
                    <span className="text-muted-foreground">100%</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-lg">
                  <SheetHeader>
                    <SheetTitle data-testid="text-weights-title">Adjust weights</SheetTitle>
                  </SheetHeader>

                  <div className="mt-5 space-y-5">
                    {([
                      ["Demographic Match", "demographic"],
                      ["Accessibility", "accessibility"],
                      ["Rental Pressure", "rental"],
                      ["Competition Density", "competition"],
                    ] as const).map(([label, key]) => (
                      <div key={key} className="space-y-2" data-testid={`group-weight-${key}`}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-medium" data-testid={`text-weight-label-${key}`}>{label}</div>
                          <div className="text-muted-foreground" data-testid={`text-weight-value-${key}`}>{weights[key]}%</div>
                        </div>
                        <Slider
                          value={[weights[key]]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(v) =>
                            setWeights((prev) => ({ ...prev, [key]: clamp100(v[0] ?? 0) }))
                          }
                          data-testid={`slider-weight-${key}`}
                        />
                      </div>
                    ))}

                    <div className="rounded-xl border bg-muted/30 p-3 text-sm" data-testid="text-weight-total">
                      Total: {weights.demographic + weights.accessibility + weights.rental + weights.competition}% (auto-normalized)
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setWeights(presets.Normal)}
                        data-testid="button-reset-weights"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={() => {
                          setWeights((prev) => normalize(prev));
                          toast({ title: "Weights applied", description: "Scores updated." });
                        }}
                        data-testid="button-apply-weights"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="space-y-2 rounded-xl border bg-muted/10 p-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overlay</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Switch the planning-area metric or hide the choropleth entirely.
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select value={overlay} onValueChange={(v) => setOverlay(v as Overlay)}>
                    <SelectTrigger data-testid="select-overlay">
                      <SelectValue placeholder="Overlay" />
                    </SelectTrigger>
                    <SelectContent>
                      {(["Composite", "Demographics", "Accessibility", "Vacancy"] as Overlay[]).map((o) => (
                        <SelectItem
                          key={o}
                          value={o}
                          disabled={!availableOverlays[o]}
                          data-testid={`select-item-overlay-${o}`}
                        >
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant={overlayVisible ? "default" : "outline"}
                    className="justify-between"
                    aria-pressed={overlayVisible}
                    onClick={() => setOverlayVisible((prev) => !prev)}
                    data-testid="toggle-overlay-visibility"
                  >
                    <span>{overlayVisible ? "Overlay on" : "Overlay off"}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        overlayVisible
                          ? "bg-white/15 text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {overlayVisible ? "Visible" : "Hidden"}
                    </span>
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border bg-muted/10 p-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Radius</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Focus the scoring and nearby transport layers from 500 m to 2 km.
                  </div>
                </div>
                <Select
                  value={String(focusRadiusMeters)}
                  onValueChange={(value) => setFocusRadiusMeters(Number(value))}
                >
                  <SelectTrigger data-testid="select-focus-radius">
                    <SelectValue placeholder="Focus radius" />
                  </SelectTrigger>
                  <SelectContent>
                    {focusRadiusOptions.map((radius) => (
                      <SelectItem
                        key={radius}
                        value={String(radius)}
                        data-testid={`select-item-focus-radius-${radius}`}
                      >
                        {formatRadiusLabel(radius)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-lg border bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
                  {modeSummary}
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-xs" data-testid="panel-overlay-legend">
                <div className="text-xs font-semibold text-muted-foreground">Overlay legend</div>
                <div className="mt-2 grid gap-2 text-muted-foreground">
                  <div>{overlayDescriptions[overlay]}</div>
                  <div className="flex items-center justify-between">
                    <span>Availability</span>
                    <span>
                      {availableOverlays[overlay]
                        ? overlayData?.metadata.source === "demo"
                          ? "Demo data"
                          : "Live data"
                        : "Unavailable"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Current values in view</span>
                    <span>
                      {overlayStats ? `${overlayStats.min} to ${overlayStats.max}` : "No values"}
                    </span>
                  </div>
                  <div className="rounded-lg border bg-background/70 p-2">
                    <div className="text-[11px] font-medium text-foreground">How map colors are assigned</div>
                    <div className="mt-1 text-[11px] leading-5">
                      Each planning area is scored on a fixed <span className="font-medium text-foreground">0 to 100</span> scale for the selected overlay.
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      {overlayColorBands.map((band) => (
                        <div key={band.label} className="flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full border border-black/10"
                              style={{ backgroundColor: band.color }}
                              aria-hidden="true"
                            />
                            <span className="text-[11px] text-foreground">{band.meaning}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{band.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <span>
                      {overlayLoading
                        ? "Loading..."
                        : mapMode === "overview"
                          ? `${displayedOverlayData?.metadata.featureCount ?? 0} planning areas nationwide${
                              overlayData?.metadata.source === "demo" ? " (demo)" : ""
                            }`
                          : `${displayedOverlayData?.metadata.featureCount ?? 0} planning areas in focus${
                              overlayData?.metadata.source === "demo" ? " (demo)" : ""
                            }`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-3" data-testid="group-layer-toggles">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layers</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Toggle transport markers. Layers render around the selected site only.
                </div>
                <div className="mt-2 grid gap-2">
                  <Button
                    type="button"
                    variant={layerVisibility.mrtStations ? "default" : "outline"}
                    className="justify-between"
                    aria-pressed={layerVisibility.mrtStations}
                    onClick={() =>
                      setLayerVisibility((prev) => ({ ...prev, mrtStations: !prev.mrtStations }))
                    }
                    data-testid="toggle-layer-mrt-stations"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-black/10"
                        style={{ backgroundColor: layerMarkerStyles.mrtStations.color }}
                        aria-hidden="true"
                      />
                      <span>MRT stations</span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        layerVisibility.mrtStations
                          ? "bg-white/15 text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {layerVisibility.mrtStations ? "On" : "Off"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant={layerVisibility.mrtExits ? "default" : "outline"}
                    className="justify-between"
                    aria-pressed={layerVisibility.mrtExits}
                    onClick={() =>
                      setLayerVisibility((prev) => ({ ...prev, mrtExits: !prev.mrtExits }))
                    }
                    data-testid="toggle-layer-mrt-exits"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-black/10"
                        style={{ backgroundColor: layerMarkerStyles.mrtExits.color }}
                        aria-hidden="true"
                      />
                      <span>MRT exits</span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        layerVisibility.mrtExits
                          ? "bg-white/15 text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {layerVisibility.mrtExits ? "On" : "Off"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant={layerVisibility.busStops ? "default" : "outline"}
                    className="justify-between"
                    aria-pressed={layerVisibility.busStops}
                    onClick={() =>
                      setLayerVisibility((prev) => ({ ...prev, busStops: !prev.busStops }))
                    }
                    data-testid="toggle-layer-bus-stops"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-black/10"
                        style={{ backgroundColor: layerMarkerStyles.busStops.color }}
                        aria-hidden="true"
                      />
                      <span>Bus stops</span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        layerVisibility.busStops
                          ? "bg-white/15 text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {layerVisibility.busStops ? "On" : "Off"}
                    </span>
                  </Button>
                </div>
                {!hasSelectedSite ? (
                  <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                    Search for a place or drop a pin to load nearby transport layers.
                  </div>
                ) : null}
                {mrtExitZoomBlocked ? (
                  <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                    Zoom in to level {MRT_EXITS_MIN_ZOOM}+ to view MRT exits.
                  </div>
                ) : null}
                <div className="mt-3 rounded-lg border bg-muted/20 p-2">
                  <div className="text-[11px] font-medium text-foreground">Map marker key</div>
                  <div className="mt-2 grid gap-1.5 text-[11px] text-muted-foreground">
                    {(Object.entries(layerMarkerStyles) as Array<
                      [LayerToggleKey, (typeof layerMarkerStyles)[LayerToggleKey]]
                    >).map(([key, item]) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full border border-black/10"
                            style={{ backgroundColor: item.color }}
                            aria-hidden="true"
                          />
                          <span className="text-foreground">{item.label}</span>
                        </div>
                        <span>{item.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground" data-testid="text-search-label">Search</div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      type="search"
                      placeholder="Postal code or address"
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          runSearch();
                        }
                      }}
                      data-testid="input-search"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={runSearch}
                    disabled={searching}
                    data-testid="button-search"
                  >
                    {searching ? "Searching..." : "Search"}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Tip: enter a 6-digit Singapore postal code for faster results.
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden border bg-card p-0 shadow-sm lg:sticky lg:top-24 lg:min-h-[560px] lg:h-[calc(100vh-120px)]" data-testid="map-canvas">
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
            <div className="text-sm font-semibold" data-testid="text-map-title">Singapore map</div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (!mapRef.current) return;
                  clearPin();
                  mapRef.current.setCenter(defaultCenter);
                  mapRef.current.setZoom(12);
                  setSelectedLatLng(null);
                  setSelectedAddress(null);
                  setSelectedArea(null);
                  setSelectedTransportFeature(null);
                  setSiteScore(null);
                  setSiteScoreError(null);
                  setSearchQuery("");
                  setMapZoom(12);
                }}
                data-testid="button-reset-view"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset view
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (!mapRef.current) {
                    toast({
                      title: "Map loading",
                      description: "Please wait for the map to initialize.",
                      variant: "destructive",
                    });
                    return;
                  }
                  const center = mapRef.current.getCenter();
                  setSelectedLatLng({ lat: center.lat(), lng: center.lng() });
                  reverseGeocode(center.lat(), center.lng());
                  setPin(center);
                  toast({
                    title: "Pin dropped",
                    description: "Fetching live site score for the map center.",
                  });
                }}
                data-testid="button-drop-pin"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Drop pin
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border bg-background/80 px-2 py-1">
              Mode: {mapMode === "overview" ? "Overview" : "Focus"}
            </span>
            <span className="rounded-full border bg-background/80 px-2 py-1">
              Overlay: {overlayVisible ? overlay : `${overlay} hidden`}
            </span>
            <span className="rounded-full border bg-background/80 px-2 py-1">
              Scenario: {scenario}
            </span>
            <span className="rounded-full border bg-background/80 px-2 py-1">
              Radius: {formatRadiusLabel(focusRadiusMeters)}
            </span>
          </div>
          <div className="relative flex-1">
            <div ref={mapContainerRef} className="h-full w-full min-h-[360px]" data-testid="map-container" />
            <div className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              {mapMode === "overview" ? "Overview" : "Focus"} • {overlayVisible ? overlay : `${overlay} hidden`}
            </div>
            {overlayLoading && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-full border bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                Loading overlay…
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 grid place-items-center bg-background/80 p-6 text-center text-sm text-muted-foreground">
                <div className="max-w-sm space-y-2 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="text-sm font-semibold">Map unavailable</div>
                  <div>{mapError}</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="border bg-card p-4 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3" data-testid="card-selected-site">
              <div className="text-sm font-semibold">Selected site</div>
              {hasSelectedSite ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-sm font-medium text-foreground" data-testid="text-selected-location">
                      {selectedLocationText}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedSiteChipMeta.map((item) => (
                        <span key={item} className="rounded-full border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  {siteScoreError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                      {siteScoreError}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">
                  Search for a place or drop a pin to start scoring a site.
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-muted/20 p-3" data-testid="card-selected-area">
              <div className="text-sm font-semibold">Planning area details</div>
              {selectedArea ? (
                <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Source</span>
                    <span>{overlayData?.metadata.source === "demo" ? "Demo data" : "Live data"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Area</span>
                    <span className="font-medium text-foreground">{selectedArea.planningAreaName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Region</span>
                    <span>{selectedArea.regionName ?? "Unknown"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Population</span>
                    <span>{formatMetricValue(selectedArea.populationTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Bus stops in area</span>
                    <span>{selectedArea.busStopCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>MRT exits in area</span>
                    <span>{selectedArea.mrtExitCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg. PSF proxy</span>
                    <span>{formatMetricValue(selectedArea.avgUnitPricePsf, " PSF")}</span>
                  </div>
                  <div className="mt-2 grid gap-1 rounded-lg bg-background/70 p-2">
                    <div className="flex items-center justify-between">
                      <span>Composite</span>
                      <span>{formatMetricValue(selectedArea.composite)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Demographics</span>
                      <span>{formatMetricValue(selectedArea.demographics)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Accessibility</span>
                      <span>{formatMetricValue(selectedArea.accessibility)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Vacancy / rental</span>
                      <span>{formatMetricValue(selectedArea.vacancy)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">
                  Click a planning area or score a site to load details.
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-muted/20 p-3" data-testid="card-selected-transport">
              <div className="text-sm font-semibold">Transport details</div>
              {selectedTransportFeature ? (
                <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Source</span>
                    <span>{selectedTransportFeature.source === "demo" ? "Demo data" : "Live data"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Layer</span>
                    <span className="font-medium text-foreground">
                      {selectedTransportFeature.layerKey === "mrtStations"
                        ? "MRT stations"
                        : selectedTransportFeature.layerKey === "mrtExits"
                          ? "MRT exits"
                          : "Bus stops"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Selected</span>
                    <span>{selectedTransportFeature.label}</span>
                  </div>
                  <div className="mt-2 grid gap-1 rounded-lg bg-background/70 p-2">
                    {selectedTransportFeature.fields.map((field) => (
                      <div key={field.label} className="flex items-center justify-between">
                        <span>{field.label}</span>
                        <span>{field.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">
                  Toggle a transport layer, then click a station, exit, or bus stop on the map.
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4" data-testid="card-score-breakdown">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold" data-testid="text-score-title">Score breakdown</div>
                  <div className="mt-1 text-xs text-muted-foreground" data-testid="text-score-sub">
                    Live site score + dimensions with plain-language explanation.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Composite</div>
                  <div className="text-4xl font-semibold tracking-tight" data-testid="text-composite-score">
                    {scoringLoading ? "…" : formatScoreValue(composite)}
                  </div>
                </div>
              </div>

              {!hasSelectedSite ? (
                <div className="mt-4 rounded-xl border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                  Search for a place or drop a pin to score a site.
                </div>
              ) : scoringLoading ? (
                <div className="mt-4 rounded-xl border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                  Loading site score and nearby transport counts...
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-3">
                    {([
                      ["Demographic Match", scores.demographic],
                      ["Accessibility", scores.accessibility],
                      ["Rental Pressure", scores.rental],
                      ["Competition Density", scores.competition],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="space-y-1" data-testid={`row-dimension-${label}`}>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span data-testid={`text-dimension-label-${label}`}>{label}</span>
                          <span data-testid={`text-dimension-value-${label}`}>{formatScoreValue(value)}</span>
                        </div>
                        <Progress value={value ?? 0} data-testid={`progress-${label}`} />
                      </div>
                    ))}
                  </div>

                  {siteScore?.breakdownDetails ? (
                    <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground" data-testid="card-live-score-metrics">
                      <div className="text-xs font-semibold text-foreground">Live site inputs</div>
                      <div className="mt-2 grid gap-1">
                        <div className="flex items-center justify-between">
                          <span>Source</span>
                          <span>{siteScoreError ? "Demo fallback" : "Backend"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Bus stops within {formatRadiusLabel(siteScore.breakdownDetails.analysisRadiusMeters)}</span>
                          <span>{siteScore.breakdownDetails.busStopsWithinRadius}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>MRT exits within {formatRadiusLabel(siteScore.breakdownDetails.analysisRadiusMeters)}</span>
                          <span>{siteScore.breakdownDetails.mrtExitsWithinRadius}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Competition radius</span>
                          <span>{formatRadiusLabel(siteScore.breakdownDetails.analysisRadiusMeters)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Competition category</span>
                          <span>{siteScore.breakdownDetails.competitionCategory}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Competitors found</span>
                          <span>{formatMetricValue(siteScore.breakdownDetails.competitionCountWithinRadius)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="rounded-xl border bg-card p-3" data-testid="card-map-detailed-breakdown">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold">Detailed Score Breakdown</div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void generateDetailedBreakdown();
                    }}
                    disabled={!hasSelectedSite || scoringLoading}
                    data-testid="button-generate-detailed-breakdown"
                  >
                    {explanationLoading ? "Generating..." : "Generate"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsBreakdownSheetOpen(true)}
                    disabled={!detailedBreakdownText}
                    data-testid="button-see-more-breakdown"
                  >
                    See More
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground" data-testid="text-map-detailed-breakdown-preview">
                {shortBreakdownPreview}
              </div>
              {explanationLoading ? (
                <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Generating explanation...
                </div>
              ) : null}
              {hasSelectedSite ? (
                <div className="mt-3 space-y-2">
                  {displayedExplanationItems.map((item) => (
                    <div key={item.label} className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                      <div>
                        <span className="font-medium">{item.label}:</span> {item.detail}
                      </div>
                      <div className="mt-2">
                        <ExplanationFeedbackButtons
                          page="map"
                          profileId={activeProfile?.id ?? null}
                          siteId={siteScore?.planningArea?.planningAreaId ?? selectedArea?.planningAreaId ?? null}
                          criterion={item.label}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Generate a site score first to see targeted improvement recommendations.
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Button
                variant="secondary"
                className="justify-between"
                data-testid="button-explain-score"
                disabled={!hasSelectedSite || scoringLoading}
                onClick={() => {
                  void requestExplanation();
                  openChatbot({
                    context: {
                      page: "map",
                      title: "Map score explanation",
                      profile: activeProfile
                        ? {
                            name: activeProfile.name,
                            sector: activeProfile.sector,
                            priceBand: activeProfile.priceBand,
                          }
                        : undefined,
                      location: {
                        address: hasSelectedSite ? selectedLocationText : undefined,
                        lat: selectedLatLng?.lat,
                        lng: selectedLatLng?.lng,
                      },
                      scores: {
                        composite: composite ?? undefined,
                        demographic: scores.demographic ?? undefined,
                        accessibility: scores.accessibility ?? undefined,
                        rental: scores.rental ?? undefined,
                        competition: scores.competition ?? undefined,
                      },
                    },
                    starterPrompt:
                      "Explain this location score and suggest two concrete actions to improve the weakest dimensions.",
                  });
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> Explain score
                </span>
                <span className="text-muted-foreground">↵</span>
              </Button>
              <Button
                variant="outline"
                className="justify-between"
                onClick={() => setIsNotesSheetOpen(true)}
                disabled={!hasSelectedSite}
                data-testid="button-score-notes"
              >
                <span className="inline-flex items-center gap-2">Notes</span>
                <span className="text-muted-foreground">↵</span>
              </Button>
              <Button
                className="justify-between"
                onClick={saveToPortfolio}
                disabled={!hasSelectedSite || scoringLoading || composite === null}
                data-testid="button-save-portfolio"
              >
                <span className="inline-flex items-center gap-2">
                  <SquarePlus className="h-4 w-4" aria-hidden="true" /> Save to portfolio
                </span>
                <span className="text-muted-foreground">↵</span>
              </Button>
            </div>

            {!activeProfile && (
              <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="status-profile-required">
                Select an active profile to make the scoring feel realistic.
              </div>
            )}

            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="text-data-freshness">
              Using cached data updated on Feb 4, 2026. Refresh in Admin to pull the latest datasets.
            </div>
          </div>
        </Card>
        </div>
      </div>

      <Sheet
        open={isBreakdownSheetOpen}
        onOpenChange={(open) => {
          setIsBreakdownSheetOpen(open);
          if (!open) setIsBreakdownEditMode(false);
        }}
        modal={false}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl" showOverlay={false}>
          <SheetHeader>
            <SheetTitle>Detailed Score Breakdown</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                Rendered markdown preview. Switch to Edit if you want to refine the content before saving.
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBreakdownEditMode((prev) => !prev)}
                data-testid="button-toggle-breakdown-edit"
              >
                {isBreakdownEditMode ? "Preview" : "Edit"}
              </Button>
            </div>

            {isBreakdownEditMode ? (
              <Textarea
                value={detailedBreakdownText}
                onChange={(event) => setDetailedBreakdownText(event.target.value)}
                placeholder="Generate a breakdown first, then refine your notes here..."
                className="min-h-[70vh] resize-none text-sm"
                data-testid="textarea-detailed-breakdown"
              />
            ) : (
              <div className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/20 p-4">
                {detailedBreakdownText ? (
                  <div className="markdown-body text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailedBreakdownText}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Generate a breakdown first to view the markdown preview.
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isNotesSheetOpen} onOpenChange={setIsNotesSheetOpen} modal={false}>
        <SheetContent side="right" className="w-full sm:max-w-xl" showOverlay={false}>
          <SheetHeader>
            <SheetTitle>Notes</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="text-xs text-muted-foreground">
              Add your own notes for this score. These notes will be stored in site_scores.notes on Save to portfolio.
            </div>
            <Textarea
              value={scoreNotes}
              onChange={(event) => setScoreNotes(event.target.value)}
              placeholder="Add observations, assumptions, or follow-up actions..."
              className="min-h-[60vh] resize-none"
              data-testid="textarea-score-notes"
            />
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
