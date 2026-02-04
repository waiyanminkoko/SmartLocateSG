import { Link } from "wouter";
import { Plus, Scale, Map as MapIcon } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mockProfiles, mockSites } from "@/lib/mock-data";

function Stat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs text-muted-foreground" data-testid={`text-stat-label-${testid}`}>{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight" data-testid={`text-stat-value-${testid}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const profiles = mockProfiles;
  const sites = mockSites;

  return (
    <AppShell
      title="Dashboard"
      right={
        <Link href="/profiles/new">
          <Button className="gap-2" data-testid="button-create-profile">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Business Profile
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-dashboard-subtitle">
            Quick starting points for map scoring and comparison.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Business profiles" value={String(profiles.length)} testid="profiles" />
          <Stat label="Saved candidate sites" value={String(sites.length)} testid="sites" />
          <Stat label="Ready for comparison" value={sites.length >= 2 ? "Yes" : "No"} testid="compare" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" data-testid="text-recent-profiles-title">Recent profiles</div>
                <div className="mt-1 text-xs text-muted-foreground" data-testid="text-recent-profiles-sub">
                  Select a profile before scoring.
                </div>
              </div>
              <Link href="/profiles">
                <Button variant="secondary" size="sm" data-testid="button-manage-profiles">Manage</Button>
              </Link>
            </div>

            {profiles.length === 0 ? (
              <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground" data-testid="empty-profiles">
                Create your first business profile to start scoring locations.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {profiles.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border bg-card px-3 py-2"
                    data-testid={`row-profile-${p.id}`}
                  >
                    <div>
                      <div className="text-sm font-medium" data-testid={`text-profile-name-${p.id}`}>{p.name}</div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-profile-meta-${p.id}`}>
                        {p.sector} • {p.priceBand}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground" data-testid={`text-profile-updated-${p.id}`}>{p.updatedAt}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" data-testid="text-quick-actions-title">Quick actions</div>
                <div className="mt-1 text-xs text-muted-foreground" data-testid="text-quick-actions-sub">
                  Jump into scoring and comparison.
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <Link href="/map">
                <Button variant="secondary" className="justify-between" data-testid="button-open-map">
                  <span className="inline-flex items-center gap-2">
                    <MapIcon className="h-4 w-4" aria-hidden="true" />
                    Open Map
                  </span>
                  <span className="text-muted-foreground">↵</span>
                </Button>
              </Link>

              <Link href="/compare">
                <Button
                  variant="secondary"
                  className="justify-between"
                  disabled={sites.length < 2}
                  data-testid="button-compare-sites"
                >
                  <span className="inline-flex items-center gap-2">
                    <Scale className="h-4 w-4" aria-hidden="true" />
                    Compare Sites
                  </span>
                  <span className="text-muted-foreground">{sites.length < 2 ? "Need 2+" : "↵"}</span>
                </Button>
              </Link>

              <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="text-dashboard-note">
                Note: This is a minimal, frontend-only prototype. Scores and map layers are illustrative.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
