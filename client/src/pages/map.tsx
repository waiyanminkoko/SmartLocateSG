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
  Info,
} from "lucide-react";
import L from "leaflet";

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
import { mockProfiles } from "@/lib/mock-data";

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

const areaDetails = {
  name: "Tiong Bahru",
  district: "Central Region",
  composite: 82,
  demographics: {
    topAges: "25–34 (18%), 35–44 (16%)",
    medianIncome: "S$5,800 / month",
    householdSize: "2.7 average",
  },
  accessibility: {
    mrt: "2 MRT stations within 1 km",
    exits: "6 MRT exits within 500 m",
    busStops: "12 bus stops within 500 m",
  },
  commercial: {
    vacancy: "Low (6%)",
    rentalIndex: "Mid-high",
    competition: "14 similar outlets within 1 km",
  },
  updatedAt: "Feb 4, 2026",
};

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
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const profiles = mockProfiles;
  const [activeProfileId, setActiveProfileId] = useState<string>(profiles.find((p) => p.active)?.id ?? "");
  const [scenario, setScenario] = useState<string>("Normal");
  const [overlay, setOverlay] = useState<Overlay>("Composite");

  const [weights, setWeights] = useState<Weights>(() => presets.Normal);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId),
    [profiles, activeProfileId],
  );

  const explanationItems = [
    {
      label: "Demographic match",
      score: 76,
      detail: "Strong overlap with target age groups (25–44) and mid-income households.",
    },
    {
      label: "Accessibility",
      score: 90,
      detail: "Two MRT stations and 12 bus stops within a short walk boost footfall access.",
    },
    {
      label: "Rental pressure",
      score: 63,
      detail: "Vacancy is low, suggesting higher rent pressure but stable demand.",
    },
    {
      label: "Competition density",
      score: 71,
      detail: "Competition is moderate with 14 similar outlets nearby.",
    },
  ];

  const composite = useMemo(() => {
    const base = { demographic: 76, accessibility: 90, rental: 63, competition: 71 };
    const w = normalize(weights);
    const score =
      (base.demographic * w.demographic +
        base.accessibility * w.accessibility +
        base.rental * w.rental +
        base.competition * w.competition) /
      100;
    return Math.round(score);
  }, [weights]);

  const setPin = (latlng: L.LatLngExpression) => {
    if (!mapRef.current) return;
    if (markerRef.current) {
      markerRef.current.remove();
    }
    markerRef.current = L.circleMarker(latlng, {
      radius: 7,
      color: "#2563eb",
      weight: 2,
      fillColor: "#3b82f6",
      fillOpacity: 0.9,
    }).addTo(mapRef.current);
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [1.3521, 103.8198],
      zoom: 12,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: true,
    });

    L.tileLayer("https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png", {
      attribution: "© OneMap, Singapore Land Authority",
    }).addTo(map);

    L.control.scale({ metric: true, imperial: false }).addTo(map);

    const handleClick = (event: L.LeafletMouseEvent) => {
      setPin(event.latlng);
      toast({
        title: "Pin dropped (prototype)",
        description: "Scoring updated for the selected location.",
      });
    };

    map.on("click", handleClick);
    mapRef.current = map;

    return () => {
      map.off("click", handleClick);
      map.remove();
      mapRef.current = null;
    };
  }, [toast]);

  return (
    <AppShell title="Map">
      <div className="grid gap-3 lg:grid-cols-[340px_1fr_340px]">
        <Card className="border bg-card p-4 shadow-sm">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold" data-testid="text-map-controls-title">Controls</div>
              <div className="mt-1 text-xs text-muted-foreground" data-testid="text-map-controls-sub">
                Select profile, scenario, overlays, and layers.
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground" data-testid="text-active-profile-label">Active Business Profile</div>
              <Select value={activeProfileId} onValueChange={setActiveProfileId}>
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
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="search"
                    placeholder="Address / postal"
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border bg-card p-0 shadow-sm" data-testid="map-canvas">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-semibold" data-testid="text-map-title">Singapore map</div>
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="button-area-details">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    Area details
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-lg">
                  <SheetHeader>
                    <SheetTitle data-testid="text-area-title">Planning Area Details</SheetTitle>
                  </SheetHeader>

                  <div className="mt-5 space-y-5 text-sm">
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs text-muted-foreground">Planning area</div>
                      <div className="mt-1 text-lg font-semibold">{areaDetails.name}</div>
                      <div className="text-xs text-muted-foreground">{areaDetails.district}</div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Composite score</span>
                        <span className="text-base font-semibold text-foreground">{areaDetails.composite}</span>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-xl border bg-card p-4">
                        <div className="text-xs font-semibold text-muted-foreground">Demographics</div>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Top age groups</span>
                            <span>{areaDetails.demographics.topAges}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Median income</span>
                            <span>{areaDetails.demographics.medianIncome}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Household size</span>
                            <span>{areaDetails.demographics.householdSize}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border bg-card p-4">
                        <div className="text-xs font-semibold text-muted-foreground">Accessibility</div>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">MRT access</span>
                            <span>{areaDetails.accessibility.mrt}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">MRT exits</span>
                            <span>{areaDetails.accessibility.exits}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Bus stops</span>
                            <span>{areaDetails.accessibility.busStops}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border bg-card p-4">
                        <div className="text-xs font-semibold text-muted-foreground">Commercial pressure</div>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Vacancy</span>
                            <span>{areaDetails.commercial.vacancy}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Rental index</span>
                            <span>{areaDetails.commercial.rentalIndex}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Competition</span>
                            <span>{areaDetails.commercial.competition}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                      Updated: {areaDetails.updatedAt} • Data sources: OneMap, SingStat, LTA, URA.
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
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
          <div className="relative">
            <div ref={mapContainerRef} className="h-[360px] w-full sm:h-[520px]" data-testid="map-container" />
            <div className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              Overlay: {overlay}
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border bg-card/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
              OneMap © SLA
            </div>
          </div>
        </Card>

        <Card className="border bg-card p-4 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" data-testid="text-score-title">Score breakdown</div>
                <div className="mt-1 text-xs text-muted-foreground" data-testid="text-score-sub">
                  Composite score + dimensions with plain-language explanation.
                </div>
              </div>
              <div className="text-2xl font-semibold tracking-tight" data-testid="text-composite-score">{composite}</div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="text-data-freshness">
              Using cached data updated on Feb 4, 2026. Refresh in Admin to pull the latest datasets.
            </div>

            <div className="grid gap-3">
              {([
                ["Demographic Match", 76],
                ["Accessibility", 90],
                ["Rental Pressure", 63],
                ["Competition Density", 71],
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
                      Composite score is strong due to high transit accessibility and solid demographic alignment.
                      Rental pressure is moderate, and competition remains manageable.
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
                onClick={() => toast({ title: "Saved to portfolio (prototype)", description: "Site added." })}
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
