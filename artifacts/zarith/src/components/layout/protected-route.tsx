import { useEffect } from "react";
import { useLocation } from "wouter";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("zarith_authenticated");
    if (!isAuthenticated && location !== "/login") {
      setLocation("/login");
    }
  }, [location, setLocation]);

  return <>{children}</>;
}