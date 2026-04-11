import { useEffect } from "react";
import { Link } from "wouter";
import { Map as MapIcon, Plus, Scale } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchJsonWithCache } from "@/lib/api-cache";
import { getCandidateSiteDisplayName, mockProfiles, type CandidateSite } from "@/lib/mock-data";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { useAuth } from "@/context/auth-context";

const PROFILES_CACHE_TTL_MS = 2 * 60 * 1000;
const SITES_CACHE_TTL_MS = 60 * 1000;

function Stat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="workspace-panel workspace-hover-card p-5">
      <div className="workspace-kicker" data-testid={`text-stat-label-${testid}`}>
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight" data-testid={`text-stat-value-${testid}`}>
        {value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const [profiles, setProfiles] = useLocalStorageState("smartlocate:profiles", mockProfiles);
  const [sites, setSites] = useLocalStorageState<CandidateSite[]>("smartlocate:sites", []);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboardData = async () => {
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

        const mappedProfiles = profileRows.map((row) => ({
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
          breakdownDetailsJson: row.breakdownDetailsJson ?? undefined,
        }));

        if (!cancelled) {
          setProfiles(mappedProfiles);
          setSites(mappedSites);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard fetch error:", error);
        }
      }
    };

    void fetchDashboardData();

    return () => {
      cancelled = true;
    };
  }, [authLoading, setProfiles, setSites, userId]);

  const profileIds = new Set(profiles.map((profile) => profile.id));
  const scopedSites = sites.filter((site) => profileIds.has(site.profileId));

  return (
    <AppShell
      title="Dashboard"
      right={
        <Link href="/profiles/new">
          <Button className="workspace-pill-button gap-2" data-testid="button-create-profile">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Business Profile
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <section className="workspace-page-header">
          <div className="workspace-page-header-grid">
            <div>
              <div className="workspace-kicker">Workspace overview</div>
              <h1 className="workspace-page-title mt-4" data-testid="text-dashboard-title">
                Dashboard
              </h1>
              <p className="workspace-page-lead" data-testid="text-dashboard-subtitle">
                Quick starting points for map scoring and comparison.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="workspace-inline-stat">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active workflow</div>
                <div className="mt-2 text-lg font-semibold">Profiles, map, and comparison</div>
              </div>
              <div className="workspace-inline-stat">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current readiness</div>
                <div className="mt-2 text-lg font-semibold">{scopedSites.length >= 2 ? "Comparison ready" : "Build shortlist"}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Business profiles" value={String(profiles.length)} testid="profiles" />
          <Stat label="Saved candidate sites" value={String(scopedSites.length)} testid="sites" />
          <Stat label="Ready for comparison" value={scopedSites.length >= 2 ? "Yes" : "No"} testid="compare" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="workspace-surface workspace-hover-card rounded-[1.75rem] border p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="workspace-kicker" data-testid="text-recent-profiles-title">
                  Recent profiles
                </div>
                <div className="mt-2 text-sm text-muted-foreground" data-testid="text-recent-profiles-sub">
                  Select a profile before scoring.
                </div>
              </div>
              <Link href="/profiles">
                <Button variant="secondary" size="sm" data-testid="button-manage-profiles">
                  Manage
                </Button>
              </Link>
            </div>

            {profiles.length === 0 ? (
              <div className="workspace-empty-state mt-5" data-testid="empty-profiles">
                Create your first business profile to start scoring locations.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {profiles.slice(0, 3).map((profile) => (
                  <div
                    key={profile.id}
                    className="workspace-list-row flex items-center justify-between gap-3"
                    data-testid={`row-profile-${profile.id}`}
                  >
                    <div>
                      <div className="text-sm font-medium" data-testid={`text-profile-name-${profile.id}`}>
                        {profile.name}
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-profile-meta-${profile.id}`}>
                        {profile.sector} | {profile.priceBand}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground" data-testid={`text-profile-updated-${profile.id}`}>
                      {profile.updatedAt}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="workspace-surface workspace-hover-card rounded-[1.75rem] border p-6">
            <div>
              <div className="workspace-kicker" data-testid="text-quick-actions-title">
                Quick actions
              </div>
              <div className="mt-2 text-sm text-muted-foreground" data-testid="text-quick-actions-sub">
                Jump into scoring and comparison.
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Link href="/map">
                <Button variant="secondary" className="h-12 justify-between rounded-2xl px-4" data-testid="button-open-map">
                  <span className="inline-flex items-center gap-2">
                    <MapIcon className="h-4 w-4" aria-hidden="true" />
                    Open Map
                  </span>
                  <span className="text-muted-foreground">Map</span>
                </Button>
              </Link>

              <Link href="/compare">
                <Button
                  variant="secondary"
                  className="h-12 justify-between rounded-2xl px-4"
                  disabled={scopedSites.length < 2}
                  data-testid="button-compare-sites"
                >
                  <span className="inline-flex items-center gap-2">
                    <Scale className="h-4 w-4" aria-hidden="true" />
                    Compare Sites
                  </span>
                  <span className="text-muted-foreground">{scopedSites.length < 2 ? "Need 2+" : "Ready"}</span>
                </Button>
              </Link>

              <div className="workspace-panel-muted text-xs text-muted-foreground" data-testid="text-dashboard-note">
                Scores and map layers reflect the currently available data sources and fallbacks.
              </div>
            </div>
          </Card>
        </div>

        <Card className="workspace-surface workspace-hover-card rounded-[1.75rem] border p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="workspace-kicker" data-testid="text-recent-sites-title">
                Recent candidate sites
              </div>
              <div className="mt-2 text-sm text-muted-foreground" data-testid="text-recent-sites-sub">
                Latest saved locations across profiles.
              </div>
            </div>
            <Link href="/portfolio">
              <Button variant="secondary" size="sm" data-testid="button-view-portfolio">
                View all
              </Button>
            </Link>
          </div>

          {scopedSites.length === 0 ? (
            <div className="workspace-empty-state mt-5" data-testid="empty-sites">
              Save a site from the map to build your portfolio.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {scopedSites.slice(0, 3).map((site) => (
                <div
                  key={site.id}
                  className="workspace-list-row flex items-center justify-between gap-3"
                  data-testid={`row-site-${site.id}`}
                >
                  <div>
                    <div className="text-sm font-medium" data-testid={`text-site-name-${site.id}`}>
                      {getCandidateSiteDisplayName(site)}
                    </div>
                    <div className="text-xs text-muted-foreground" data-testid={`text-site-address-${site.id}`}>
                      {site.address}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid={`text-site-saved-${site.id}`}>
                    {site.savedAt}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
