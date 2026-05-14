import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setGlobalHeaders, setBaseUrl } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";

import { Shell } from "@/components/layout/shell";
import { useAuth } from "@/hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
    mutations: { retry: 0 },
  },
});

function ApiBaseUrlSync() {
  useEffect(() => {
    const apiUrl = import.meta.env.PROD
      ? window.location.origin
      : import.meta.env.VITE_API_URL || "http://localhost:8080";
    setBaseUrl(apiUrl);
  }, []);
  return null;
}

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
      {/* Rota Raiz agora renderiza o Dashboard diretamente dentro do Shell */}
      <Route path="/">
        <Shell>
          <Dashboard />
        </Shell>
      </Route>

      <Route path="/login" component={Login} />

      <Route path="/dashboard">
        <Shell>
          <Dashboard />
        </Shell>
      </Route>

      <Route path="/tasks">
        <Shell>
          <Tasks />
        </Shell>
      </Route>

      <Route path="/logs">
        <Shell>
          <Logs />
        </Shell>
      </Route>

      <Route path="/settings">
        <Shell>
          <Settings />
        </Shell>
      </Route>

      {/* Em caso de erro, redireciona para a home/dashboard */}
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Ajuste para evitar erros de base URL vazia */}
        <WouterRouter base={(import.meta.env.BASE_URL || "").replace(/\/$/, "")}>
          <ApiBaseUrlSync />
          <AuthHeaderSync />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
