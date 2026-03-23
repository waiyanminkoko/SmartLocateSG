import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Pencil, Plus, Save, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockProfiles, BusinessProfile, CandidateSite } from "@/lib/mock-data";
import { fetchJsonWithCache, invalidateApiCache, writeApiCache } from "@/lib/api-cache";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { useAuth } from "@/context/auth-context";

const PROFILES_CACHE_TTL_MS = 2 * 60 * 1000;
const SITES_CACHE_TTL_MS = 60 * 1000;

const sectors = [
  "Food & beverage",
  "Retail & e-commerce",
  "Professional services",
  "Education & training",
  "Health & wellness",
  "Beauty & personal care",
  "Home services",
  "Automotive",
  "Technology & electronics",
  "Travel & hospitality",
  "Arts & creative",
  "Pet services",
  "Financial services",
  "Entertainment & leisure",
  "Supermarket/Retail",
  "Showrooms",
  "Others",
];

const ageGroups = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

const incomeBands = [
  { label: "Low <S$3,000", value: "low" },
  { label: "Lower-Middle S$3,000-S$5,000", value: "lower-middle" },
  { label: "Middle S$5,000-S$8,000", value: "middle" },
  { label: "Upper-Middle S$8,000-S$12,000", value: "upper-middle" },
  { label: "High >S$12,000", value: "high" },
];

const stepTitles = ["Basics", "Target Customers", "Operating Model", "Review & Save"];

type EditWizardFormValues = {
  name: string;
  sector: string;
  customSector: string;
  priceMin: string;
  priceMax: string;
  ageGroups: string[];
  incomeBands: string[];
  operatingModel: string;
};

export default function Profiles() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editStep, setEditStep] = useState(1);

  const editForm = useForm<EditWizardFormValues>({
    defaultValues: {
      name: "",
      sector: "",
      customSector: "",
      priceMin: "",
      priceMax: "",
      ageGroups: [] as string[],
      incomeBands: [] as string[],
      operatingModel: "Mixed",
    },
  });

  const [profiles, setProfiles] = useLocalStorageState<BusinessProfile[]>(
    "smartlocate:profiles",
    [],
  );
  const [, setSites] = useLocalStorageState<CandidateSite[]>("smartlocate:sites", []);

  /*
  Legacy localStorage-only bootstrap (pre-API wiring)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("smartlocate:profiles");
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as BusinessProfile[];
      if (Array.isArray(stored) && stored.length !== profiles.length) {
        setProfiles(stored);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);
  */

  useEffect(() => {
    let cancelled = false;

    const fetchProfiles = async () => {
      if (authLoading || !userId) {
        return;
      }

      let forceRefresh = false;
      if (typeof window !== "undefined") {
        const refreshKey = `smartlocate:profiles:refresh:${userId}`;
        forceRefresh = window.sessionStorage.getItem(refreshKey) === "1";
        if (forceRefresh) {
          window.sessionStorage.removeItem(refreshKey);
        }
      }

      try {
        const rows = await fetchJsonWithCache<
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
          { ttlMs: PROFILES_CACHE_TTL_MS, forceRefresh },
        );

        const mapped: BusinessProfile[] = rows.map((row) => ({
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

        if (!cancelled) {
          setProfiles(mapped);
        }
      } catch {
        if (!cancelled) {
          setProfiles(mockProfiles);
          toast({
            title: "Profile API unavailable",
            description: "Showing local prototype profiles.",
            variant: "destructive",
          });
        }
      }
    };

    fetchProfiles();

    return () => {
      cancelled = true;
    };
  }, [setProfiles, toast, userId, authLoading]);

  const safeProfiles = useMemo(
    () =>
      profiles.map((p) => ({
        ...p,
        incomeBands: p.incomeBands ?? [],
      })),
    [profiles],
  );

  const activeId = useMemo(() => safeProfiles.find((p) => p.active)?.id, [safeProfiles]);

  const setActive = async (id: string) => {
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(id)}/activate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error("failed");
      }

      setProfiles((prev) => {
        const next = prev.map((p) => ({ ...p, active: p.id === id }));
        writeApiCache(`profiles:${userId}`, next, PROFILES_CACHE_TTL_MS);
        return next;
      });
      toast({ title: "Active profile updated", description: "Scoring will use this profile." });
    } catch {
      toast({
        title: "Failed to set active profile",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  /*
  Legacy local-only active profile behavior
  const setActive = (id: string) => {
    setProfiles((prev) => prev.map((p) => ({ ...p, active: p.id === id })));
    toast({ title: "Active profile updated", description: "Scoring will use this profile." });
  };
  */

  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("failed");
      }

      setProfiles((prev) => {
        const next = prev.filter((p) => p.id !== id);
        writeApiCache(`profiles:${userId}`, next, PROFILES_CACHE_TTL_MS);
        return next;
      });
      setSites((prev) => {
        const next = prev.filter((site) => site.profileId !== id);
        writeApiCache(`sites:${userId}`, next, SITES_CACHE_TTL_MS);
        return next;
      });
      invalidateApiCache(`sites:${userId}`);
      toast({ title: "Profile deleted", description: "Linked sites were removed from the database." });
    } catch {
      toast({
        title: "Failed to delete profile",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  /*
  Legacy local-only delete behavior
  const remove = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Profile deleted (prototype)" });
  };
  */

  const parsePriceBand = (priceBand: string) => {
    const match = priceBand.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) {
      return { min: "", max: "" };
    }

    return {
      min: match[1],
      max: match[2],
    };
  };

  const mapIncomeLabelToValue = (label: string) => {
    const normalized = label.toLowerCase().replace(/[^a-z]/g, "");
    const lookup: Record<string, string> = {
      low: "low",
      lowermiddle: "lower-middle",
      middle: "middle",
      uppermiddle: "upper-middle",
      high: "high",
    };

    return lookup[normalized];
  };

  const getResolvedSectorValue = () => {
    const { sector, customSector } = editForm.getValues();
    if (sector !== "Others") {
      return sector;
    }

    return customSector.trim();
  };

  const validateSector = () => {
    const resolvedSector = getResolvedSectorValue();
    if (!resolvedSector) {
      editForm.setError("customSector", { message: "Please enter your sector." });
      return "";
    }

    editForm.clearErrors("customSector");
    return resolvedSector;
  };

  const buildPriceBand = () => {
    const { priceMin, priceMax } = editForm.getValues();
    const trimmedMin = priceMin.trim();
    const trimmedMax = priceMax.trim();

    if (!/^\d+$/.test(trimmedMin)) {
      editForm.setError("priceMin", { message: "Lowest value must be a valid number." });
      return null;
    }

    const parsedMin = Number(trimmedMin);
    if (parsedMin < 1) {
      editForm.setError("priceMin", { message: "Lowest value must be at least 1." });
      return null;
    }

    if (!/^\d+$/.test(trimmedMax)) {
      editForm.setError("priceMax", { message: "Highest value must be a valid number." });
      return null;
    }

    const parsedMax = Number(trimmedMax);
    if (parsedMax < parsedMin) {
      editForm.setError("priceMax", { message: "Highest value must be greater than or equal to lowest value." });
      return null;
    }

    editForm.clearErrors("priceMin");
    editForm.clearErrors("priceMax");
    return `${parsedMin}-${parsedMax}`;
  };

  const getPriceBandPreview = () => {
    const { priceMin, priceMax } = editForm.getValues();
    const trimmedMin = priceMin.trim();
    const trimmedMax = priceMax.trim();

    if (!/^\d+$/.test(trimmedMin) || !/^\d+$/.test(trimmedMax)) {
      return null;
    }

    const parsedMin = Number(trimmedMin);
    const parsedMax = Number(trimmedMax);

    if (parsedMin < 1 || parsedMax < parsedMin) {
      return null;
    }

    return `${parsedMin}-${parsedMax}`;
  };

  const openEdit = (profile: BusinessProfile) => {
    const parsedPriceBand = parsePriceBand(profile.priceBand);
    const sectorInList = sectors.includes(profile.sector);
    const mappedIncomeBands = profile.incomeBands
      .map((label) => mapIncomeLabelToValue(label))
      .filter((value): value is string => Boolean(value));

    editForm.reset({
      name: profile.name,
      sector: sectorInList ? profile.sector : "Others",
      customSector: sectorInList ? "" : profile.sector,
      priceMin: parsedPriceBand.min,
      priceMax: parsedPriceBand.max,
      ageGroups: profile.ageGroups,
      incomeBands: mappedIncomeBands,
      operatingModel: profile.operatingModel,
    });

    setEditingProfileId(profile.id);
    setEditStep(1);
  };

  const nextEdit = () => {
    if (editStep === 1) {
      const { name } = editForm.getValues();
      const resolvedSector = validateSector();
      const computedPriceBand = buildPriceBand();

      if (!name || !resolvedSector || !computedPriceBand) {
        toast({
          title: "Complete the basics",
          description: "Add a name, sector, and valid numeric price range to continue.",
          variant: "destructive",
        });
        return;
      }
    }

    if (editStep === 2) {
      const { ageGroups: selectedAges, incomeBands: selectedIncomeBands } = editForm.getValues();
      if (selectedAges.length === 0 || selectedIncomeBands.length === 0) {
        toast({
          title: "Select target customers",
          description: "Choose at least one age group and one income band.",
          variant: "destructive",
        });
        return;
      }
    }

    setEditStep((prev) => Math.min(prev + 1, 4));
  };

  const backEdit = () => {
    setEditStep((prev) => Math.max(prev - 1, 1));
  };

  const cancelEdit = () => {
    setEditingProfileId(null);
    setEditStep(1);
  };

  const saveEdit = editForm.handleSubmit(async (data) => {
    if (!editingProfileId) {
      return;
    }

    if (editStep < 4) {
      toast({
        title: "Complete all steps",
        description: "Profile updates are saved only after clicking Save Changes on the final step.",
        variant: "destructive",
      });
      return;
    }

    const computedPriceBand = buildPriceBand();
    const resolvedSector = validateSector();
    if (!computedPriceBand) {
      toast({
        title: "Invalid price range",
        description: "Check lowest and highest values before saving.",
        variant: "destructive",
      });
      return;
    }

    if (!resolvedSector) {
      toast({
        title: "Invalid sector",
        description: "Select a sector or provide one under Others.",
        variant: "destructive",
      });
      return;
    }

    const incomeLabels = data.incomeBands.map((band) => {
      const entry = incomeBands.find((i) => i.value === band);
      if (!entry) {
        return band;
      }
      return entry.label.split(" ")[0];
    });

    try {
      const response = await fetch(
        `/api/profiles/${encodeURIComponent(editingProfileId)}?userId=${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: data.name,
            sector: resolvedSector,
            priceBand: computedPriceBand,
            ageGroups: data.ageGroups,
            incomeBands: incomeLabels,
            operatingModel: data.operatingModel,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("failed");
      }

      const row = (await response.json()) as {
        id: string;
        name: string;
        sector: string;
        priceBand: string;
        ageGroups: string[];
        incomeBands: string[];
        operatingModel: string;
        active: boolean;
        updatedAt: string;
      };

      const updatedAt = new Date(row.updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      setProfiles((prev) =>
        {
          const next = prev.map((profile) =>
          profile.id === row.id
            ? {
                ...profile,
                name: row.name,
                sector: row.sector,
                priceBand: row.priceBand,
                ageGroups: row.ageGroups,
                incomeBands: row.incomeBands,
                operatingModel: row.operatingModel,
                updatedAt,
              }
            : profile,
          );
          writeApiCache(`profiles:${userId}`, next, PROFILES_CACHE_TTL_MS);
          return next;
        },
      );

      setEditingProfileId(null);
      setEditStep(1);
      toast({ title: "Profile updated", description: "Changes were saved to the database." });
    } catch {
      toast({
        title: "Failed to update profile",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  });

  return (
    <AppShell
      title="Business Profiles"
      right={
        <Link href="/profiles/new">
          <Button className="gap-2" data-testid="button-create-profile-top">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Profile
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-profiles-title">Business Profiles</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-profiles-subtitle">
            Manage your business profiles for location scoring.
          </p>
        </div>

        {safeProfiles.length === 0 ? (
          <Card className="border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground" data-testid="empty-profiles-text">
              No profiles yet. Create your first business profile to start scoring.
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {safeProfiles.map((p) => (
              <Card key={p.id} className="border bg-card p-5 shadow-sm" data-testid={`card-profile-${p.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold" data-testid={`text-profile-title-${p.id}`}>{p.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-profile-sector-${p.id}`}>{p.sector}</div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(p)}
                    className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    data-testid={`button-edit-profile-${p.id}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        data-testid={`button-delete-profile-${p.id}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle data-testid="text-delete-title">Delete profile?</AlertDialogTitle>
                        <AlertDialogDescription data-testid="text-delete-desc">
                          This deletes the profile and linked candidate sites.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => remove(p.id)}
                          className="bg-red-600 hover:bg-red-700"
                          data-testid="button-confirm-delete"
                        >
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
                  <div className="flex items-center justify-between" data-testid={`row-income-${p.id}`}>
                    <span className="text-muted-foreground">Income</span>
                    <span className="font-medium" data-testid={`text-income-${p.id}`}>{p.incomeBands.join(", ")}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid={`row-operating-${p.id}`}>
                    <span className="text-muted-foreground">Reliance</span>
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

        {editingProfileId ? (
          <Card className="border bg-card p-6 shadow-sm">
            <form
              onSubmit={(event) => {
                event.preventDefault();
              }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Edit Profile</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Step {editStep} of 4: {stepTitles[editStep - 1]}
                  </p>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((value) => (
                    <div
                      key={value}
                      className={`h-1.5 w-8 rounded-full transition-colors ${
                        value <= editStep ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {editStep === 1 ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Profile Name</Label>
                    <Input
                      id="edit-name"
                      placeholder="e.g. Downtown Cafe"
                      {...editForm.register("name", { required: true })}
                      data-testid="input-edit-profile-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sector</Label>
                    <Select
                      onValueChange={(value) => editForm.setValue("sector", value)}
                      value={editForm.watch("sector")}
                    >
                      <SelectTrigger data-testid="select-edit-sector">
                        <SelectValue placeholder="Select sector" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((sector) => (
                          <SelectItem key={sector} value={sector}>
                            {sector}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editForm.watch("sector") === "Others" ? (
                      <>
                        <Input
                          type="text"
                          placeholder="Type your sector"
                          {...editForm.register("customSector")}
                          data-testid="input-edit-custom-sector"
                        />
                        {editForm.formState.errors.customSector ? (
                          <p className="text-xs text-destructive" data-testid="text-edit-custom-sector-error">
                            {editForm.formState.errors.customSector.message}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Price Band (S$)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="(Min $1)"
                        {...editForm.register("priceMin")}
                        data-testid="input-edit-price-min"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="(empty)"
                        {...editForm.register("priceMax")}
                        data-testid="input-edit-price-max"
                      />
                    </div>
                    {editForm.formState.errors.priceMin ? (
                      <p className="text-xs text-destructive" data-testid="text-edit-price-min-error">
                        {editForm.formState.errors.priceMin.message}
                      </p>
                    ) : null}
                    {editForm.formState.errors.priceMax ? (
                      <p className="text-xs text-destructive" data-testid="text-edit-price-max-error">
                        {editForm.formState.errors.priceMax.message}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Enter numbers only. Saved format: lowest-highest.
                    </p>
                  </div>
                </div>
              ) : null}

              {editStep === 2 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Target Age Groups</Label>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={editForm.watch("ageGroups").length === ageGroups.length}
                          onCheckedChange={(checked) => {
                            editForm.setValue("ageGroups", checked === true ? [...ageGroups] : []);
                          }}
                          data-testid="checkbox-edit-age-select-all"
                        />
                        Select All
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ageGroups.map((age) => (
                        <label
                          key={age}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={editForm.watch("ageGroups").includes(age)}
                            onCheckedChange={(checked) => {
                              const current = editForm.getValues("ageGroups");
                              editForm.setValue(
                                "ageGroups",
                                checked ? [...current, age] : current.filter((entry) => entry !== age),
                              );
                            }}
                            data-testid={`checkbox-edit-age-${age}`}
                          />
                          {age}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Income Bands</Label>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={editForm.watch("incomeBands").length === incomeBands.length}
                          onCheckedChange={(checked) => {
                            editForm.setValue(
                              "incomeBands",
                              checked === true ? incomeBands.map((band) => band.value) : [],
                            );
                          }}
                          data-testid="checkbox-edit-income-select-all"
                        />
                        Select All
                      </label>
                    </div>
                    <div className="space-y-2">
                      {incomeBands.map((band) => (
                        <label
                          key={band.value}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={editForm.watch("incomeBands").includes(band.value)}
                            onCheckedChange={(checked) => {
                              const current = editForm.getValues("incomeBands");
                              editForm.setValue(
                                "incomeBands",
                                checked
                                  ? [...current, band.value]
                                  : current.filter((entry) => entry !== band.value),
                              );
                            }}
                            data-testid={`checkbox-edit-income-${band.value}`}
                          />
                          {band.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {editStep === 3 ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-3">
                    <Label>Operating Model</Label>
                    <RadioGroup
                      defaultValue={editForm.getValues("operatingModel")}
                      onValueChange={(value) => editForm.setValue("operatingModel", value)}
                      className="grid gap-3"
                      data-testid="radio-edit-operating-model"
                    >
                      {["Mixed", "Walk-in focused", "Delivery focused"].map((model) => (
                        <label
                          key={model}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
                        >
                          <RadioGroupItem value={model} />
                          <div className="text-sm font-medium">{model}</div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              ) : null}

              {editStep === 4 ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Review summary</div>
                    <div className="text-xs text-muted-foreground">
                      Confirm the profile details before saving.
                    </div>
                  </div>
                  <div className="rounded-xl border bg-card p-4 text-sm">
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium">{editForm.getValues("name") || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Sector</span>
                        <span className="font-medium">{getResolvedSectorValue() || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Price band</span>
                        <span className="font-medium">{getPriceBandPreview() ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Age groups</span>
                        <span className="font-medium">
                          {editForm.getValues("ageGroups").length > 0
                            ? editForm.getValues("ageGroups").join(", ")
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Income bands</span>
                        <span className="font-medium">
                          {editForm.getValues("incomeBands").length > 0
                            ? editForm.getValues("incomeBands")
                                .map((band) => {
                                  const labels: Record<string, string> = {
                                    low: "Low",
                                    "lower-middle": "Lower-Middle",
                                    middle: "Middle",
                                    "upper-middle": "Upper-Middle",
                                    high: "High",
                                  };
                                  return labels[band] ?? band;
                                })
                                .join(", ")
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Reliance</span>
                        <span className="font-medium">{editForm.getValues("operatingModel")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    You can go back to edit any step before saving.
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between border-t pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={backEdit}
                  disabled={editStep === 1}
                  data-testid="button-edit-wizard-back"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  {editStep < 4 ? (
                    <Button type="button" onClick={nextEdit} data-testid="button-edit-wizard-next">
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        void saveEdit();
                      }}
                      data-testid="button-edit-wizard-save"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
