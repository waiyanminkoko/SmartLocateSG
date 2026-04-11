import { Link, useLocation } from "wouter";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Building2, Sparkles, Store, Users2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

type RegisterValues = {
  email: string;
  password: string;
  confirmPassword: string;
  userType: "SME" | "MNC" | "Agent";
  agree: boolean;
};

const audienceCards = [
  {
    title: "SMEs",
    description: "Build a shortlist quickly when every location decision affects budget and runway.",
    icon: Store,
  },
  {
    title: "Expansion teams",
    description: "Keep site scoring and comparison consistent across multiple candidate neighborhoods.",
    icon: Building2,
  },
  {
    title: "Commercial agents",
    description: "Support client recommendations with clearer evidence and reusable score narratives.",
    icon: Users2,
  },
];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const brandLogoSrc = "/SmartLocateSG_Logo.png";

  const form = useForm<RegisterValues>({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      userType: "SME",
      agree: false,
    },
  });

  const passwordRules = useMemo(() => "Use 8+ characters.", []);

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.password !== values.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please re-enter your password confirmation.",
        variant: "destructive",
      });
      return;
    }

    if (!values.agree) {
      toast({
        title: "Please accept the Terms",
        description: "You must agree to continue.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { user_type: values.userType },
      },
    });
    setSubmitting(false);

    if (error) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Account created!",
      description: "Check your email to confirm your account, then log in.",
    });

    setLocation("/login");
  });

  return (
    <div className="auth-page">
      <main className="auth-shell">
        <section className="auth-brand-panel">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="workspace-brand-mark size-14">
                <img src={brandLogoSrc} alt="SmartLocate SG logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.1em] text-[hsl(var(--foreground)/0.72)]">
                  SmartLocate SG
                </div>
                <div className="text-xs text-muted-foreground">Create your workspace account</div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="auth-badge">Account setup</div>
              <h1 className="workspace-display text-5xl leading-none text-balance">
                Start with the same front-page aesthetic, then carry it through every workflow.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[hsl(var(--foreground)/0.74)]">
                Register once to build profiles, score candidate sites, compare options, and keep your decision trail in
                one place.
              </p>
            </div>

            <div className="space-y-4">
              {audienceCards.map(({ title, description, icon: Icon }) => (
                <div key={title} className="auth-feature-card">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.86)] bg-[hsl(var(--card)/0.82)]">
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                    <div className="text-sm font-semibold">{title}</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="workspace-panel-muted">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-4 w-4 text-[hsl(var(--landing-orange))]" aria-hidden="true" />
              Ready for onboarding
            </div>
            <p className="mt-3 text-sm leading-6 text-[hsl(var(--foreground)/0.76)]">
              The first pass keeps account setup lightweight so teams can get straight to map scoring and comparison.
            </p>
          </div>
        </section>

        <section className="auth-form-shell">
          <div className="auth-mobile-brand">
            <div className="flex items-center gap-3">
              <div className="workspace-brand-mark size-12">
                <img src={brandLogoSrc} alt="SmartLocate SG logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.08em]">SmartLocate SG</div>
                <div className="text-xs text-muted-foreground">Create your workspace account</div>
              </div>
            </div>
            <div className="text-sm leading-6 text-muted-foreground">
              Set up access for profiles, map scoring, portfolio tracking, and comparison.
            </div>
          </div>

          <Card className="auth-form-card">
            <div className="space-y-2">
              <div className="workspace-kicker">Register</div>
              <h1 className="workspace-display text-3xl" data-testid="text-register-title">
                Create your account
              </h1>
              <p className="text-sm leading-6 text-muted-foreground" data-testid="text-register-subtitle">
                Create an account with minimal friction.
              </p>
            </div>

            <form className="mt-6 space-y-5" onSubmit={onSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email" data-testid="label-register-email">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="bg-[hsl(var(--card)/0.7)]"
                    {...form.register("email", { required: true })}
                    data-testid="input-register-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" data-testid="label-register-password">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Create a password"
                    className="bg-[hsl(var(--card)/0.7)]"
                    {...form.register("password", { required: true })}
                    data-testid="input-register-password"
                  />
                  <p className="text-xs text-muted-foreground" data-testid="text-password-rules">
                    {passwordRules}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" data-testid="label-register-confirm">
                    Confirm
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    className="bg-[hsl(var(--card)/0.7)]"
                    {...form.register("confirmPassword", { required: true })}
                    data-testid="input-register-confirm"
                  />
                  <p className="text-xs text-muted-foreground" data-testid="text-privacy-note">
                    We respect your privacy and only use your details for account access.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium" data-testid="text-user-type-label">
                  User type
                </div>
                <RadioGroup
                  defaultValue={form.getValues("userType")}
                  onValueChange={(v) => form.setValue("userType", v as RegisterValues["userType"])}
                  className="grid gap-3 md:grid-cols-3"
                  data-testid="radio-user-type"
                >
                  <label className="workspace-panel-muted flex cursor-pointer items-center gap-2 p-3">
                    <RadioGroupItem value="SME" data-testid="radio-sme" />
                    <span className="text-sm">SME</span>
                  </label>
                  <label className="workspace-panel-muted flex cursor-pointer items-center gap-2 p-3">
                    <RadioGroupItem value="MNC" data-testid="radio-mnc" />
                    <span className="text-sm">MNC</span>
                  </label>
                  <label className="workspace-panel-muted flex cursor-pointer items-center gap-2 p-3">
                    <RadioGroupItem value="Agent" data-testid="radio-agent" />
                    <span className="text-sm">Agent</span>
                  </label>
                </RadioGroup>
              </div>

              <div className="workspace-panel-muted flex items-start gap-3">
                <Checkbox
                  checked={form.watch("agree")}
                  onCheckedChange={(v) => form.setValue("agree", Boolean(v))}
                  data-testid="checkbox-terms"
                />
                <div className="space-y-1">
                  <div className="text-sm" data-testid="text-terms-title">
                    Terms of Service
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-terms-copy">
                    By continuing, you agree to the Terms of Service.
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="workspace-pill-button w-full"
                disabled={submitting}
                data-testid="button-submit-register"
              >
                {submitting ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <div className="mt-6 border-t border-[hsl(var(--card-border)/0.7)] pt-5 text-sm text-muted-foreground" data-testid="text-register-footer">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-foreground underline underline-offset-4" data-testid="link-login">
                Log in
              </Link>
            </div>
          </Card>

          <div className="px-2 text-center text-sm text-muted-foreground">
            <Link href="/" className="underline underline-offset-4">
              Return to the front page
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
