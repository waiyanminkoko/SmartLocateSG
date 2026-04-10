import { useEffect, useMemo, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { jsPDF } from "jspdf";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchJsonWithCache } from "@/lib/api-cache";
import { getCandidateSiteDisplayName, mockProfiles, type BusinessProfile, type CandidateSite } from "@/lib/mock-data";
import { openChatbot, setLatestChatbotPayload, type OpenChatbotPayload } from "@/lib/chatbot";
import { buildCompareInsights } from "@/lib/explanation-insights";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { useAuth } from "@/context/auth-context";

const PROFILES_CACHE_TTL_MS = 2 * 60 * 1000;
const SITES_CACHE_TTL_MS = 60 * 1000;

function splitTickLabel(value: string) {
  const words = value.split(" ").filter(Boolean);
  if (words.length <= 1) {
    return [value, ""];
  }

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function renderMetricTick(props: any) {
  const { x, y, payload } = props;
  const label = String(payload?.value ?? "");
  const [line1, line2] = splitTickLabel(label);

  return (
    <text x={x} y={y} textAnchor="middle" fill="currentColor" className="text-[11px] text-muted-foreground">
      <tspan x={x} dy="0.9em">{line1}</tspan>
      {line2 ? <tspan x={x} dy="1.1em">{line2}</tspan> : null}
    </text>
  );
}

export default function Compare() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const [sites, setSites] = useLocalStorageState<CandidateSite[]>("smartlocate:sites", []);
  const [profiles, setProfiles] = useLocalStorageState<BusinessProfile[]>("smartlocate:profiles", mockProfiles);
  const [exporting, setExporting] = useState(false);
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [selectionByFilter, setSelectionByFilter] = useLocalStorageState<Record<string, string[]>>(
    "compare:selected-by-filter",
    {},
  );
  const hasAppliedDefaultFilter = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const fetchCompareData = async () => {
      if (authLoading || !userId) {
        return;
      }

      try {
        const [profileRows, siteRows] = await Promise.all([
          fetchJsonWithCache<
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
          ),
          fetchJsonWithCache<
            Array<{
              id: string;
              profileId: string | null;
              name: string;
              address: string;
              composite: number | null;
              demographic: number | null;
              accessibility: number | null;
              rental: number | null;
              competition: number | null;
              savedAt: string;
              notes?: string;
              breakdownDetailsJson?: Record<string, unknown> | null;
              lat?: number | null;
              lng?: number | null;
            }>
          >(
            `sites:${userId}`,
            `/api/sites/${encodeURIComponent(userId)}`,
            { ttlMs: SITES_CACHE_TTL_MS },
          ),
        ]);

        const mappedProfiles: BusinessProfile[] = profileRows.map((row) => ({
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

        const mappedSites: CandidateSite[] = siteRows.map((row) => ({
          id: row.id,
          profileId: row.profileId ?? "",
          name: row.name,
          address: row.address,
          composite: row.composite ?? 0,
          demographic: row.demographic ?? 0,
          accessibility: row.accessibility ?? 0,
          rental: row.rental ?? 0,
          competition: row.competition ?? 0,
          savedAt: new Date(row.savedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          notes: row.notes,
          lat: row.lat ?? undefined,
          lng: row.lng ?? undefined,
          planningAreaId: undefined,
          breakdownDetailsJson: row.breakdownDetailsJson ?? undefined,
        }));

        if (!cancelled) {
          setProfiles(mappedProfiles);
          setSites(mappedSites);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Compare fetch error:", error);
          toast({
            title: "Compare API unavailable",
            description: "Showing currently loaded data.",
            variant: "destructive",
          });
        }
      }
    };

    void fetchCompareData();

    return () => {
      cancelled = true;
    };
  }, [authLoading, setProfiles, setSites, toast, userId]);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.active) ?? null, [profiles]);

  useEffect(() => {
    if (hasAppliedDefaultFilter.current) {
      return;
    }

    if (authLoading) {
      return;
    }

    setProfileFilter(activeProfile?.id ?? "all");
    hasAppliedDefaultFilter.current = true;
  }, [activeProfile?.id, authLoading]);

  const filteredSites = useMemo(() => {
    if (profileFilter === "all") {
      return sites;
    }

    return sites.filter((site) => site.profileId === profileFilter);
  }, [profileFilter, sites]);

  const availableSites = filteredSites;

  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const allowedIds = new Set(availableSites.map((site) => site.id));
    const defaultIds = availableSites.slice(0, 2).map((site) => site.id);
    const remembered = (selectionByFilter[profileFilter] ?? []).filter((id) => allowedIds.has(id));
    const next = remembered.length > 0 ? remembered.slice(0, 3) : defaultIds;

    setSelected((prev) => {
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });

    setSelectionByFilter((prev) => {
      const current = prev[profileFilter] ?? [];
      if (current.length === next.length && current.every((id, index) => id === next[index])) {
        return prev;
      }
      return { ...prev, [profileFilter]: next };
    });
  }, [availableSites, profileFilter, selectionByFilter, setSelectionByFilter]);

  useEffect(() => {
    localStorage.setItem("compare:selected", JSON.stringify(selected));
  }, [selected]);

  const selectedSites = useMemo(
    () => availableSites.filter((site) => selected.includes(site.id)).slice(0, 3),
    [availableSites, selected],
  );

  const comparisonProfile = useMemo(() => {
    const selectedProfileIds = Array.from(
      new Set(
        selectedSites
          .map((site) => site.profileId)
          .filter((profileId): profileId is string => Boolean(profileId)),
      ),
    );

    if (selectedProfileIds.length !== 1) {
      return null;
    }

    return profiles.find((profile) => profile.id === selectedProfileIds[0]) ?? null;
  }, [profiles, selectedSites]);

  const profileNameById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.name])),
    [profiles],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((entry) => entry !== id);
      } else {
        if (prev.length >= 3) {
          toast({
            title: "Max 3 sites",
            description: "You can compare up to 3 sites.",
            variant: "destructive",
          });
          return prev;
        }

        next = [...prev, id];
      }

      setSelectionByFilter((saved) => ({
        ...saved,
        [profileFilter]: next,
      }));

      return next;
    });
  };

  const dims = [
    { key: "composite", label: "Composite" },
    { key: "demographic", label: "Demographic match" },
    { key: "accessibility", label: "Accessibility" },
    { key: "rental", label: "Rental pressure" },
    { key: "competition", label: "Competition density" },
  ] as const;

  const chartData = useMemo(
    () =>
      dims.map((dimension) => {
        const row: Record<string, string | number> = { metric: dimension.label };
        selectedSites.forEach((site) => {
          row[site.id] = (site as CandidateSite & Record<string, number>)[dimension.key];
        });
        return row;
      }),
    [dims, selectedSites],
  );

  const chartConfig = useMemo(() => {
    const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];
    return Object.fromEntries(
      selectedSites.map((site, index) => [
        site.id,
        {
          label: getCandidateSiteDisplayName(site),
          color: colors[index % colors.length],
        },
      ]),
    );
  }, [selectedSites]);

  const exportTimestamp = useMemo(
    () =>
      new Date().toLocaleString("en-SG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  const comparisonInsights = useMemo(() => buildCompareInsights(selectedSites), [selectedSites]);

  const compareChatbotPayload = useMemo<OpenChatbotPayload>(
    () => ({
      context: {
        page: "compare",
        title: "Site comparison explanation",
        profile: comparisonProfile
          ? {
              id: comparisonProfile.id,
              name: comparisonProfile.name,
              sector: comparisonProfile.sector,
              priceBand: comparisonProfile.priceBand,
              ageGroups: comparisonProfile.ageGroups,
              incomeBands: comparisonProfile.incomeBands,
              operatingModel: comparisonProfile.operatingModel,
            }
          : undefined,
        sites: selectedSites.map((site) => ({
          id: site.id,
          profileId: site.profileId,
          name: site.name,
          address: site.address,
          lat: site.lat,
          lng: site.lng,
          composite: site.composite,
          demographic: site.demographic,
          accessibility: site.accessibility,
          rental: site.rental,
          competition: site.competition,
          notes: site.notes,
        })),
        hiddenContext: {
          selectedSiteIds: selected,
          selectedSitesCount: selectedSites.length,
          totalProfileSites: availableSites.length,
          activeProfileId: comparisonProfile?.id ?? activeProfile?.id ?? null,
          profileSites: availableSites.map((site) => ({
            id: site.id,
            profileId: site.profileId,
            name: site.name,
            address: site.address,
            lat: site.lat,
            lng: site.lng,
            composite: site.composite,
            demographic: site.demographic,
            accessibility: site.accessibility,
            rental: site.rental,
            competition: site.competition,
            notes: site.notes,
          })),
          chartData,
          comparisonInsights,
        },
      },
      starterPrompt:
        "Compare these selected sites, identify the strongest option, and explain key trade-offs clearly.",
    }),
    [activeProfile, availableSites, chartData, comparisonInsights, comparisonProfile, selected, selectedSites],
  );

  useEffect(() => {
    setLatestChatbotPayload(compareChatbotPayload);
  }, [compareChatbotPayload]);

  const exportComparisonPdf = async () => {
    setExporting(true);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      const colors = [
        [15, 118, 110],
        [14, 165, 233],
        [245, 158, 11],
      ] as const;

      let y = margin;

      const ensureSpace = (requiredHeight: number) => {
        if (y + requiredHeight <= pageHeight - margin) {
          return;
        }
        pdf.addPage();
        y = margin;
      };

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("SmartLocate SG Comparison Report", margin, y);
      y += 24;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(
        `Profile: ${comparisonProfile?.name ?? (selectedSites.length > 0 ? "Multiple profiles" : activeProfile?.name ?? "None selected")}`,
        margin,
        y,
      );
      y += 14;
      pdf.text(`Prepared on: ${exportTimestamp}`, margin, y);
      y += 20;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Selected sites", margin, y);
      y += 16;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      selectedSites.forEach((site, index) => {
        ensureSpace(18);
        const profileName = profileNameById.get(site.profileId) ?? "Unassigned";
        pdf.text(`${index + 1}. ${getCandidateSiteDisplayName(site)} (${profileName}) - ${site.address}`, margin, y);
        y += 14;
      });
      y += 8;

      ensureSpace(24 + dims.length * 18);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Comparison table", margin, y);
      y += 18;

      const metricColumnWidth = 140;
      const siteColumnWidth = (contentWidth - metricColumnWidth) / Math.max(selectedSites.length, 1);

      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, y, contentWidth, 22, "F");
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(10);
      pdf.text("Metric", margin + 8, y + 14);
      selectedSites.forEach((site, index) => {
        pdf.text(getCandidateSiteDisplayName(site), margin + metricColumnWidth + siteColumnWidth * index + 8, y + 14, {
          maxWidth: siteColumnWidth - 12,
        });
      });
      y += 22;

      pdf.setFont("helvetica", "normal");
      dims.forEach((dimension, rowIndex) => {
        ensureSpace(20);
        if (rowIndex % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, y, contentWidth, 20, "F");
        }

        pdf.text(dimension.label, margin + 8, y + 13);
        selectedSites.forEach((site, index) => {
          const value = String((site as CandidateSite & Record<string, number>)[dimension.key]);
          pdf.text(value, margin + metricColumnWidth + siteColumnWidth * index + 8, y + 13);
        });
        y += 20;
      });

      y += 18;
      ensureSpace(180);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Grouped score chart", margin, y);
      y += 18;

      const chartLeft = margin + 110;
      const chartWidth = contentWidth - 120;
      const barGroupHeight = 22;
      const barHeight = Math.max(5, Math.floor(16 / Math.max(selectedSites.length, 1)));

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      dims.forEach((dimension) => {
        ensureSpace(barGroupHeight + 10);
        pdf.setTextColor(51, 65, 85);
        pdf.text(dimension.label, margin, y + 12, { maxWidth: 100 });
        pdf.setDrawColor(226, 232, 240);
        pdf.line(chartLeft, y + 18, chartLeft + chartWidth, y + 18);

        selectedSites.forEach((site, index) => {
          const value = (site as CandidateSite & Record<string, number>)[dimension.key];
          const barWidth = (Math.max(0, Math.min(100, value)) / 100) * chartWidth;
          const [r, g, b] = colors[index % colors.length];
          pdf.setFillColor(r, g, b);
          pdf.rect(chartLeft, y + 2 + index * (barHeight + 1), barWidth, barHeight, "F");
          pdf.setTextColor(r, g, b);
          pdf.text(String(value), chartLeft + barWidth + 6, y + 10 + index * (barHeight + 1));
        });

        y += barGroupHeight;
      });

      y += 18;
      ensureSpace(20 + comparisonInsights.length * 26);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Comparison insights", margin, y);
      y += 18;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      comparisonInsights.forEach((insight) => {
        ensureSpace(26);
        pdf.setFont("helvetica", "bold");
        pdf.text(insight.criterion, margin, y);
        y += 12;
        pdf.setFont("helvetica", "normal");
        pdf.text(insight.detail, margin, y, { maxWidth: contentWidth });
        y += 16;
      });

      const timestamp = new Date()
        .toISOString()
        .replace(/[:]/g, "-")
        .replace(/\..+/, "");
      pdf.save(`smartlocate-compare-${timestamp}.pdf`);
      toast({
        title: "PDF exported",
        description: "Comparison report downloaded.",
      });
    } catch (error) {
      console.error("[compare][export-pdf]", error);
      toast({
        title: "Export failed",
        description: "Could not generate the comparison PDF.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const explainComparison = () => {
    if (selectedSites.length < 2) {
      toast({
        title: "Select at least 2 sites",
        description: "Choose two sites to get a meaningful comparison explanation.",
        variant: "destructive",
      });
      return;
    }

    openChatbot(compareChatbotPayload);
  };

  return (
    <AppShell
      title="Compare"
      right={
        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => {
            void exportComparisonPdf();
          }}
          disabled={selectedSites.length < 2 || exporting}
          data-testid="button-export-pdf"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting ? "Exporting..." : "Export PDF"}
        </Button>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-compare-title">Compare Sites</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-compare-subtitle">
            Compare 2-3 candidate sites side-by-side, even across different profiles.
          </p>
        </div>

        <Card className="border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" data-testid="text-compare-select-title">Select sites</div>
              <div className="mt-1 text-xs text-muted-foreground">Filter by profile before choosing up to 3 sites.</div>
            </div>
            <div className="w-full sm:w-[260px]">
              <Select value={profileFilter} onValueChange={setProfileFilter}>
                <SelectTrigger data-testid="select-profile-filter">
                  <SelectValue placeholder="Filter profiles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="select-item-profile-filter-all">
                    All profiles
                  </SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem
                      key={profile.id}
                      value={profile.id}
                      data-testid={`select-item-profile-filter-${profile.id}`}
                    >
                      {profile.name}{profile.active ? " (Active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span data-testid="text-compare-active-profile">
              Scope: {comparisonProfile?.name ?? (selectedSites.length > 0 ? "Multiple profiles" : activeProfile?.name ?? "All saved sites")}
            </span>
            <span>Prepared on: {exportTimestamp}</span>
          </div>
          {availableSites.length === 0 ? (
            <div className="mt-3 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="status-no-sites-for-profile">
              No saved candidate sites for the selected profile filter.
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {availableSites.map((site) => (
              <label
                key={site.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3"
                data-testid={`row-select-site-${site.id}`}
              >
                <Checkbox
                  checked={selected.includes(site.id)}
                  onCheckedChange={() => toggle(site.id)}
                  data-testid={`checkbox-select-${site.id}`}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium" data-testid={`text-select-name-${site.id}`}>{getCandidateSiteDisplayName(site)}</div>
                  <div className="truncate text-xs text-muted-foreground" data-testid={`text-select-address-${site.id}`}>{site.address}</div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    Profile: {profileNameById.get(site.profileId) ?? "Unassigned"}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2" data-testid="chips-selected">
            {selectedSites.map((site) => (
              <div key={site.id} className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs">
                <span data-testid={`chip-site-${site.id}`}>{getCandidateSiteDisplayName(site)}</span>
                <button
                  className="rounded-full p-1 hover:bg-muted"
                  onClick={() => toggle(site.id)}
                  data-testid={`button-remove-chip-${site.id}`}
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
                <ChartContainer className="h-80" config={chartConfig}>
                  <BarChart data={chartData} margin={{ left: 0, right: 16, top: 8, bottom: 32 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="metric"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickMargin={8}
                      tick={renderMetricTick}
                      height={52}
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

            <Card className="border bg-card p-5 shadow-sm" data-testid="card-compare-insights">
              <div className="text-sm font-semibold">Comparison insights</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Short recommendations based on the currently selected sites.
              </div>
              <div className="mt-4 space-y-3">
                {comparisonInsights.map((insight) => (
                  <div key={insight.criterion} className="rounded-xl border bg-muted/20 p-3 text-sm">
                    <div className="font-medium">{insight.criterion}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{insight.detail}</div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-3 lg:grid-cols-3">
              {selectedSites.map((site) => (
                <Card key={site.id} className="border bg-card p-5 shadow-sm" data-testid={`card-compare-${site.id}`}>
                  <div className="text-sm font-semibold" data-testid={`text-compare-name-${site.id}`}>{getCandidateSiteDisplayName(site)}</div>
                  <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-compare-address-${site.id}`}>{site.address}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Profile: {profileNameById.get(site.profileId) ?? "Unassigned"}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {dims.map((dimension) => (
                      <div key={dimension.key} className="flex items-center justify-between" data-testid={`row-compare-${dimension.key}-${site.id}`}>
                        <div className="text-xs text-muted-foreground" data-testid={`text-compare-label-${dimension.key}-${site.id}`}>{dimension.label}</div>
                        <div className="text-sm font-semibold" data-testid={`text-compare-value-${dimension.key}-${site.id}`}>{(site as CandidateSite & Record<string, number>)[dimension.key]}</div>
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
