import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { mockProfiles, BusinessProfile } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

export default function Profiles() {
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<BusinessProfile[]>(() => mockProfiles);

  const activeId = useMemo(() => profiles.find((p) => p.active)?.id, [profiles]);

  const setActive = (id: string) => {
    setProfiles((prev) => prev.map((p) => ({ ...p, active: p.id === id })));
    toast({ title: "Active profile updated", description: "Scoring will use this profile." });
  };

  const remove = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Profile deleted (prototype)" });
  };

  return (
    <AppShell
      title="Business Profiles"
      right={
        <Button className="gap-2" onClick={() => toast({ title: "Create Profile (prototype)", description: "Wizard UI can be added next." })} data-testid="button-create-profile-top">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Profile
        </Button>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-profiles-title">Business Profiles</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-profiles-subtitle">
            Manage your business profiles for location scoring.
          </p>
        </div>

        {profiles.length === 0 ? (
          <Card className="border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground" data-testid="empty-profiles-text">
              No profiles yet. Create your first business profile to start scoring.
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {profiles.map((p) => (
              <Card key={p.id} className="border bg-card p-5 shadow-sm" data-testid={`card-profile-${p.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold" data-testid={`text-profile-title-${p.id}`}>{p.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-profile-sector-${p.id}`}>{p.sector}</div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-delete-profile-${p.id}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle data-testid="text-delete-title">Delete profile?</AlertDialogTitle>
                        <AlertDialogDescription data-testid="text-delete-desc">
                          This removes the profile from this prototype session.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(p.id)} data-testid="button-confirm-delete">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex items-center justify-between" data-testid={`row-price-${p.id}`}>
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-medium" data-testid={`text-price-${p.id}`}>{p.priceBand}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid={`row-ages-${p.id}`}>
                    <span className="text-muted-foreground">Ages</span>
                    <span className="font-medium" data-testid={`text-ages-${p.id}`}>{p.ageGroups.join(", ")}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid={`row-operating-${p.id}`}>
                    <span className="text-muted-foreground">Operating</span>
                    <span className="font-medium" data-testid={`text-operating-${p.id}`}>{p.operatingModel}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid={`row-updated-${p.id}`}>
                    <span className="text-muted-foreground">Last updated</span>
                    <span className="font-medium" data-testid={`text-updated-${p.id}`}>{p.updatedAt}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <Button
                    variant={activeId === p.id ? "default" : "secondary"}
                    className="w-full"
                    onClick={() => setActive(p.id)}
                    data-testid={`button-set-active-${p.id}`}
                  >
                    {activeId === p.id ? "Active" : "Set as Active"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
