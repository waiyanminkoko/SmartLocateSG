import { Link, useLocation } from "wouter";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

type RegisterValues = {
  email: string;
  password: string;
  confirmPassword: string;
  userType: "SME" | "MNC" | "Agent";
  agree: boolean;
};

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<RegisterValues>({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      userType: "SME",
      agree: false,
    },
  });

  const passwordRules = useMemo(
    () => "Use 8+ characters. In the real app, we’d enforce strength rules.",
    [],
  );

  const onSubmit = form.handleSubmit((values) => {
    if (values.password !== values.confirmPassword) {
      toast({
        title: "Passwords don’t match",
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

    toast({
      title: "Account created (prototype)",
      description: "Success! Redirecting to dashboard…",
    });

    setLocation("/dashboard");
  });

  return (
    <div className="app-shell">
      <main className="mx-auto grid min-h-[100dvh] w-full max-w-6xl place-items-center px-4 py-10">
        <Card className="w-full max-w-lg border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold" data-testid="text-register-title">
              Register
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-register-subtitle">
              Create an account with minimal friction.
            </p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
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
                  placeholder="••••••••"
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
                  placeholder="••••••••"
                  {...form.register("confirmPassword", { required: true })}
                  data-testid="input-register-confirm"
                />
                <p className="text-xs text-muted-foreground" data-testid="text-privacy-note">
                  We respect your privacy. This is a prototype UI only.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium" data-testid="text-user-type-label">
                User type
              </div>
              <RadioGroup
                defaultValue={form.getValues("userType")}
                onValueChange={(v) => form.setValue("userType", v as RegisterValues["userType"]) }
                className="grid gap-2 md:grid-cols-3"
                data-testid="radio-user-type"
              >
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <RadioGroupItem value="SME" data-testid="radio-sme" />
                  <span className="text-sm">SME</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <RadioGroupItem value="MNC" data-testid="radio-mnc" />
                  <span className="text-sm">MNC</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <RadioGroupItem value="Agent" data-testid="radio-agent" />
                  <span className="text-sm">Agent</span>
                </label>
              </RadioGroup>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
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
                  By continuing, you agree to the Terms. (Prototype text)
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" data-testid="button-submit-register">
              Create account
            </Button>
          </form>

          <div className="mt-5 text-sm text-muted-foreground" data-testid="text-register-footer">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground underline underline-offset-4" data-testid="link-login">
              Log in
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
