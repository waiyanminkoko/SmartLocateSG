import { useMemo, useState } from "react";
import { Link } from "wouter";
import { FileText, Map as MapIcon, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { mockProfiles, mockSites, CandidateSite } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

export default function Portfolio() {
  const { toast } = useToast();

  const profiles = mockProfiles;
  const [sites, setSites] = useState<CandidateSite[]>(() => mockSites);
  const [query, setQuery] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((s) =>
      [s.name, s.address].some((v) => v.toLowerCase().includes(q)),
    );
  }, [sites, query]);

  const remove = (id: string) => {
    setSites((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Site removed (prototype)" });
  };

  const updateNotes = (id: string, notes: string) => {
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, notes } : s)));
    toast({ title: "Notes saved", description: "Stored in-memory for this session." });
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
          <div className="relative w-full md:max-w-md">
            <Input
              placeholder="Filter by name or address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="input-portfolio-filter"
            />
          </div>
          <Link href="/compare">
            <Button variant="secondary" data-testid="button-go-compare">
              Compare
            </Button>
          </Link>
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
                      <Link href="/map">
                        <Button variant="secondary" size="sm" className="gap-2" data-testid={`button-view-map-${s.id}`}>
                          <MapIcon className="h-4 w-4" aria-hidden="true" /> View on map
                        </Button>
                      </Link>

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
