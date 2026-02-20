import { Route, Switch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { queryClient } from "./lib/queryClient";

import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Profiles from "@/pages/profiles";
import ProfileWizard from "@/pages/profiles-wizard";
import MapPage from "@/pages/map";
import Portfolio from "@/pages/portfolio";
import Compare from "@/pages/compare";
import Admin from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/profiles" component={Profiles} />
      <Route path="/profiles/new" component={ProfileWizard} />
      <Route path="/map" component={MapPage} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/compare" component={Compare} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
