import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { jsPDF } from "jspdf";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { getCandidateSiteDisplayName, mockProfiles, mockSites, BusinessProfile, CandidateSite } from "@/lib/mock-data";
import { openChatbot, setLatestChatbotPayload, type OpenChatbotPayload } from "@/lib/chatbot";
import { buildCompareInsights } from "@/lib/explanation-insights";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorageState } from "@/hooks/use-local-storage";

export default function Compare() {
  const { toast } = useToast();
  const [sites] = useLocalStorageState<CandidateSite[]>("smartlocate:sites", mockSites);
  const [profiles] = useLocalStorageState<BusinessProfile[]>("smartlocate:profiles", mockProfiles);
  const [exporting, setExporting] = useState(false);

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

  const comparisonInsights = useMemo(
    () => buildCompareInsights(selectedSites),
    [selectedSites],
  );

  const compareChatbotPayload = useMemo<OpenChatbotPayload>(
    () => ({
      context: {
        page: "compare",
        title: "Site comparison explanation",
        profile: activeProfile
          ? {
              id: activeProfile.id,
              name: activeProfile.name,
              sector: activeProfile.sector,
              priceBand: activeProfile.priceBand,
              ageGroups: activeProfile.ageGroups,
              incomeBands: activeProfile.incomeBands,
              operatingModel: activeProfile.operatingModel,
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
          totalProfileSites: profileSites.length,
          activeProfileId,
          profileSites: profileSites.map((site) => ({
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
    [activeProfile, activeProfileId, chartData, comparisonInsights, profileSites, selected, selectedSites],
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
      pdf.text(`Profile: ${activeProfile?.name ?? "None selected"}`, margin, y);
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
        pdf.text(`${index + 1}. ${getCandidateSiteDisplayName(site)} — ${site.address}`, margin, y);
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
        <div className="flex items-center gap-2">
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
          <p className="mt-1 text-xs text-muted-foreground">
            Prepared on: {exportTimestamp}
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
                  <div className="truncate text-sm font-medium" data-testid={`text-select-name-${s.id}`}>{getCandidateSiteDisplayName(s)}</div>
                  <div className="truncate text-xs text-muted-foreground" data-testid={`text-select-address-${s.id}`}>{s.address}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2" data-testid="chips-selected">
            {selectedSites.map((s) => (
              <div key={s.id} className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs">
                <span data-testid={`chip-site-${s.id}`}>{getCandidateSiteDisplayName(s)}</span>
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
              {selectedSites.map((s) => (
                <Card key={s.id} className="border bg-card p-5 shadow-sm" data-testid={`card-compare-${s.id}`}>
                  <div className="text-sm font-semibold" data-testid={`text-compare-name-${s.id}`}>{getCandidateSiteDisplayName(s)}</div>
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
