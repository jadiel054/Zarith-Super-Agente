import { useState, useEffect, useCallback } from "react";

export interface AuthState {
  isAuthenticated: boolean;
  isChecking: boolean;
  email: string | null;
  token: string | null;
}

const STORAGE_KEYS = {
  authenticated: "zarith_authenticated",
  email: "zarith_email",
  token: "zarith_token",
  tokenExpiry: "zarith_token_expiry",
} as const;

function parseJwtExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const expiry = parseJwtExpiry(token);
  if (expiry === null) return true; // non-JWT token, trust it
  // Allow 60-second clock skew buffer
  return Date.now() < expiry - 60_000;
}

function readAuthFromStorage(): AuthState {
  const authenticated = localStorage.getItem(STORAGE_KEYS.authenticated);
  const email = localStorage.getItem(STORAGE_KEYS.email);
  const token = localStorage.getItem(STORAGE_KEYS.token);

  if (!authenticated) {
    return { isAuthenticated: false, isChecking: false, email: null, token: null };
  }

  // If we have a JWT token, validate its expiry
  if (token && !isTokenValid(token)) {
    clearAuthStorage();
    return { isAuthenticated: false, isChecking: false, email: null, token: null };
  }

  return { isAuthenticated: true, isChecking: false, email, token };
}

export function clearAuthStorage() {
  localStorage.removeItem(STORAGE_KEYS.authenticated);
  localStorage.removeItem(STORAGE_KEYS.email);
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.tokenExpiry);
}

export function writeAuthStorage(email: string, token: string | null) {
  localStorage.setItem(STORAGE_KEYS.authenticated, "true");
  localStorage.setItem(STORAGE_KEYS.email, email);
  if (token) localStorage.setItem(STORAGE_KEYS.token, token);
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(() => ({
    ...readAuthFromStorage(),
    isChecking: false,
  }));

  const revalidate = useCallback(() => {
    setAuth(readAuthFromStorage());
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    // Clear OTP session state too
    sessionStorage.removeItem("zarith_login_email");
    sessionStorage.removeItem("zarith_login_step");
    setAuth({ isAuthenticated: false, isChecking: false, email: null, token: null });
  }, []);

  useEffect(() => {
    // Re-check auth whenever the page becomes visible again
    // (handles mobile browser returning from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        revalidate();
      }
    };

    // Also re-check on window focus (desktop + iOS Safari)
    const handleFocus = () => revalidate();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [revalidate]);

  useEffect(() => {
    // If authenticated with a token, schedule re-validation before token expires
    if (!auth.token || !auth.isAuthenticated) return;

    const expiry = parseJwtExpiry(auth.token);
    if (!expiry) return;

    const msUntilExpiry = expiry - Date.now() - 60_000;
    if (msUntilExpiry <= 0) {
      logout();
      return;
    }

    const timer = setTimeout(() => {
      revalidate();
    }, Math.min(msUntilExpiry, 60 * 60 * 1000)); // max 1h

    return () => clearTimeout(timer);
  }, [auth.token, auth.isAuthenticated, logout, revalidate]);

  return { ...auth, logout, revalidate };
}
