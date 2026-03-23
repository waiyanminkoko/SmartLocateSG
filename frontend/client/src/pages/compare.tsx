import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { mockProfiles, mockSites, BusinessProfile, CandidateSite } from "@/lib/mock-data";
import { openChatbot } from "@/lib/chatbot";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorageState } from "@/hooks/use-local-storage";

export default function Compare() {
  const { toast } = useToast();
  const [sites] = useLocalStorageState<CandidateSite[]>("smartlocate:sites", mockSites);
  const [profiles] = useLocalStorageState<BusinessProfile[]>("smartlocate:profiles", mockProfiles);

  const activeProfile = useMemo(() => profiles.find((p) => p.active), [profiles]);
  const activeProfileId = activeProfile?.id ?? "";
  const profileSites = useMemo(
    () => (activeProfileId ? sites.filter((s) => s.profileId === activeProfileId) : []),
    [sites, activeProfileId],
  );

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [sites[0]?.id, sites[1]?.id].filter(Boolean) as string[];
    }
    const saved = localStorage.getItem("compare:selected");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed) && parsed.length >= 1) {
          return parsed.filter(Boolean);
        }
      } catch {
        return [sites[0]?.id, sites[1]?.id].filter(Boolean) as string[];
      }
    }
    return [sites[0]?.id, sites[1]?.id].filter(Boolean) as string[];
  });

  useEffect(() => {
    const allowedIds = new Set(profileSites.map((s) => s.id));
    const defaultIds = profileSites.slice(0, 2).map((s) => s.id);

    setSelected((prev) => {
      const filtered = prev.filter((id) => allowedIds.has(id));
      const next = filtered.length > 0 ? filtered : defaultIds;

      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [profileSites]);

  useEffect(() => {
    localStorage.setItem("compare:selected", JSON.stringify(selected));
  }, [selected]);

  const selectedSites = useMemo(
    () => profileSites.filter((s) => selected.includes(s.id)).slice(0, 3),
    [profileSites, selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast({
          title: "Max 3 sites",
          description: "You can compare up to 3 sites.",
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, id];
    });
  };

  const dims = [
    { key: "composite", label: "Composite" },
    { key: "demographic", label: "Demographic match" },
    { key: "accessibility", label: "Accessibility" },
    { key: "rental", label: "Rental pressure" },
    { key: "competition", label: "Competition density" },
  ] as const;

  const chartData = useMemo(() => {
    return dims.map((d) => {
      const row: Record<string, string | number> = { metric: d.label };
      selectedSites.forEach((site) => {
        row[site.id] = (site as any)[d.key] as number;
      });
      return row;
    });
  }, [dims, selectedSites]);

  const chartConfig = useMemo(() => {
    const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];
    return Object.fromEntries(
      selectedSites.map((site, index) => [
        site.id,
        {
          label: site.name,
          color: colors[index % colors.length],
        },
      ]),
    );
  }, [selectedSites]);

  const explainComparison = () => {
    if (selectedSites.length < 2) {
      toast({
        title: "Select at least 2 sites",
        description: "Choose two sites to get a meaningful comparison explanation.",
        variant: "destructive",
      });
      return;
    }

    openChatbot({
      context: {
        page: "compare",
        title: "Site comparison explanation",
        sites: selectedSites.map((site) => ({
          id: site.id,
          name: site.name,
          address: site.address,
          composite: site.composite,
          demographic: site.demographic,
          accessibility: site.accessibility,
          rental: site.rental,
          competition: site.competition,
        })),
      },
      starterPrompt:
        "Compare these selected sites, identify the strongest option, and explain key trade-offs clearly.",
    });
  };

  return (
    <AppShell
      title="Compare"
      right={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => toast({ title: "Export PDF (prototype)", description: "A PDF would download here." })}
            data-testid="button-export-pdf"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-compare-title">Compare Sites</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-compare-subtitle">
            Compare 2–3 candidate sites side-by-side.
          </p>
          <p className="mt-1 text-xs text-muted-foreground" data-testid="text-compare-active-profile">
            Active profile: {activeProfile?.name ?? "None selected"}
          </p>
        </div>

        <Card className="border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold" data-testid="text-compare-select-title">Select sites</div>
          {!activeProfileId ? (
            <div className="mt-3 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="status-no-active-profile">
              Select an active business profile in Profiles before comparing sites.
            </div>
          ) : null}
          {activeProfileId && profileSites.length === 0 ? (
            <div className="mt-3 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="status-no-sites-for-profile">
              No saved candidate sites for the active profile yet.
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {profileSites.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3"
                data-testid={`row-select-site-${s.id}`}
              >
                <Checkbox
                  checked={selected.includes(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                  data-testid={`checkbox-select-${s.id}`}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium" data-testid={`text-select-name-${s.id}`}>{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground" data-testid={`text-select-address-${s.id}`}>{s.address}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2" data-testid="chips-selected">
            {selectedSites.map((s) => (
              <div key={s.id} className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs">
                <span data-testid={`chip-site-${s.id}`}>{s.name}</span>
                <button
                  className="rounded-full p-1 hover:bg-muted"
                  onClick={() => toggle(s.id)}
                  data-testid={`button-remove-chip-${s.id}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {selectedSites.length < 2 ? (
          <Card className="border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground" data-testid="status-need-two">
              Select at least 2 sites to compare.
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold" data-testid="text-compare-chart-title">Score comparison</div>
                  <div className="mt-1 text-xs text-muted-foreground" data-testid="text-compare-chart-subtitle">
                    Dimension scores across selected sites.
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={explainComparison}
                  data-testid="button-explain-comparison"
                >
                  Explain Comparison
                </Button>
              </div>
              <div className="mt-4">
                <ChartContainer className="h-72" config={chartConfig}>
                  <BarChart data={chartData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="metric"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickMargin={8}
                    />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {selectedSites.map((site) => (
                      <Bar
                        key={site.id}
                        dataKey={site.id}
                        fill={`var(--color-${site.id})`}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ChartContainer>
              </div>
            </Card>

            <div className="grid gap-3 lg:grid-cols-3">
              {selectedSites.map((s) => (
                <Card key={s.id} className="border bg-card p-5 shadow-sm" data-testid={`card-compare-${s.id}`}>
                  <div className="text-sm font-semibold" data-testid={`text-compare-name-${s.id}`}>{s.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-compare-address-${s.id}`}>{s.address}</div>

                  <div className="mt-4 grid gap-2">
                    {dims.map((d) => (
                      <div key={d.key} className="flex items-center justify-between" data-testid={`row-compare-${d.key}-${s.id}`}>
                        <div className="text-xs text-muted-foreground" data-testid={`text-compare-label-${d.key}-${s.id}`}>{d.label}</div>
                        <div className="text-sm font-semibold" data-testid={`text-compare-value-${d.key}-${s.id}`}>{(s as any)[d.key]}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
