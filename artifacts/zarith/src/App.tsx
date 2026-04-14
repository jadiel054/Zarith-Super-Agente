import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setGlobalHeaders } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";

import { Shell } from "@/components/layout/shell";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { useAuth } from "@/hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
    mutations: { retry: 0 },
  },
});

// Keeps the X-User-Email header in sync with the current auth session
function AuthHeaderSync() {
  const { email } = useAuth();

  useEffect(() => {
    if (email) {
      setGlobalHeaders({ "X-User-Email": email });
    } else {
      setGlobalHeaders({});
    }
  }, [email]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        <ProtectedRoute>
          <Shell>
            <Dashboard />
          </Shell>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <Shell>
            <Dashboard />
          </Shell>
        </ProtectedRoute>
      </Route>

      <Route path="/tasks">
        <ProtectedRoute>
          <Shell>
            <Tasks />
          </Shell>
        </ProtectedRoute>
      </Route>

      <Route path="/logs">
        <ProtectedRoute>
          <Shell>
            <Logs />
          </Shell>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <Shell>
            <Settings />
          </Shell>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthHeaderSync />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
