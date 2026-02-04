import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type LoginValues = {
  email: string;
  password: string;
};

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(() => {
    toast({
      title: "Logged in (prototype)",
      description: "This is a UI-only mock. Redirecting to dashboard…",
    });
    setLocation("/dashboard");
  });

  return (
    <div className="app-shell">
      <main className="mx-auto grid min-h-[100dvh] w-full max-w-6xl place-items-center px-4 py-10">
        <Card className="w-full max-w-md border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold" data-testid="text-login-title">
              Log In
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-login-subtitle">
              Authenticate quickly and continue to your dashboard.
            </p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" data-testid="label-email">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...form.register("email", { required: true })}
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" data-testid="label-password">
                  Password
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={() =>
                    toast({
                      title: "Forgot password (prototype)",
                      description: "In a real app, you’d get a reset email.",
                    })
                  }
                  data-testid="button-forgot-password"
                >
                  Forgot?
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...form.register("password", { required: true })}
                data-testid="input-password"
              />
              <p className="text-xs text-muted-foreground" data-testid="text-login-hint">
                Tip: any email/password works in this prototype.
              </p>
            </div>

            <Button type="submit" className="w-full" data-testid="button-submit-login">
              Log In
            </Button>
          </form>

          <div className="mt-5 text-sm text-muted-foreground" data-testid="text-login-footer">
            New here?{" "}
            <Link href="/register" className="text-foreground underline underline-offset-4" data-testid="link-register">
              Create an account
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
