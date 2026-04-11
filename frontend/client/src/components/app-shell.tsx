import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  LogOut,
  Map,
  MapPinned,
  Scale,
  ShieldCheck,
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
  const brandLogoSrc = "/SmartLocateSG_Logo.png";

  return (
    <div className="app-shell workspace-page">
      <header className="workspace-shell-header sticky top-0 z-20 border-b">
        <div className="page-container py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <Link href="/dashboard" className="flex items-center gap-3" data-testid="link-home">
                <div className="workspace-brand-mark size-11">
                  <img src={brandLogoSrc} alt="SmartLocate SG logo" className="h-full w-full object-contain" />
                </div>
                <div className="leading-tight">
                  <div
                    className="text-xs font-semibold uppercase tracking-[0.08em] text-[hsl(var(--foreground)/0.76)]"
                    data-testid="text-brand"
                  >
                    <span className="block">SmartLocate</span>
                    <span className="block">SG</span>
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-brand-sub">
                    {title}
                  </div>
                </div>
              </Link>

              <div className="hidden items-center gap-2 lg:flex">
                {nav.map((item) => {
                  const active = location === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase()}`}>
                      <Button
                        variant={active ? "secondary" : "ghost"}
                        className={cn(
                          "workspace-nav-pill h-10 rounded-full px-4 text-xs",
                          active && "workspace-nav-pill-active font-semibold",
                        )}
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

            <div className="flex items-center gap-2 self-start lg:self-auto [&_button]:text-xs">
              {right}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="workspace-nav-pill h-10 max-w-55 rounded-full border border-[hsl(var(--card-border)/0.72)] bg-[hsl(var(--card)/0.66)] px-4 text-xs"
                    data-testid="button-user-menu"
                  >
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
        </div>

        <div className="border-t border-[hsl(var(--border)/0.72)] lg:hidden">
          <div className="page-container flex items-center gap-2 overflow-x-auto py-3">
            {nav.map((item) => {
              const active = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} data-testid={`link-nav-mobile-${item.label.toLowerCase()}`}>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    className={cn(
                      "workspace-nav-pill h-10 shrink-0 rounded-full px-4 text-xs",
                      active && "workspace-nav-pill-active font-semibold",
                    )}
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

      <main className="page-container workspace-main">{children}</main>

      <footer className="page-container pb-8 lg:pb-10">
        <div className="workspace-shell-footer flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div data-testid="text-footer-left">SmartLocate SG | Data sources: OneMap, SingStat, LTA, URA</div>
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
