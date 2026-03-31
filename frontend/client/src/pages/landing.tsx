import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Building2,
  Database,
  Map,
  MapPinned,
  Route,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Store,
  Target,
  TrainFront,
  Users2,
  Wallet,
} from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const audienceCards = [
  {
    title: "SMEs",
    description:
      "Validate the next neighborhood for your outlet with demand, transit pull, and supply pressure in one view.",
    icon: Store,
  },
  {
    title: "Expansion teams",
    description:
      "Score multiple candidate sites with a consistent framework before lease review, rollout planning, or budget approval.",
    icon: Building2,
  },
  {
    title: "Commercial agents",
    description:
      "Support client recommendations with clearer trade-offs and explainable score narratives instead of gut feel alone.",
    icon: Users2,
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Define the business profile",
    description:
      "Capture sector, price band, target age groups, income bands, and delivery versus walk-in reliance.",
    icon: Store,
  },
  {
    step: "02",
    title: "Experiment on the map",
    description:
      "Explore planning areas, drop a pin, and inspect a composite score with dimension-level breakdowns.",
    icon: MapPinned,
  },
  {
    step: "03",
    title: "Tune scenario weights",
    description:
      "Test Holiday Peak, Delivery Focus, Cost-Saving, or custom weights before ranking the shortlist.",
    icon: SlidersHorizontal,
  },
  {
    step: "04",
    title: "Save and compare sites",
    description:
      "Build a portfolio of candidate sites, keep notes, and compare up to three options side by side.",
    icon: Scale,
  },
];

const scoringPillars = [
  {
    title: "Demographic match",
    description:
      "Match target age and income segments against local area distributions to estimate customer fit.",
    stat: "Age + income fit",
    value: 82,
    icon: Users2,
  },
  {
    title: "Accessibility",
    description:
      "Use MRT station density, exits, bus-stop proximity, and connectivity as footfall proxies.",
    stat: "Transit readiness",
    value: 88,
    icon: TrainFront,
  },
  {
    title: "Rental pressure",
    description:
      "Use vacancy and commercial supply proxies to surface areas where occupancy pressure may affect affordability.",
    stat: "Vacancy pressure",
    value: 71,
    icon: Wallet,
  },
  {
    title: "Competition density",
    description:
      "Count similar businesses around a candidate site to separate crowded clusters from whitespace.",
    stat: "Competitor intensity",
    value: 64,
    icon: Target,
  },
];

const presets = [
  {
    name: "Holiday Peak",
    description:
      "Raise the weight on station and bus access when you expect commuter surges or mall traffic.",
    weights: ["Accessibility 40%", "Demographics 25%", "Competition 20%", "Rental 15%"],
  },
  {
    name: "Delivery Focus",
    description:
      "Shift emphasis toward residential demand and reduce dependence on transit-heavy areas.",
    weights: ["Demographics 38%", "Competition 24%", "Rental 20%", "Accessibility 18%"],
  },
  {
    name: "Cost-Saving",
    description:
      "Prioritize vacancy and rental signals to preserve flexibility without losing core demand fit.",
    weights: ["Rental 36%", "Demographics 28%", "Competition 22%", "Accessibility 14%"],
  },
  {
    name: "Custom Weights",
    description:
      "Dial each scoring dimension manually so teams can test assumptions and see ranking changes.",
    weights: ["Demographics 30%", "Accessibility 30%", "Rental 20%", "Competition 20%"],
  },
];

const dataSources = [
  {
    name: "OneMap and SingStat",
    description: "Planning-area age, income, and household signals that shape demographic fit.",
    icon: Database,
  },
  {
    name: "LTA DataMall",
    description: "MRT stations, exits, and bus-stop layers used as accessibility proxies.",
    icon: TrainFront,
  },
  {
    name: "URA rental proxies",
    description: "Vacancy and commercial supply indicators that inform rental pressure.",
    icon: Wallet,
  },
  {
    name: "Competition proxies",
    description: "Nearby business counts that help separate crowded clusters from viable whitespace.",
    icon: Map,
  },
];

const systemLayers = [
  {
    title: "React client",
    description:
      "Public positioning plus authenticated flows for profiles, map scoring, portfolio management, and comparison.",
    icon: MapPinned,
  },
  {
    title: "Scoring services",
    description:
      "Composite scoring combines demographics, accessibility, rental, and competition with scenario weights.",
    icon: BarChart3,
  },
  {
    title: "SQL-backed storage",
    description:
      "Profiles, saved sites, score snapshots, and explanation outputs are structured for repeatable comparison runs.",
    icon: Database,
  },
];

const sampleBreakdown = [
  { label: "Demographic match", value: 84 },
  { label: "Accessibility", value: 91 },
  { label: "Rental pressure", value: 68 },
  { label: "Competition density", value: 74 },
];

const sampleSignals = [
  "Target profile: education and training",
  "2 MRT stations within rapid access radius",
  "Balanced vacancy signal for suburban retail",
  "Competition higher, but not saturated",
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl landing-reveal">
      <div className="landing-section-label">{eyebrow}</div>
      <h2 className="landing-display mt-4 text-balance text-4xl sm:text-5xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="landing-hero-stack relative mx-auto flex max-w-[640px] flex-col gap-4 lg:min-h-[590px]">
      <Card className="landing-surface landing-hover-card relative overflow-hidden border p-6 lg:absolute lg:left-0 lg:top-10 lg:w-[400px]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.18),transparent_70%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sample live score</div>
            <div className="mt-2 text-xl font-semibold">Bishan North Junction</div>
            <div className="mt-1 text-sm text-muted-foreground">Education and training profile</div>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--primary)/0.08)] px-4 py-3 text-right shadow-[0_20px_35px_-28px_rgba(13,148,136,0.65)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--foreground)/0.6)]">Composite</div>
            <div className="mt-1 text-4xl font-semibold leading-none text-primary">84</div>
            <div className="mt-1 text-xs text-muted-foreground">Out of 100</div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {sampleBreakdown.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[hsl(var(--foreground)/0.84)]">{item.label}</span>
                <span className="text-muted-foreground">{item.value}</span>
              </div>
              <Progress value={item.value} className="h-2.5 bg-[hsl(var(--foreground)/0.08)]" />
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2" data-testid="text-dataset-attribution">
          {["OneMap", "SingStat", "LTA", "URA"].map((source) => (
            <Badge key={source} variant="outline" className="landing-chip">
              {source}
            </Badge>
          ))}
        </div>
      </Card>

      <Card className="landing-surface landing-hover-card border p-5 lg:absolute lg:right-0 lg:top-0 lg:w-[236px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scenario active</div>
            <div className="mt-2 text-lg font-semibold">Holiday Peak</div>
          </div>
          <div className="grid size-10 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.9)] bg-[hsl(var(--card)/0.9)]">
            <Route className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {presets[0].weights.map((weight) => (
            <div key={weight} className="text-sm text-[hsl(var(--foreground)/0.8)]">
              {weight}
            </div>
          ))}
        </div>
      </Card>

      <Card className="landing-surface landing-hover-card border p-5 lg:absolute lg:right-4 lg:bottom-7 lg:w-[264px]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <BrainCircuit className="h-4 w-4 text-primary" aria-hidden="true" />
          Explainable insight
        </div>
        <p className="mt-4 text-sm leading-6 text-[hsl(var(--foreground)/0.82)]">
          This site scores strongly because the surrounding population matches the target age and income
          profile, while nearby MRT access supports steady commuter visibility.
        </p>
      </Card>

      <div className="landing-map-panel lg:absolute lg:bottom-0 lg:left-[132px] lg:w-[334px]">
        <div className="landing-map-grid">
          <div className="landing-map-marker landing-marker-primary" />
          <div className="landing-map-marker landing-marker-secondary" />
          <div className="landing-map-marker landing-marker-accent" />
          <div className="landing-map-path" />
        </div>
        <div className="mt-4 rounded-3xl border border-[hsl(var(--card-border)/0.88)] bg-[hsl(var(--card)/0.82)] p-4 shadow-[0_30px_60px_-38px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-4 w-4 text-[hsl(var(--landing-orange))]" aria-hidden="true" />
            What the engine sees
          </div>
          <div className="mt-3 space-y-2 text-sm text-[hsl(var(--foreground)/0.82)]">
            {sampleSignals.map((signal) => (
              <div key={signal} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                <span>{signal}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="landing-page">
      <header
        className="landing-header sticky top-0 z-30 border-b border-[hsl(var(--border)/0.75)] bg-[hsl(var(--background)/0.78)] backdrop-blur-xl"
        data-testid="landing-header"
      >
        <div className="page-container flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.9)] bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--muted)))] shadow-[0_20px_45px_-28px_rgba(15,23,42,0.55)]">
              <MapPinned className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <div
                className="text-sm font-semibold uppercase tracking-[0.08em] text-[hsl(var(--foreground)/0.7)]"
                data-testid="text-appname"
              >
                SmartLocate SG
              </div>
              <div className="text-xs text-muted-foreground" data-testid="text-tagline">
                Singapore site selection intelligence
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-6 text-sm text-[hsl(var(--foreground)/0.74)] md:flex">
            <a className="landing-nav-link" href="#workflow" data-testid="link-nav-workflow">
              Workflow
            </a>
            <a className="landing-nav-link" href="#scoring" data-testid="link-nav-scoring">
              Scoring
            </a>
            <a className="landing-nav-link" href="#data" data-testid="link-nav-data">
              Data
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:inline-flex" data-testid="button-login">
                Log In
              </Button>
            </Link>
            <Link href="/register">
              <Button className="landing-cta-button" data-testid="button-get-started">
                Get Started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="page-container pb-10 pt-8 sm:pt-12 lg:pb-16 lg:pt-16" data-testid="landing-hero">
          <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div className="space-y-7 landing-reveal">
              <Badge
                variant="outline"
                className="landing-chip border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--card)/0.72)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--foreground)/0.72)]"
              >
                Data-driven location scoring for Singapore
              </Badge>

              <div className="space-y-5">
                <h1
                  className="landing-display max-w-3xl text-balance text-5xl leading-none sm:text-6xl xl:text-7xl"
                  data-testid="text-hero-title"
                >
                  Choose outlet locations with evidence before you commit budget.
                </h1>
                <p
                  className="max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg"
                  data-testid="text-hero-subtitle"
                >
                  SmartLocate SG helps teams score and compare sites across Singapore using demographics,
                  transport access, vacancy and rental proxies, competition density, and explainable scoring.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/register">
                  <Button size="lg" className="landing-cta-button" data-testid="button-primary-cta">
                    Create an account
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="landing-secondary-button"
                  data-testid="button-view-workflow"
                >
                  <a href="#workflow">See workflow</a>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Scoring model", "4 pillars", "Demographics, transit, rental pressure, and competition."],
                  ["Scenario planning", "4 presets", "Holiday Peak, Delivery Focus, Cost-Saving, and custom weights."],
                  ["Decision support", "3-site compare", "Save candidate sites, keep notes, and compare side by side."],
                ].map(([label, value, copy]) => (
                  <Card key={label} className="landing-surface landing-hover-card border p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{copy}</div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="landing-reveal landing-delay-2">
              <HeroVisual />
            </div>
          </div>
        </section>

        <section className="page-container pb-10 lg:pb-16" data-testid="landing-audience-strip">
          <div className="grid gap-4 md:grid-cols-3">
            {audienceCards.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="landing-surface landing-hover-card border p-6">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.92)] bg-[hsl(var(--card)/0.82)]">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="text-lg font-semibold">{title}</div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="workflow" className="page-container scroll-mt-24 py-12 lg:py-20" data-testid="landing-workflow">
          <SectionHeading
            eyebrow="Workflow"
            title="Move from business assumptions to a ranked location shortlist."
            description="The product flow mirrors how site decisions are made in practice: define the customer, test areas, stress the model, and compare real candidate options before committing."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {workflowSteps.map(({ step, title, description, icon: Icon }, index) => (
              <Card
                key={step}
                className={`landing-surface landing-hover-card border p-6 landing-reveal ${
                  index > 0 ? `landing-delay-${Math.min(index + 1, 4)}` : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.9)] bg-[hsl(var(--card)/0.82)]">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--foreground)/0.45)]">{step}</div>
                </div>
                <div className="mt-6 text-xl font-semibold tracking-tight">{title}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="scoring" className="page-container scroll-mt-24 py-12 lg:py-20" data-testid="landing-scoring">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
            <SectionHeading
              eyebrow="Scoring pillars"
              title="A location score is only useful when every dimension is visible."
              description="Each site can be explained through demand fit, accessibility, rental pressure, and local competition so teams know what is strong, what is risky, and what needs follow-up."
            />
            <Card className="landing-surface landing-hover-card border p-6 lg:p-7">
              <div className="grid gap-4 sm:grid-cols-2">
                {scoringPillars.map(({ title, description, stat, value, icon: Icon }) => (
                  <div key={title} className="rounded-[1.5rem] border border-[hsl(var(--card-border)/0.82)] bg-[hsl(var(--card)/0.75)] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="grid size-10 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.92)] bg-[hsl(var(--card)/0.95)]">
                        <Icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
                      </div>
                      <div className="text-sm font-medium text-primary">{value}/100</div>
                    </div>
                    <div className="mt-4 text-lg font-semibold">{title}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{stat}</div>
                    <Progress value={value} className="mt-4 h-2.5 bg-[hsl(var(--foreground)/0.08)]" />
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
        <section className="page-container py-12 lg:py-20">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="landing-surface landing-hover-card border p-6 lg:p-7">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.9)] bg-[hsl(var(--card)/0.82)]">
                  <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <div className="landing-section-label">Scenario planning</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">
                    Shift the score for the business reality you expect.
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {presets.map((preset) => (
                  <div key={preset.name} className="rounded-[1.5rem] border border-[hsl(var(--card-border)/0.82)] bg-[hsl(var(--card)/0.76)] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold">{preset.name}</div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{preset.description}</p>
                      </div>
                      <Badge variant="outline" className="landing-chip shrink-0">
                        Total 100%
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {preset.weights.map((weight) => (
                        <div key={`${preset.name}-${weight}`} className="rounded-2xl border border-[hsl(var(--card-border)/0.76)] bg-[hsl(var(--background)/0.55)] px-3 py-2 text-sm text-[hsl(var(--foreground)/0.78)]">
                          {weight}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="landing-surface landing-hover-card border p-6 lg:p-7">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.9)] bg-[hsl(var(--card)/0.82)]">
                  <BrainCircuit className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <div className="landing-section-label">AI score explanations</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">
                    Translate data signals into decision-ready language.
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="landing-chat-bubble">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-[hsl(var(--landing-orange))]" aria-hidden="true" />
                    Score explanation preview
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[hsl(var(--foreground)/0.84)]">
                    Bishan North Junction remains attractive for a mid-market education brand because the
                    surrounding planning area has a strong 25-44 population mix, accessible MRT exits, and
                    weekday traffic support. The main caution is competition, so the concept must still differentiate.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Why it scored well", "Strong demographic fit and transport access give the location durable demand potential."],
                    ["What to watch next", "Validate competitor differentiation and rental tolerance before final review."],
                  ].map(([title, copy]) => (
                    <div key={title} className="rounded-[1.5rem] border border-[hsl(var(--card-border)/0.82)] bg-[hsl(var(--card)/0.78)] p-5">
                      <div className="text-sm font-semibold">{title}</div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section id="data" className="page-container scroll-mt-24 py-12 lg:py-20" data-testid="landing-data">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <SectionHeading
              eyebrow="Data and credibility"
              title="Built around public Singapore datasets and a transparent scoring pipeline."
              description="The platform combines area-level demand signals, transport layers, commercial proxies, and competitor context so recommendations can be inspected rather than accepted on trust alone."
            />
            <Card className="landing-surface landing-hover-card border p-6 lg:p-7">
              <div className="grid gap-4 sm:grid-cols-2">
                {dataSources.map(({ name, description, icon: Icon }) => (
                  <div key={name} className="rounded-[1.5rem] border border-[hsl(var(--card-border)/0.82)] bg-[hsl(var(--card)/0.78)] p-5">
                    <div className="grid size-11 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.92)] bg-[hsl(var(--card)/0.88)]">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="mt-4 text-lg font-semibold">{name}</div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                {systemLayers.map(({ title, description, icon: Icon }) => (
                  <div key={title} className="rounded-[1.5rem] border border-[hsl(var(--card-border)/0.82)] bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(34,197,94,0.08),rgba(249,115,22,0.07))] p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-2xl border border-[hsl(var(--card-border)/0.88)] bg-[hsl(var(--card)/0.94)]">
                        <Icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
                      </div>
                      <div className="text-lg font-semibold">{title}</div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[hsl(var(--foreground)/0.78)]">{description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section className="page-container pb-12 pt-10 lg:pb-16" data-testid="landing-final-cta">
          <Card className="landing-surface landing-hover-card overflow-hidden border p-7 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="landing-section-label">Start the shortlist</div>
                <h2 className="landing-display mt-4 text-balance text-4xl sm:text-5xl">
                  Build the profile, test the area, and compare the sites that deserve a closer look.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Create a business profile, run location experiments on the map, and keep a structured
                  portfolio of candidate sites for the next review session.
                </p>
              </div>

              <div className="space-y-4 lg:justify-self-end">
                <Link href="/register">
                  <Button size="lg" className="landing-cta-button w-full sm:w-auto" data-testid="button-final-cta-register">
                    Get Started
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Button asChild size="lg" variant="secondary" className="landing-secondary-button w-full sm:w-auto" data-testid="button-final-cta-workflow">
                  <a href="#workflow">Explore the workflow</a>
                </Button>
                <p className="text-sm leading-6 text-muted-foreground">
                  Public inputs include OneMap, SingStat, LTA, URA, and competition proxies.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="page-container pb-8">
        <div className="flex flex-col gap-3 border-t border-[hsl(var(--border)/0.75)] py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between" data-testid="text-footer">
          <div className="flex items-center gap-2 text-[hsl(var(--foreground)/0.78)]">
            <MapPinned className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="font-medium">SmartLocate SG</span>
          </div>
          <div>Data-driven site selection workspace for businesses evaluating locations in Singapore.</div>
          <div>Sources: OneMap, SingStat, LTA, URA, and competition proxies.</div>
        </div>
      </footer>
    </div>
  );
}
