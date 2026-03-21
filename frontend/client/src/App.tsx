import { Route, Switch, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "@/context/auth-context";

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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/profiles">
        {() => <ProtectedRoute component={Profiles} />}
      </Route>
      <Route path="/profiles/new">
        {() => <ProtectedRoute component={ProfileWizard} />}
      </Route>
      <Route path="/map">
        {() => <ProtectedRoute component={MapPage} />}
      </Route>
      <Route path="/portfolio">
        {() => <ProtectedRoute component={Portfolio} />}
      </Route>
      <Route path="/compare">
        {() => <ProtectedRoute component={Compare} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={Admin} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
