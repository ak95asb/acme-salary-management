"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, setAccessToken } from "@/lib/api";

export type UserRole = "SYSTEM_ADMIN" | "HR_ADMIN" | "HR_VIEWER";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
  });

  // On mount, attempt to restore session via refresh token cookie
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post<{ data: { accessToken: string; user: AuthUser } }>(
          "/api/auth/refresh"
        );
        const { accessToken, user } = res.data.data;
        setAccessToken(accessToken);
        setState({ user, accessToken, isLoading: false });
      } catch {
        setState({ user: null, accessToken: null, isLoading: false });
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{
      data: { accessToken: string; user: AuthUser };
    }>("/api/auth/login", { email, password });

    const { accessToken, user } = res.data.data;
    setAccessToken(accessToken);
    setState({ user, accessToken, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore
    } finally {
      setAccessToken(null);
      setState({ user: null, accessToken: null, isLoading: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
