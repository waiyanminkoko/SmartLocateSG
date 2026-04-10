import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { FileText, Map as MapIcon, Pencil, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCandidateSiteDisplayName, mockProfiles, CandidateSite } from "@/lib/mock-data";
import { openChatbot, setLatestChatbotPayload, type OpenChatbotPayload } from "@/lib/chatbot";
import { buildPortfolioInsights } from "@/lib/explanation-insights";
import { fetchJsonWithCache, invalidateApiCache, writeApiCache } from "@/lib/api-cache";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { useAuth } from "@/context/auth-context";

const PROFILES_CACHE_TTL_MS = 2 * 60 * 1000;
const SITES_CACHE_TTL_MS = 60 * 1000;

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
  const [renamingSite, setRenamingSite] = useState<CandidateSite | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [notesSite, setNotesSite] = useState<CandidateSite | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

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

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.active) ?? null,
    [profiles],
  );

  const focusSite = useMemo(
    () =>
      filtered.find((site) => selectedIds.includes(site.id)) ??
      filtered[0] ??
      sites[0] ??
      null,
    [filtered, selectedIds, sites],
  );

  const portfolioInsights = useMemo(
    () => (focusSite ? buildPortfolioInsights(focusSite) : []),
    [focusSite],
  );

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
        invalidateApiCache(`sites:${userId}`);
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

  const openNotesDialog = (site: CandidateSite) => {
    setNotesSite(site);
    setNotesDraft(site.notes ?? "");
    setNotesDialogOpen(true);
  };

  const closeNotesDialog = () => {
    setNotesDialogOpen(false);
    setNotesSite(null);
    setNotesDraft("");
    setNotesSaving(false);
  };

  const persistNotesOnClose = async () => {
    if (notesSaving) {
      return;
    }

    const editingSite = notesSite;
    if (!editingSite) {
      closeNotesDialog();
      return;
    }

    const nextNotes = notesDraft;
    const previousNotes = editingSite.notes ?? "";
    if (nextNotes === previousNotes) {
      closeNotesDialog();
      return;
    }

    setNotesSaving(true);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(editingSite.id)}?userId=${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notes: nextNotes }),
        },
      );

      if (!response.ok) {
        throw new Error("failed");
      }

      const updated = (await response.json()) as CandidateSite;
      setSites((prev) => {
        const next = prev.map((site) =>
          site.id === editingSite.id
            ? {
                ...site,
                notes: updated.notes ?? nextNotes,
                breakdownDetailsJson: updated.breakdownDetailsJson ?? site.breakdownDetailsJson,
              }
            : site,
        );
        writeApiCache(`sites:${userId}`, next, SITES_CACHE_TTL_MS);
        return next;
      });

      toast({ title: "Notes updated", description: "Saved to Supabase." });
      closeNotesDialog();
    } catch {
      toast({
        title: "Failed to update notes",
        description: "Please try again.",
        variant: "destructive",
      });
      setNotesSaving(false);
    }
  };

  const handleNotesDialogOpenChange = (open: boolean) => {
    if (open) {
      setNotesDialogOpen(true);
      return;
    }

    void persistNotesOnClose();
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
          scoreNotes: site.notes,
          breakdownDetailsJson: site.breakdownDetailsJson,
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

  const openRenameDialog = (site: CandidateSite) => {
    setRenamingSite(site);
    setRenameValue(getCandidateSiteDisplayName(site));
  };

  const closeRenameDialog = () => {
    setRenamingSite(null);
    setRenameValue("");
    setRenameSubmitting(false);
  };

  const renameSite = () => {
    if (!renamingSite) {
      return;
    }

    const nextName = renameValue.trim();
    if (!nextName) {
      toast({
        title: "Name required",
        description: "Enter a candidate site name before saving.",
        variant: "destructive",
      });
      return;
    }

    setRenameSubmitting(true);

    void (async () => {
      try {
        const response = await fetch(
          `/api/sites/${encodeURIComponent(renamingSite.id)}?userId=${encodeURIComponent(userId)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: nextName }),
          },
        );

        if (!response.ok) {
          throw new Error("failed");
        }

        const updated = (await response.json()) as CandidateSite;
        setSites((prev) => {
          const next = prev.map((site) =>
            site.id === renamingSite.id
              ? { ...site, name: updated.name, breakdownDetailsJson: updated.breakdownDetailsJson ?? site.breakdownDetailsJson }
              : site,
          );
          writeApiCache(`sites:${userId}`, next, SITES_CACHE_TTL_MS);
          return next;
        });
        toast({ title: "Site name updated", description: `${nextName} is now saved in your portfolio.` });
        closeRenameDialog();
      } catch {
        toast({
          title: "Failed to update site name",
          description: "Please try again.",
          variant: "destructive",
        });
        setRenameSubmitting(false);
      }
    })();
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

  const portfolioChatbotPayload = useMemo<OpenChatbotPayload | null>(() => {
    const target =
      filtered.find((site) => selectedIds.includes(site.id)) ??
      filtered[0] ??
      sites[0];

    if (!target) {
      return null;
    }

    return {
      context: {
        page: "portfolio",
        title: "Portfolio site explanation",
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
        sites: [
          {
            id: target.id,
            profileId: target.profileId,
            name: target.name,
            address: target.address,
            lat: target.lat,
            lng: target.lng,
            composite: target.composite,
            demographic: target.demographic,
            accessibility: target.accessibility,
            rental: target.rental,
            competition: target.competition,
            notes: target.notes,
          },
        ],
        hiddenContext: {
          profileFilter,
          query,
          selectedIds,
          totalSites: sites.length,
          filteredSitesCount: filtered.length,
          activeProfileId: activeProfile?.id ?? null,
          focusSite,
          filteredSites: filtered.map((site) => ({
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
          portfolioInsights,
        },
      },
      starterPrompt:
        "Explain this saved site's score breakdown and suggest whether I should keep, improve, or deprioritize it.",
    };
  }, [
    activeProfile,
    filtered,
    focusSite,
    portfolioInsights,
    profileFilter,
    query,
    selectedIds,
    sites,
  ]);

  useEffect(() => {
    if (!portfolioChatbotPayload) {
      return;
    }
    setLatestChatbotPayload(portfolioChatbotPayload);
  }, [portfolioChatbotPayload]);

  const explainWithChatbot = () => {
    if (!portfolioChatbotPayload) {
      toast({
        title: "No site to explain",
        description: "Save a site from the map first.",
        variant: "destructive",
      });
      return;
    }

    openChatbot(portfolioChatbotPayload);
  };

  return (
    <AppShell
      title="Portfolio"
      right={
        <Button
          variant="secondary"
          className="border bg-white hover:bg-white"
          onClick={compareSelected}
          data-testid="button-go-compare"
        >
          Compare selected ({selectedIds.length})
        </Button>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-portfolio-title">Portfolio</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-portfolio-subtitle">
            Manage saved candidate sites.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="relative w-full md:max-w-sm">
              <Input
                placeholder="Filter by name or address"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-white"
                data-testid="input-portfolio-filter"
              />
            </div>
            <Select value={profileFilter} onValueChange={setProfileFilter}>
              <SelectTrigger className="w-full bg-white md:w-56" data-testid="select-profile-filter">
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border bg-white hover:bg-white"
              onClick={explainWithChatbot}
              data-testid="button-portfolio-explain-score"
            >
              Explain score
            </Button>
          </div>
        </div>

        {focusSite ? (
          <Card className="border bg-card p-5 shadow-sm" data-testid="card-portfolio-insights">
            <div className="text-sm font-semibold">Saved site insights</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Insights for the currently focused saved site: {getCandidateSiteDisplayName(focusSite)}.
            </div>
            <div className="mt-4 space-y-3">
              {portfolioInsights.map((insight) => (
                <div key={insight.criterion} className="rounded-xl border bg-muted/20 p-3 text-sm">
                  <div className="font-medium">{insight.criterion}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{insight.detail}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

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
                      <div className="text-base font-semibold" data-testid={`text-site-name-${s.id}`}>{getCandidateSiteDisplayName(s)}</div>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => openRenameDialog(s)}
                        data-testid={`button-rename-site-${s.id}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" /> Rename
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => openNotesDialog(s)}
                        data-testid={`button-edit-notes-${s.id}`}
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" /> Notes
                      </Button>

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
      <Dialog open={notesDialogOpen} onOpenChange={handleNotesDialogOpenChange}>
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle data-testid="text-notes-title">Edit notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={notesDraft}
              placeholder="Add any observations, risks, or follow-ups..."
              data-testid="textarea-notes"
              onChange={(event) => setNotesDraft(event.target.value)}
              disabled={notesSaving}
            />
            <div className="text-xs text-muted-foreground" data-testid="text-notes-hint">
              Notes are saved when you close this dialog using the X button.
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(renamingSite)} onOpenChange={(open) => { if (!open) closeRenameDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-rename-site-title">Rename candidate site</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Update the site name shown across your portfolio, map handoff, and comparison views.
            </div>
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="e.g. Tiong Bahru Central_Cafe"
              data-testid="input-rename-site"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={closeRenameDialog}>
              Cancel
            </Button>
            <Button onClick={renameSite} disabled={renameSubmitting} data-testid="button-save-site-name">
              {renameSubmitting ? "Saving..." : "Save name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
