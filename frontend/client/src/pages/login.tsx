import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BarChart3, MapPinned, Sparkles } from "lucide-react";

import { useAuth } from "@/context/auth-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

type LoginValues = {
  email: string;
  password: string;
};

const authHighlights = [
  {
    title: "Score faster",
    description: "Jump back into saved profiles, map scoring, and comparison without rebuilding context.",
    icon: BarChart3,
  },
  {
    title: "Map with context",
    description: "Review demand, transport access, rental pressure, and competition in one workspace.",
    icon: MapPinned,
  },
  {
    title: "Explain decisions",
    description: "Turn scores into readable reasoning for teammates and stakeholders.",
    icon: Sparkles,
  },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { user, loading } = useAuth();
  const brandLogoSrc = "/SmartLocateSG_Logo.png";

  const form = useForm<LoginValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  if (!loading && user) {
    setLocation("/dashboard");
    return null;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setLocation("/dashboard");
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
                <div className="text-xs text-muted-foreground">Singapore site selection intelligence</div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="auth-badge">Workspace access</div>
              <h1 className="workspace-display text-5xl leading-none text-balance">
                Continue the site shortlist with the same visual language as the front page.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[hsl(var(--foreground)/0.74)]">
                Sign in to review business profiles, test candidate sites, and keep your portfolio of locations in
                one branded workspace.
              </p>
            </div>

            <div className="auth-feature-list">
              {authHighlights.map(({ title, description, icon: Icon }) => (
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
            <div className="workspace-kicker">Why teams use it</div>
            <p className="mt-3 text-sm leading-6 text-[hsl(var(--foreground)/0.76)]">
              Compare neighborhoods, explain trade-offs clearly, and preserve decisions in a format the next review
              session can pick up immediately.
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
                <div className="text-xs text-muted-foreground">Workspace access</div>
              </div>
            </div>
            <div className="text-sm leading-6 text-muted-foreground">
              Return to your profiles, map, and comparison workflow.
            </div>
          </div>

          <Card className="auth-form-card">
            <div className="space-y-2">
              <div className="workspace-kicker">Log in</div>
              <h1 className="workspace-display text-3xl" data-testid="text-login-title">
                Welcome back
              </h1>
              <p className="text-sm leading-6 text-muted-foreground" data-testid="text-login-subtitle">
                Authenticate quickly and continue to your dashboard.
              </p>
            </div>

            <form className="mt-6 space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" data-testid="label-email">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="bg-[hsl(var(--card)/0.7)]"
                  {...form.register("email", { required: true })}
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password" data-testid="label-password">
                    Password
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-2 py-1 text-xs text-primary"
                    disabled={resetting}
                    onClick={async () => {
                      const email = form.getValues("email");
                      if (!email) {
                        toast({
                          title: "Enter your email first",
                          description: "Fill in your email address above, then click Forgot?",
                          variant: "destructive",
                        });
                        return;
                      }
                      setResetting(true);
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      setResetting(false);
                      if (error) {
                        toast({ title: "Reset failed", description: error.message, variant: "destructive" });
                      } else {
                        toast({ title: "Reset email sent", description: "Check your inbox for a password reset link." });
                      }
                    }}
                    data-testid="button-forgot-password"
                  >
                    {resetting ? "Sending..." : "Forgot?"}
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="bg-[hsl(var(--card)/0.7)]"
                  {...form.register("password", { required: true })}
                  data-testid="input-password"
                />
                <p className="text-xs text-muted-foreground" data-testid="text-login-hint">
                  Use the email and password you registered with.
                </p>
              </div>

              <Button
                type="submit"
                className="workspace-pill-button w-full"
                disabled={submitting}
                data-testid="button-submit-login"
              >
                {submitting ? "Logging in..." : "Log In"}
              </Button>
            </form>

            <div className="mt-6 border-t border-[hsl(var(--card-border)/0.7)] pt-5 text-sm text-muted-foreground" data-testid="text-login-footer">
              New here?{" "}
              <Link href="/register" className="font-medium text-foreground underline underline-offset-4" data-testid="link-register">
                Create an account
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
