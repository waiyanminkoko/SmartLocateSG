import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Layers,
  LayoutGrid,
  LogOut,
  Map,
  MapPinned,
  ShieldCheck,
  Scale,
  SquareStack,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth-context";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/profiles", label: "Profiles", icon: Users },
  { href: "/map", label: "Map", icon: Map },
  { href: "/portfolio", label: "Portfolio", icon: SquareStack },
  { href: "/compare", label: "Compare", icon: Scale },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
] as const;

export function AppShell({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur">
        <div className="page-container flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2" data-testid="link-home">
              <div className="grid size-9 place-items-center rounded-xl border bg-card shadow-sm">
                <MapPinned className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold" data-testid="text-brand">
                  SmartLocate SG
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-brand-sub">
                  Workspace
                </div>
              </div>
            </Link>

            <div className="hidden items-center gap-1 md:flex">
              {nav.map((item) => {
                const active = location === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase()}`}>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      className={cn("h-9 gap-2", active && "font-semibold")}
                      data-testid={`button-nav-${item.label.toLowerCase()}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-profile-selector">
                <Layers className="h-4 w-4" aria-hidden="true" />
                Active profile
              </Button>
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-scenario-selector">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Scenario
              </Button>
            </div>

            {right}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 max-w-[180px] truncate" data-testid="button-user-menu">
                  <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{user?.email ?? "Account"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">{user?.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} data-testid="button-sign-out">
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="border-t md:hidden">
          <div className="page-container flex items-center gap-1 overflow-x-auto py-2">
            {nav.map((item) => {
              const active = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} data-testid={`link-nav-mobile-${item.label.toLowerCase()}`}>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    className={cn("h-9 shrink-0 gap-2", active && "font-semibold")}
                    data-testid={`button-nav-mobile-${item.label.toLowerCase()}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="page-container py-8">{children}</main>

      <footer className="page-container pb-10">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div data-testid="text-footer-left">SmartLocate SG • Data sources: OneMap, SingStat, LTA, URA</div>
          <div className="flex items-center gap-2" data-testid="text-footer-right">
            <span className="inline-flex items-center gap-1">
              <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
              Last updated: Feb 4, 2026
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
