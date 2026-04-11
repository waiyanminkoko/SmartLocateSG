import { useState } from "react";
import { useForm } from "react-hook-form";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { mockProfiles, type BusinessProfile } from "@/lib/mock-data";
import { writeApiCache } from "@/lib/api-cache";
import { useAuth } from "@/context/auth-context";

const PROFILES_CACHE_TTL_MS = 2 * 60 * 1000;

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

type ProfileWizardFormValues = {
  name: string;
  sector: string;
  customSector: string;
  priceMin: string;
  priceMax: string;
  ageGroups: string[];
  incomeBands: string[];
  operatingModel: string;
};

const ageGroups = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

const incomeBands = [
  { label: "Low <S$3,000", value: "low" },
  { label: "Lower-Middle S$3,000-S$5,000", value: "lower-middle" },
  { label: "Middle S$5,000-S$8,000", value: "middle" },
  { label: "Upper-Middle S$8,000-S$12,000", value: "upper-middle" },
  { label: "High >S$12,000", value: "high" },
];

export default function ProfileWizard() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const [profiles, setProfiles] = useLocalStorageState<BusinessProfile[]>(
    "smartlocate:profiles",
    mockProfiles,
  );

  const form = useForm<ProfileWizardFormValues>({
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

  const getResolvedSectorValue = () => {
    const { sector, customSector } = form.getValues();
    if (sector !== "Others") {
      return sector;
    }

    return customSector.trim();
  };

  const validateSector = () => {
    const resolvedSector = getResolvedSectorValue();
    if (!resolvedSector) {
      form.setError("customSector", { message: "Please enter your sector." });
      return "";
    }

    form.clearErrors("customSector");
    return resolvedSector;
  };

  const buildPriceBand = () => {
    const { priceMin, priceMax } = form.getValues();
    const trimmedMin = priceMin.trim();
    const trimmedMax = priceMax.trim();

    if (!/^\d+$/.test(trimmedMin)) {
      form.setError("priceMin", { message: "Lowest value must be a valid number." });
      return null;
    }

    const parsedMin = Number(trimmedMin);
    if (parsedMin < 1) {
      form.setError("priceMin", { message: "Lowest value must be at least 1." });
      return null;
    }

    if (!/^\d+$/.test(trimmedMax)) {
      form.setError("priceMax", { message: "Highest value must be a valid number." });
      return null;
    }

    const parsedMax = Number(trimmedMax);
    if (parsedMax < parsedMin) {
      form.setError("priceMax", { message: "Highest value must be greater than or equal to lowest value." });
      return null;
    }

    form.clearErrors("priceMin");
    form.clearErrors("priceMax");
    return `${parsedMin}-${parsedMax}`;
  };

  const getPriceBandPreview = () => {
    const { priceMin, priceMax } = form.getValues();
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

  const next = () => {
    if (step === 1) {
      const { name } = form.getValues();
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

    if (step === 2) {
      const { ageGroups, incomeBands } = form.getValues();
      if (ageGroups.length === 0 || incomeBands.length === 0) {
        toast({
          title: "Select target customers",
          description: "Choose at least one age group and one income band.",
          variant: "destructive",
        });
        return;
      }
    }

    setStep((s) => Math.min(s + 1, 4));
  };
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const onSubmit = form.handleSubmit(async (data) => {
    if (step < 4) {
      toast({
        title: "Complete all steps",
        description: "Profile is saved only after clicking Save Profile on the final step.",
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
      if (!entry) return band;
      return entry.label.split(" ")[0];
    });

    if (authLoading || !userId) {
      toast({
        title: "Please wait",
        description: "Authentication is still loading. Try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          name: data.name,
          sector: resolvedSector,
          priceBand: computedPriceBand,
          ageGroups: data.ageGroups,
          incomeBands: incomeLabels,
          operatingModel: data.operatingModel,
        }),
      });

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

      const mapped: BusinessProfile = {
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
      };

      const nextProfiles = [
        mapped,
        ...profiles
          .filter((profile) => profile.id !== mapped.id)
          .map((profile) => ({ ...profile, active: false })),
      ];

      // Persist immediately so route changes do not drop this update.
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("smartlocate:profiles", JSON.stringify(nextProfiles));
          window.sessionStorage.setItem(`smartlocate:profiles:refresh:${userId}`, "1");
        } catch {
          // Ignore storage errors and rely on in-memory state.
        }
      }

      writeApiCache(`profiles:${userId}`, nextProfiles, PROFILES_CACHE_TTL_MS);
      setProfiles(nextProfiles);
      toast({
        title: "Profile created",
        description: `${data.name} has been added to your profiles.`,
      });
      setLocation("/profiles");
    } catch {
      toast({
        title: "Unable to save profile",
        description: "Please check server setup and try again.",
        variant: "destructive",
      });
    }
  });

  /*
  Legacy local-only save flow (pre-API wiring)
  const onSubmit = form.handleSubmit((data) => {
    const incomeLabels = data.incomeBands.map((band) => {
      const entry = incomeBands.find((i) => i.value === band);
      if (!entry) return band;
      return entry.label.split(" ")[0];
    });

    const updatedAt = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const newProfile: BusinessProfile = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: data.name,
      sector: data.sector,
      priceBand: data.priceBand,
      ageGroups: data.ageGroups,
      incomeBands: incomeLabels,
      operatingModel: data.operatingModel,
      updatedAt,
      active: true,
    };

    setProfiles((prev) => [
      newProfile,
      ...prev.map((p) => ({ ...p, active: false })),
    ]);
    toast({
      title: "Profile created",
      description: `${data.name} has been added to your profiles.`,
    });
    setLocation("/profiles");
  });
  */

  const stepTitles = ["Basics", "Target Customers", "Operating Model", "Review & Save"];

  return (
    <AppShell title="Create Profile">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="workspace-page-header">
          <div className="workspace-page-header-grid">
            <div>
              <div className="workspace-kicker">Profile setup</div>
              <h1 className="workspace-page-title mt-4" data-testid="text-wizard-title">
                Business Profile Wizard
              </h1>
              <p className="workspace-page-lead" data-testid="text-wizard-subtitle">
                Step {step} of 4: {stepTitles[step - 1]}
              </p>
            </div>
            <div className="space-y-3">
              <div className="workspace-inline-stat">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current step</div>
                <div className="mt-2 text-lg font-semibold">{stepTitles[step - 1]}</div>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-2 w-10 rounded-full transition-colors ${
                      s <= step ? "bg-primary" : "bg-[hsl(var(--foreground)/0.1)]"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <Card className="workspace-surface rounded-[1.75rem] border p-6 shadow-none sm:p-7">
          <form
            onSubmit={(event) => {
              event.preventDefault();
            }}
            className="space-y-6"
          >
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Profile Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Downtown Cafe"
                    {...form.register("name", { required: true })}
                    data-testid="input-profile-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sector</Label>
                  <Select
                    onValueChange={(v) => form.setValue("sector", v)}
                    value={form.watch("sector")}
                  >
                    <SelectTrigger data-testid="select-sector">
                      <SelectValue placeholder="Select sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.watch("sector") === "Others" ? (
                    <>
                      <Input
                        type="text"
                        placeholder="Type your sector"
                        {...form.register("customSector")}
                        data-testid="input-custom-sector"
                      />
                      {form.formState.errors.customSector ? (
                        <p className="text-xs text-destructive" data-testid="text-custom-sector-error">
                          {form.formState.errors.customSector.message}
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
                      {...form.register("priceMin")}
                      data-testid="input-price-min"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder=""
                      {...form.register("priceMax")}
                      data-testid="input-price-max"
                    />
                  </div>
                  {form.formState.errors.priceMin ? (
                    <p className="text-xs text-destructive" data-testid="text-price-min-error">
                      {form.formState.errors.priceMin.message}
                    </p>
                  ) : null}
                  {form.formState.errors.priceMax ? (
                    <p className="text-xs text-destructive" data-testid="text-price-max-error">
                      {form.formState.errors.priceMax.message}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Enter numbers only. Saved format: lowest-highest.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Target Age Groups</Label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={form.watch("ageGroups").length === ageGroups.length}
                        onCheckedChange={(checked) => {
                          form.setValue("ageGroups", checked === true ? [...ageGroups] : []);
                        }}
                        data-testid="checkbox-age-select-all"
                      />
                      Select All
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ageGroups.map((age) => (
                      <label
                        key={age}
                        className="workspace-panel-muted flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={form.watch("ageGroups").includes(age)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues("ageGroups");
                            form.setValue(
                              "ageGroups",
                              checked ? [...current, age] : current.filter((a) => a !== age)
                            );
                          }}
                          data-testid={`checkbox-age-${age}`}
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
                        checked={form.watch("incomeBands").length === incomeBands.length}
                        onCheckedChange={(checked) => {
                          form.setValue(
                            "incomeBands",
                            checked === true ? incomeBands.map((band) => band.value) : [],
                          );
                        }}
                        data-testid="checkbox-income-select-all"
                      />
                      Select All
                    </label>
                  </div>
                  <div className="space-y-2">
                    {incomeBands.map((band) => (
                      <label
                        key={band.value}
                        className="workspace-panel-muted flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={form.watch("incomeBands").includes(band.value)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues("incomeBands");
                            form.setValue(
                              "incomeBands",
                              checked
                                ? [...current, band.value]
                                : current.filter((b) => b !== band.value)
                            );
                          }}
                          data-testid={`checkbox-income-${band.value}`}
                        />
                        {band.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-3">
                  <Label>Operating Model</Label>
                  <RadioGroup
                    defaultValue={form.getValues("operatingModel")}
                    onValueChange={(v) => form.setValue("operatingModel", v)}
                    className="grid gap-3"
                    data-testid="radio-operating-model"
                  >
                    {["Mixed", "Walk-in focused", "Delivery focused"].map((model) => (
                      <label
                        key={model}
                        className="workspace-panel-muted flex cursor-pointer items-center gap-3 p-4"
                      >
                        <RadioGroupItem value={model} />
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">{model}</div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-1">
                  <div className="workspace-kicker">Review summary</div>
                  <div className="text-xs text-muted-foreground">
                    Confirm the profile details before saving.
                  </div>
                </div>
                <div className="workspace-panel-muted text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{form.getValues("name") || "—"}</span>
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
                        {form.getValues("ageGroups").length > 0
                          ? form.getValues("ageGroups").join(", ")
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Income bands</span>
                      <span className="font-medium">
                        {form.getValues("incomeBands").length > 0
                          ? form.getValues("incomeBands").map((band) => {
                              const labels: Record<string, string> = {
                                low: "Low",
                                "lower-middle": "Lower-Middle",
                                middle: "Middle",
                                "upper-middle": "Upper-Middle",
                                high: "High",
                              };
                              return labels[band] ?? band;
                            }).join(", ")
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Reliance</span>
                      <span className="font-medium">{form.getValues("operatingModel")}</span>
                    </div>
                  </div>
                </div>
                <div className="workspace-panel-muted text-xs text-muted-foreground">
                  You can go back to edit any step before saving.
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[hsl(var(--card-border)/0.72)] pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={back}
                disabled={step === 1}
                data-testid="button-wizard-back"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={next} data-testid="button-wizard-next">
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    void onSubmit();
                  }}
                  data-testid="button-wizard-save"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
