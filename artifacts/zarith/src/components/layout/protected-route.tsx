import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isChecking } = useAuth();

  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isChecking, setLocation]);

  // Render nothing while checking — avoids flash of protected content
  if (isChecking) return null;

  // Not authenticated — render nothing while redirect is pending
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
