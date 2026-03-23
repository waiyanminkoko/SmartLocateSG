import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { FileText, Map as MapIcon, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { mockProfiles, CandidateSite } from "@/lib/mock-data";
import { openChatbot } from "@/lib/chatbot";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { useAuth } from "@/context/auth-context";

export default function Portfolio() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";

  const [profiles, setProfiles] = useLocalStorageState("smartlocate:profiles", mockProfiles);
  const [sites, setSites] = useLocalStorageState<CandidateSite[]>(
    "smartlocate:sites",
    [],
  );
  const [query, setQuery] = useState<string>("");
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auto-filter to active profile when profiles load
  useEffect(() => {
    const activeProfile = profiles.find((p) => p.active);
    if (activeProfile) {
      setProfileFilter(activeProfile.id);
    }
  }, [profiles]);

  useEffect(() => {
    let cancelled = false;

    const fetchPortfolioData = async () => {
      if (authLoading || !userId) {
        return;
      }

      try {
        const [profilesResponse, sitesResponse] = await Promise.all([
          fetch(`/api/profiles?userId=${encodeURIComponent(userId)}`),
          fetch(`/api/sites/${encodeURIComponent(userId)}`),
        ]);

        if (!profilesResponse.ok || !sitesResponse.ok) {
          throw new Error("failed");
        }

        const profileRows = (await profilesResponse.json()) as Array<{
          id: string;
          name: string;
          sector: string;
          priceBand: string;
          ageGroups: string[];
          incomeBands: string[];
          operatingModel: string;
          active: boolean;
          updatedAt: string;
        }>;

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

        const siteRows = (await sitesResponse.json()) as Array<{
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
          lat?: number | null;
          lng?: number | null;
        }>;

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
        }));

        if (!cancelled) {
          setProfiles(mappedProfiles);
          setSites(mappedSites);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Portfolio fetch error:", error);
          toast({
            title: "Portfolio API unavailable",
            description: "Showing locally stored sites.",
            variant: "destructive",
          });
        }
      }
    };

    fetchPortfolioData();

    return () => {
      cancelled = true;
    };
  }, [setProfiles, setSites, toast, userId, authLoading]);

  const filtered = useMemo(() => {
    let result = sites;
    if (profileFilter !== "all") {
      result = result.filter((s) => s.profileId === profileFilter);
    }

    const q = query.trim().toLowerCase();
    if (!q) return result;
    return result.filter((s) =>
      [s.name, s.address].some((v) => v.toLowerCase().includes(q)),
    );
  }, [sites, query, profileFilter]);

  const remove = (id: string) => {
    void (async () => {
      try {
        const response = await fetch(
          `/api/sites/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          throw new Error("failed");
        }

        setSites((prev) => prev.filter((s) => s.id !== id));
        toast({ title: "Site removed" });
      } catch {
        toast({
          title: "Failed to remove site",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    })();
  };

  const updateNotes = (id: string, notes: string) => {
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, notes } : s)));
    toast({ title: "Notes saved", description: "Stored in-memory for this session." });
  };

  const openOnMap = (site: CandidateSite) => {
    if (site.lat !== undefined && site.lng !== undefined) {
      localStorage.setItem(
        "smartlocate:mapSelection",
        JSON.stringify({
          lat: site.lat,
          lng: site.lng,
          profileId: site.profileId,
          siteName: site.name,
          siteAddress: site.address,
        }),
      );
    } else {
      toast({
        title: "No coordinates saved",
        description: "This site does not have a saved pin location.",
        variant: "destructive",
      });
      localStorage.removeItem("smartlocate:mapSelection");
      return;
    }
    setLocation("/map");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const compareSelected = () => {
    if (selectedIds.length < 2) {
      toast({
        title: "Select at least 2 sites",
        description: "Pick two or three sites to compare.",
        variant: "destructive",
      });
      return;
    }
    localStorage.setItem("compare:selected", JSON.stringify(selectedIds.slice(0, 3)));
    toast({ title: "Comparison ready", description: "Opening the compare dashboard." });
    setLocation("/compare");
  };

  const explainWithChatbot = () => {
    const target =
      filtered.find((site) => selectedIds.includes(site.id)) ??
      filtered[0] ??
      sites[0];

    if (!target) {
      toast({
        title: "No site to explain",
        description: "Save a site from the map first.",
        variant: "destructive",
      });
      return;
    }

    openChatbot({
      context: {
        page: "portfolio",
        title: "Portfolio site explanation",
        sites: [
          {
            id: target.id,
            name: target.name,
            address: target.address,
            composite: target.composite,
            demographic: target.demographic,
            accessibility: target.accessibility,
            rental: target.rental,
            competition: target.competition,
          },
        ],
      },
      starterPrompt:
        "Explain this saved site's score breakdown and suggest whether I should keep, improve, or deprioritize it.",
    });
  };

  return (
    <AppShell title="Portfolio">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-portfolio-title">Portfolio</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-portfolio-subtitle">
            Manage saved candidate sites.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="relative w-full md:max-w-sm">
              <Input
                placeholder="Filter by name or address"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                data-testid="input-portfolio-filter"
              />
            </div>
            <Select value={profileFilter} onValueChange={setProfileFilter}>
              <SelectTrigger className="w-full md:w-56" data-testid="select-profile-filter">
                <SelectValue placeholder="All profiles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All profiles</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" onClick={compareSelected} data-testid="button-go-compare">
            Compare selected ({selectedIds.length})
          </Button>
          <Button variant="outline" onClick={explainWithChatbot} data-testid="button-portfolio-explain-score">
            Explain score
          </Button>
        </div>

        {filtered.length === 0 ? (
          <Card className="border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground" data-testid="empty-portfolio">
              No candidate sites yet. Save a site from the map to begin.
            </div>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((s) => {
              const profile = profiles.find((p) => p.id === s.profileId);
              return (
                <Card key={s.id} className="border bg-card p-5 shadow-sm" data-testid={`card-site-${s.id}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-base font-semibold" data-testid={`text-site-name-${s.id}`}>{s.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground" data-testid={`text-site-address-${s.id}`}>{s.address}</div>
                      <div className="mt-2 text-xs text-muted-foreground" data-testid={`text-site-meta-${s.id}`}>
                        Profile: {profile?.name ?? "—"} • Saved: {s.savedAt}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={selectedIds.includes(s.id)}
                          onCheckedChange={() => toggleSelect(s.id)}
                          data-testid={`checkbox-compare-${s.id}`}
                        />
                        Compare
                      </label>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                        onClick={() => openOnMap(s)}
                        data-testid={`button-view-map-${s.id}`}
                      >
                        <MapIcon className="h-4 w-4" aria-hidden="true" /> View on map
                      </Button>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2" data-testid={`button-edit-notes-${s.id}`}>
                            <FileText className="h-4 w-4" aria-hidden="true" /> Notes
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle data-testid="text-notes-title">Edit notes</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2">
                            <Textarea
                              defaultValue={s.notes ?? ""}
                              placeholder="Add any observations, risks, or follow-ups…"
                              data-testid="textarea-notes"
                              onChange={(e) => updateNotes(s.id, e.target.value)}
                            />
                            <div className="text-xs text-muted-foreground" data-testid="text-notes-hint">
                              Notes are saved in-memory (prototype).
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(s.id)}
                        data-testid={`button-delete-site-${s.id}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    {([
                      ["Composite", s.composite],
                      ["Demographic", s.demographic],
                      ["Access", s.accessibility],
                      ["Rental", s.rental],
                      ["Competition", s.competition],
                    ] as const).map(([k, v]) => (
                      <div key={k} className="rounded-xl border bg-muted/30 p-3" data-testid={`stat-${k}-${s.id}`}>
                        <div className="text-xs text-muted-foreground" data-testid={`text-stat-label-${k}-${s.id}`}>{k}</div>
                        <div className="mt-1 text-lg font-semibold" data-testid={`text-stat-value-${k}-${s.id}`}>{v}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
