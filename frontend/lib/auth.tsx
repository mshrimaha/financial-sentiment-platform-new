"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiGet, apiPost, getToken, setToken } from "./api";

export type User = {
  id: string;
  email: string;
  full_name?: string | null;
  created_at?: string | null;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string, fullName: string) => Promise<void>;
  logout: () => void;
  setUserState: (u: User | null) => void;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  setUserState: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiGet<User>("/api/auth/me");
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onUnauthorized = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("fsa:unauthorized", onUnauthorized);
    return () => window.removeEventListener("fsa:unauthorized", onUnauthorized);
  }, [load]);

  const login = async (email: string, password: string, rememberMe = false) => {
    const res = await apiPost<{ access_token: string; user: User }>("/api/auth/login", {
      email,
      password,
      remember_me: rememberMe,
    });
    setToken(res.access_token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, confirmPassword: string, fullName: string) => {
    const res = await apiPost<{ access_token: string; user: User }>("/api/auth/register", {
      email,
      password,
      confirm_password: confirmPassword,
      full_name: fullName.trim() || null,
    });
    setToken(res.access_token);
    setUser(res.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, setUserState: setUser, refreshUser: load }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-xs font-medium text-slate-400">Verifying session…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
