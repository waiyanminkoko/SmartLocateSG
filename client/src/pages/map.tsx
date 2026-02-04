import { useMemo, useState } from "react";
import {
  Layers,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  SquarePlus,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  const profiles = mockProfiles;
  const [activeProfileId, setActiveProfileId] = useState<string>(profiles.find((p) => p.active)?.id ?? "");
  const [scenario, setScenario] = useState<string>("Normal");
  const [overlay, setOverlay] = useState<Overlay>("Composite");

  const [weights, setWeights] = useState<Weights>(() => presets.Normal);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId),
    [profiles, activeProfileId],
  );

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
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={() => toast({ title: "Pin dropped (prototype)", description: "Scoring updated." })}
              data-testid="button-drop-pin"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Drop pin
            </Button>
          </div>
          <div className="grid place-items-center px-4 py-16">
            <div className="max-w-md text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl border bg-muted/30">
                <MapPin className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="mt-4 text-sm font-semibold" data-testid="text-map-placeholder-title">
                Map canvas (mock)
              </div>
              <div className="mt-1 text-sm text-muted-foreground" data-testid="text-map-placeholder-sub">
                In a full app, this is where OneMap tiles + overlays would render.
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground" data-testid="text-overlay-pill">
                Overlay: {overlay}
              </div>
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
              <Button
                variant="secondary"
                className="justify-between"
                onClick={() =>
                  toast({
                    title: "Explain score (prototype)",
                    description:
                      "Composite is high due to strong transit access and a solid demographic match. Rental pressure is moderate.",
                  })
                }
                data-testid="button-explain-score"
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> Explain score
                </span>
                <span className="text-muted-foreground">↵</span>
              </Button>
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
