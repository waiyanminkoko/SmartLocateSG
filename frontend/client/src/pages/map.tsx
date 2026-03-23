import { useEffect, useMemo, useRef, useState } from "react";
import {
  Layers,
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
import { mockProfiles, type BusinessProfile, type CandidateSite } from "@/lib/mock-data";
import { useAuth } from "@/context/auth-context";

const PROFILES_CACHE_TTL_MS = 2 * 60 * 1000;
const SITES_CACHE_TTL_MS = 60 * 1000;

type Overlay = "Composite" | "Demographics" | "Accessibility" | "Vacancy";

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


function seededValue(lat: number, lng: number, salt: number) {
  const x = Math.sin((lat + salt) * 12.9898 + (lng + salt) * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function scoreFromSeed(seed: number, min = 55, max = 95) {
  return Math.round(min + seed * (max - min));
}

function computeScores(lat: number, lng: number, weights: Weights) {
  const demographic = scoreFromSeed(seededValue(lat, lng, 0.3));
  const accessibility = scoreFromSeed(seededValue(lat, lng, 0.6));
  const rental = scoreFromSeed(seededValue(lat, lng, 0.9));
  const competition = scoreFromSeed(seededValue(lat, lng, 1.2));
  const w = normalize(weights);
  const composite = Math.round(
    (demographic * w.demographic +
      accessibility * w.accessibility +
      rental * w.rental +
      competition * w.competition) /
      100,
  );
  return { demographic, accessibility, rental, competition, composite };
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

export default function MapPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const markerRef = useRef<any | null>(null);
  const googleRef = useRef<any | null>(null);
  const autocompleteRef = useRef<any | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const [selectedLatLng, setSelectedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    lat: number;
    lng: number;
    profileId?: string;
    siteName?: string;
    siteAddress?: string;
  } | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
    const loc = selectedLatLng ?? defaultCenter;
    return computeScores(loc.lat, loc.lng, weights);
  }, [selectedLatLng, weights]);

  const composite = scores.composite;

  const fallbackExplanationItems = useMemo(() => {
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
      {
        label: "Demographic match",
        score: scores.demographic,
        detail: demographicDetail,
      },
      {
        label: "Accessibility",
        score: scores.accessibility,
        detail: accessibilityDetail,
      },
      {
        label: "Rental pressure",
        score: scores.rental,
        detail: rentalDetail,
      },
      {
        label: "Competition density",
        score: scores.competition,
        detail: competitionDetail,
      },
    ];
  }, [scores]);

  const displayedExplanationItems =
    serverExplanationItems.length > 0 ? serverExplanationItems : fallbackExplanationItems;

  const quickRecommendations = useMemo(
    () => [...displayedExplanationItems].sort((a, b) => a.score - b.score).slice(0, 2),
    [displayedExplanationItems],
  );

  const selectedLocationText = useMemo(() => {
    if (selectedAddress) {
      return selectedAddress;
    }
    if (selectedLatLng) {
      return `Lat ${selectedLatLng.lat.toFixed(5)}, ${selectedLatLng.lng.toFixed(5)}`;
    }
    return "No location selected yet.";
  }, [selectedAddress, selectedLatLng]);

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

  const setPin = (latlng: any) => {
    const googleMaps = googleRef.current;
    if (!mapRef.current || !googleMaps) return;
    if (markerRef.current) {
      markerRef.current.setMap(null);
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

  const formatLatLng = (lat: number, lng: number) =>
    `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const createId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

    const savedAt = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const newSite = {
      id: createId(),
      name: `${activeProfile.name} site`,
      address: selectedAddress ?? `Lat ${formatLatLng(selectedLatLng.lat, selectedLatLng.lng)}`,
      composite,
      demographic: scores.demographic,
      accessibility: scores.accessibility,
      rental: scores.rental,
      competition: scores.competition,
      savedAt,
      profileId: activeProfile.id,
      lat: selectedLatLng.lat,
      lng: selectedLatLng.lng,
      notes: scoreNotes,
    };

    const breakdownPayload = {
      markdown: detailedBreakdownText || null,
      summary:
        explanationSummary ||
        `Composite score is ${composite}. Scores update dynamically based on scenario weights and selected location.`,
      items: displayedExplanationItems,
      location: {
        address: selectedAddress ?? undefined,
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
    const locationLine = selectedAddress
      ? selectedAddress
      : selectedLatLng
        ? `Lat ${formatLatLng(selectedLatLng.lat, selectedLatLng.lng)}`
        : "No location selected";

    const lines = [
      "# Detailed Score Breakdown",
      "",
      `- **Location:** ${locationLine}`,
      `- **Composite Score:** ${composite}`,
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
      `Composite score is ${composite}. Scores update dynamically based on scenario weights and selected location.`;
    const items = result?.items ?? displayedExplanationItems;
    const markdown = buildDetailedBreakdownMarkdown(summary, items);
    setDetailedBreakdownText(markdown);
  };

  const requestExplanation = async () => {
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
            address: selectedAddress ?? undefined,
            lat: selectedLatLng?.lat,
            lng: selectedLatLng?.lng,
          },
          scores,
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
        `Composite score is ${composite}. Scores update dynamically based on scenario weights and selected location.`;
      const resolvedItems = Array.isArray(data.items) ? data.items : fallbackExplanationItems;

      setExplanationSummary(resolvedSummary);
      setServerExplanationItems(resolvedItems);

      return {
        summary: resolvedSummary,
        items: resolvedItems,
      };
    } catch {
      const fallbackSummary =
        `Composite score is ${composite}. Showing fallback explanation because the AI endpoint is unavailable.`;

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
      libraries: ["places"],
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
        });

        map.addListener("click", (event: any) => {
          if (!event?.latLng) return;
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          setSelectedLatLng({ lat, lng });
          reverseGeocode(lat, lng);
          setPin(event.latLng);
          toast({
            title: "Pin dropped (prototype)",
            description: "Scoring updated for the selected location.",
          });
        });

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
          description: "Verify your Google Maps API key and billing settings.",
          variant: "destructive",
        });
      });

    return () => {
      cancelled = true;
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapRef.current = null;
      autocompleteRef.current = null;
      setMapReady(false);
    };
  }, [apiKey, toast]);

  return (
    <AppShell title="Map">
      <div
        className={`map-page-grid-wrap transition-[padding-right] duration-200 ${
          isAnySidePanelOpen ? "is-sidepanel-open" : ""
        }`}
      >
        <div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)_360px] xl:grid-cols-[380px_minmax(0,1fr)_380px]">
        <Card className="border bg-card p-4 shadow-sm lg:sticky lg:top-24 lg:h-fit">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold" data-testid="text-map-controls-title">Controls</div>
              <div className="mt-1 text-xs text-muted-foreground" data-testid="text-map-controls-sub">
                Select profile, scenario, overlays, and layers.
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground" data-testid="text-active-profile-label">Active Business Profile</div>
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
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground" data-testid="text-scenario-label">Scenario preset</div>
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

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground" data-testid="text-overlay-label">Overlay</div>
                <Select value={overlay} onValueChange={(v) => setOverlay(v as Overlay)}>
                  <SelectTrigger data-testid="select-overlay">
                    <SelectValue placeholder="Overlay" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["Composite", "Demographics", "Accessibility", "Vacancy"] as Overlay[]).map((o) => (
                      <SelectItem key={o} value={o} data-testid={`select-item-overlay-${o}`}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-xs" data-testid="panel-overlay-legend">
                <div className="text-xs font-semibold text-muted-foreground">Overlay legend</div>
                <div className="mt-2 grid gap-1 text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Composite score</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary" /> High is better
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Demographics</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Match score
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Accessibility</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-sky-500" /> Transit access
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Vacancy / Rental</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> Pressure indicator
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-3" data-testid="group-layer-toggles">
                <div className="text-xs font-medium text-muted-foreground">Layers</div>
                <div className="mt-2 grid gap-2">
                  <Button
                    variant="ghost"
                    className="justify-between"
                    onClick={() => toast({ title: "Layer toggled (prototype)", description: "MRT Stations" })}
                    data-testid="toggle-layer-mrt-stations"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Layers className="h-4 w-4" aria-hidden="true" /> MRT stations
                    </span>
                    <span className="text-muted-foreground">On</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-between"
                    onClick={() => toast({ title: "Layer toggled (prototype)", description: "MRT Exits" })}
                    data-testid="toggle-layer-mrt-exits"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Layers className="h-4 w-4" aria-hidden="true" /> MRT exits
                    </span>
                    <span className="text-muted-foreground">Zoom-gated</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-between"
                    onClick={() => toast({ title: "Layer toggled (prototype)", description: "Bus Stops" })}
                    data-testid="toggle-layer-bus-stops"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Layers className="h-4 w-4" aria-hidden="true" /> Bus stops
                    </span>
                    <span className="text-muted-foreground">Off</span>
                  </Button>
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
                          if (autocompleteRef.current) return;
                          e.preventDefault();
                          runSearch();
                        }
                      }}
                      data-testid="input-search"
                      ref={searchInputRef}
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

        <Card className="border bg-card p-0 shadow-sm lg:min-h-[560px] lg:h-[calc(100vh-210px)] flex flex-col overflow-hidden" data-testid="map-canvas">
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
            <div className="text-sm font-semibold" data-testid="text-map-title">Singapore map</div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (!mapRef.current) return;
                  if (markerRef.current) {
                    markerRef.current.setMap(null);
                    markerRef.current = null;
                  }
                  mapRef.current.setCenter(defaultCenter);
                  mapRef.current.setZoom(12);
                  setSelectedLatLng(null);
                  setSelectedAddress(null);
                  setSearchQuery("");
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
                    title: "Pin dropped (prototype)",
                    description: "Scoring updated for the selected location.",
                  });
                }}
                data-testid="button-drop-pin"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Drop pin
              </Button>
            </div>
          </div>
          <div className="relative flex-1">
            <div ref={mapContainerRef} className="h-full w-full min-h-[360px]" data-testid="map-container" />
            <div className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              Overlay: {overlay}
            </div>
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

        <Card className="border bg-card p-4 shadow-sm lg:sticky lg:top-24 lg:h-fit">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" data-testid="text-score-title">Score breakdown</div>
                <div className="mt-1 text-xs text-muted-foreground" data-testid="text-score-sub">
                  Composite score + dimensions with plain-language explanation.
                </div>
                <div className="mt-2 text-xs text-muted-foreground" data-testid="text-selected-location">
                  Selected: {selectedLocationText}
                </div>
              </div>
              <div className="text-2xl font-semibold tracking-tight" data-testid="text-composite-score">{composite}</div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="text-data-freshness">
              Using cached data updated on Feb 4, 2026. Refresh in Admin to pull the latest datasets.
            </div>

            <div className="grid gap-3">
              {([
                ["Demographic Match", scores.demographic],
                ["Accessibility", scores.accessibility],
                ["Rental Pressure", scores.rental],
                ["Competition Density", scores.competition],
              ] as const).map(([label, value]) => (
                <div key={label} className="space-y-1" data-testid={`row-dimension-${label}`}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span data-testid={`text-dimension-label-${label}`}>{label}</span>
                    <span data-testid={`text-dimension-value-${label}`}>{value}</span>
                  </div>
                  <Progress value={value} data-testid={`progress-${label}`} />
                </div>
              ))}
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
              <div className="mt-3 space-y-2">
                {quickRecommendations.map((item) => (
                  <div key={item.label} className="rounded-lg bg-muted/40 px-2 py-1 text-xs">
                    <span className="font-medium">{item.label}:</span> {item.detail}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Button
                variant="secondary"
                className="justify-between"
                data-testid="button-explain-score"
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
                        address: selectedAddress ?? undefined,
                        lat: selectedLatLng?.lat,
                        lng: selectedLatLng?.lng,
                      },
                      scores,
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
                data-testid="button-score-notes"
              >
                <span className="inline-flex items-center gap-2">Notes</span>
                <span className="text-muted-foreground">↵</span>
              </Button>
              <Button
                className="justify-between"
                onClick={saveToPortfolio}
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
