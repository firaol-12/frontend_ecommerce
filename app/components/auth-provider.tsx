"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AuthUser, getUser, logout as clearAuth } from "../lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loggedIn: boolean;
  isAdminUser: boolean;
  setUser: (user: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);

  const refresh = useCallback(() => {
    setUserState(getUser());
  }, []);

  useEffect(() => {
    refresh();

    // Re-sync when auth changes (other tabs, or the custom event fired after login/register).
    const onStorage = () => refresh();
    const onAuth = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-change", onAuth);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-change", onAuth);
    };
  }, [refresh]);

  const setUser = useCallback((next: AuthUser) => {
    localStorage.setItem("user", JSON.stringify(next));
    setUserState(next);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUserState(null);

    // PWA: remove saved pages and API data so the next person on this device
    // never sees cached content. Static files and icons are kept so the app
    // still opens offline.
    if (typeof window !== "undefined" && "caches" in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("pages-") || k.startsWith("data-"))
              .map((k) => caches.delete(k))
          )
        )
        .catch(() => {
          /* ignore cache errors */
        });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loggedIn: Boolean(user),
      isAdminUser: user?.role === "admin",
      setUser,
      logout,
    }),
    [user, setUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}