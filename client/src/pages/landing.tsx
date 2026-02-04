import { Link } from "wouter";
import { ArrowRight, MapPinned } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="app-shell">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl border bg-card shadow-sm">
            <MapPinned className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold" data-testid="text-appname">
              SmartLocate SG
            </div>
            <div className="text-xs text-muted-foreground" data-testid="text-tagline">
              Location scoring prototype
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" data-testid="button-login">
              Log In
            </Button>
          </Link>
          <Link href="/register">
            <Button data-testid="button-get-started">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-10">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-5">
            <h1
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
              data-testid="text-hero-title"
            >
              Pick a business profile, explore the map, and compare sites.
            </h1>
            <p className="max-w-prose text-pretty text-sm leading-6 text-muted-foreground" data-testid="text-hero-subtitle">
              This minimal UI prototype demonstrates the core flows: creating/selecting a Business Profile,
              viewing a quick score breakdown for a location, saving candidate sites, and comparing up to 3.
            </p>

            <div className="flex flex-wrap gap-2">
              <Link href="/register">
                <Button size="lg" data-testid="button-primary-cta">
                  Create an account
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="secondary" size="lg" data-testid="button-view-demo">
                  View demo
                </Button>
              </Link>
            </div>
          </div>

          <Card className="border bg-card p-5 shadow-sm">
            <div className="space-y-4">
              <div className="text-sm font-semibold" data-testid="text-landing-highlights-title">
                What you can do
              </div>

              <ul className="space-y-3 text-sm text-muted-foreground">
                <li data-testid="text-highlight-profiles">• Create and set an active Business Profile</li>
                <li data-testid="text-highlight-map">• Drop a pin and see a composite score + breakdown</li>
                <li data-testid="text-highlight-portfolio">• Save candidate sites and add notes</li>
                <li data-testid="text-highlight-compare">• Compare 2–3 sites side-by-side</li>
                <li data-testid="text-highlight-weights">• Apply scenario presets and adjust weights</li>
              </ul>

              <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground" data-testid="text-dataset-attribution">
                Data sources (prototype): OneMap, SingStat, LTA, URA.
              </div>
            </div>
          </Card>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10">
        <div className="text-xs text-muted-foreground" data-testid="text-footer">
          SmartLocate SG • Prototype UI only
        </div>
      </footer>
    </div>
  );
}
