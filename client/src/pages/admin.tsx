import { useState } from "react";
import { DatabaseZap, RefreshCcw, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type SourceStatus = "Healthy" | "Degraded" | "Offline";

const statusVariant: Record<SourceStatus, "default" | "secondary" | "destructive"> = {
  Healthy: "default",
  Degraded: "secondary",
  Offline: "destructive",
};

const initialSources = [
  {
    id: "onemap",
    name: "OneMap / SingStat",
    description: "Population, age, income by subzone",
    status: "Healthy" as const,
    lastUpdated: "Feb 4, 2026",
    freshness: "2 days",
  },
  {
    id: "lta",
    name: "LTA DataMall",
    description: "MRT stations, exits, bus stops",
    status: "Healthy" as const,
    lastUpdated: "Feb 4, 2026",
    freshness: "2 days",
  },
  {
    id: "ura",
    name: "URA / Rental Proxies",
    description: "Vacancy and rental pressure indices",
    status: "Degraded" as const,
    lastUpdated: "Jan 28, 2026",
    freshness: "9 days",
  },
  {
    id: "competition",
    name: "Google Maps / data.gov.sg",
    description: "Competitor counts within radius",
    status: "Healthy" as const,
    lastUpdated: "Feb 3, 2026",
    freshness: "3 days",
  },
];

export default function Admin() {
  const { toast } = useToast();
  const [sources, setSources] = useState(initialSources);
  const [refreshing, setRefreshing] = useState(false);

  const runRefresh = () => {
    setRefreshing(true);
    toast({
      title: "Refresh queued",
      description: "Data refresh will run in the background (prototype).",
    });
    setTimeout(() => {
      setRefreshing(false);
      setSources((prev) =>
        prev.map((s) =>
          s.id === "ura"
            ? { ...s, status: "Healthy", lastUpdated: "Feb 6, 2026", freshness: "0 days" }
            : s,
        ),
      );
      toast({
        title: "Refresh completed",
        description: "All data sources are up to date.",
      });
    }, 1200);
  };

  return (
    <AppShell
      title="Admin"
      right={
        <Button className="gap-2" onClick={runRefresh} disabled={refreshing} data-testid="button-refresh-data">
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          {refreshing ? "Refreshing..." : "Run Refresh"}
        </Button>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-admin-title">Data Status</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-admin-subtitle">
            Monitor data source freshness and trigger manual refreshes.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <DatabaseZap className="h-4 w-4" aria-hidden="true" />
              Sources connected
            </div>
            <div className="mt-2 text-2xl font-semibold">{sources.length}</div>
          </Card>
          <Card className="border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Healthy sources
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {sources.filter((s) => s.status === "Healthy").length}
            </div>
          </Card>
          <Card className="border bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">Next scheduled run</div>
            <div className="mt-2 text-2xl font-semibold">Manual</div>
          </Card>
        </div>

        <Card className="border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold" data-testid="text-sources-title">Data sources</div>
          <div className="mt-4 grid gap-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between"
                data-testid={`row-source-${source.id}`}
              >
                <div>
                  <div className="text-sm font-semibold" data-testid={`text-source-name-${source.id}`}>
                    {source.name}
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid={`text-source-desc-${source.id}`}>
                    {source.description}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Last updated: {source.lastUpdated} • Freshness: {source.freshness}
                  </div>
                </div>
                <Badge variant={statusVariant[source.status]} data-testid={`badge-source-${source.id}`}>
                  {source.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold">Notes</div>
          <ul className="mt-2 text-xs text-muted-foreground">
            <li>Refresh jobs are manual for the prototype.</li>
            <li>Degraded sources may reduce scoring accuracy.</li>
            <li>All timestamps are shown in Singapore local time.</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
