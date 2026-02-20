import { useEffect, useMemo, useRef, useState } from "react";
import {
  Layers,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  SquarePlus,
  ThumbsDown,
  ThumbsUp,
  RotateCcw,
} from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { mockProfiles, mockSites } from "@/lib/mock-data";

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

  const [profiles, setProfiles] = useLocalStorageState("smartlocate:profiles", mockProfiles);
  const [, setSites] = useLocalStorageState("smartlocate:sites", mockSites);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [scenario, setScenario] = useState<string>("Normal");
  const [overlay, setOverlay] = useState<Overlay>("Composite");

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

  const handleProfileChange = (id: string) => {
    setActiveProfileId(id);
    setProfiles((prev) => prev.map((p) => ({ ...p, active: p.id === id })));
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
    };

    setSites((prev) => [newSite, ...prev]);
    toast({ title: "Saved to portfolio", description: "Site added to your list." });
  };

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
                  {selectedAddress ? `Selected: ${selectedAddress}` : "No location selected yet."}
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

            <div className="grid gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    className="justify-between"
                    data-testid="button-explain-score"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-4 w-4" aria-hidden="true" /> Explain score
                    </span>
                    <span className="text-muted-foreground">↵</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Score explanation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div className="rounded-xl border bg-muted/30 p-4">
                      Composite score is {composite}. Scores update dynamically based on your scenario weights
                      and the selected location.
                    </div>

                    <div className="grid gap-3">
                      {explanationItems.map((item) => (
                        <div key={item.label} className="rounded-xl border bg-card p-4">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold">{item.label}</div>
                            <div className="text-lg font-semibold">{item.score}</div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">{item.detail}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        Was this explanation helpful?
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => toast({ title: "Thanks!", description: "Feedback saved." })}
                          data-testid="button-feedback-up"
                        >
                          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                          Helpful
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => toast({ title: "Noted", description: "We will refine the explanation." })}
                          data-testid="button-feedback-down"
                        >
                          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                          Not really
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
    </AppShell>
  );
}
