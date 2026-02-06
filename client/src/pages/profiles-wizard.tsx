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

const sectors = [
  "Professional services",
  "Education & training",
  "Health & wellness",
  "Beauty & personal care",
  "Entertainment & leisure",
  "Supermarket/Retail",
  "Showrooms",
];

const priceBands = [
  "$1-$20",
  "$21-$50",
  "$51-$100",
  "$100-$500",
  "$500-$1000",
  "$1000+",
];

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

  const form = useForm({
    defaultValues: {
      name: "",
      sector: "",
      priceBand: "",
      ageGroups: [] as string[],
      incomeBands: [] as string[],
      operatingModel: "Mixed",
    },
  });

  const next = () => {
    if (step === 1) {
      const { name, sector, priceBand } = form.getValues();
      if (!name || !sector || !priceBand) {
        toast({
          title: "Complete the basics",
          description: "Add a name, sector, and price band to continue.",
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

  const onSubmit = form.handleSubmit((data) => {
    toast({
      title: "Profile created",
      description: `${data.name} has been added to your profiles.`,
    });
    setLocation("/profiles");
  });

  const stepTitles = ["Basics", "Target Customers", "Operating Model", "Review & Save"];

  return (
    <AppShell title="Create Profile">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-wizard-title">
              Business Profile Wizard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-wizard-subtitle">
              Step {step} of 4: {stepTitles[step - 1]}
            </p>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <Card className="border bg-card p-6 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-6">
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
                    defaultValue={form.getValues("sector")}
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
                </div>
                <div className="space-y-2">
                  <Label>Price Band</Label>
                  <Select
                    onValueChange={(v) => form.setValue("priceBand", v)}
                    defaultValue={form.getValues("priceBand")}
                  >
                    <SelectTrigger data-testid="select-price-band">
                      <SelectValue placeholder="Select price band" />
                    </SelectTrigger>
                    <SelectContent>
                      {priceBands.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-3">
                  <Label>Target Age Groups</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ageGroups.map((age) => (
                      <label
                        key={age}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
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
                  <Label>Income Bands</Label>
                  <div className="space-y-2">
                    {incomeBands.map((band) => (
                      <label
                        key={band.value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
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
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
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
                  <div className="text-sm font-semibold">Review summary</div>
                  <div className="text-xs text-muted-foreground">
                    Confirm the profile details before saving.
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4 text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{form.getValues("name") || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Sector</span>
                      <span className="font-medium">{form.getValues("sector") || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Price band</span>
                      <span className="font-medium">{form.getValues("priceBand") || "—"}</span>
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
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                  You can go back to edit any step before saving.
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
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
                <Button type="submit" data-testid="button-wizard-save">
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
