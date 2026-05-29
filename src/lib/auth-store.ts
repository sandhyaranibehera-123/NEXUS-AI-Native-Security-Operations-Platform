import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "./rbac";
import { apiFetch, setStoredTokens } from "./api-client";
import type { SessionUser } from "@nexus/shared";

export type { SessionUser };

interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, demoRole?: Role) => Promise<void>;
  logout: () => void;
  setRole: (role: Role) => void;
  hydrate: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,

      login: async (email, password, demoRole) => {
        set({ isLoading: true, error: null });
        try {
          const result = await apiFetch<{
            accessToken: string;
            refreshToken: string;
            user: SessionUser;
          }>("/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });

          setStoredTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          });

          const user = demoRole
            ? { ...result.user, role: demoRole }
            : result.user;

          set({
            user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            isLoading: false,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Login failed";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: () => {
        const { refreshToken } = get();
        if (refreshToken) {
          apiFetch("/v1/auth/logout", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          }).catch(() => {});
        }
        setStoredTokens(null);
        set({ user: null, accessToken: null, refreshToken: null });
      },

      setRole: (role) => {
        const u = get().user;
        if (u) set({ user: { ...u, role } });
      },

      hydrate: async () => {
        const tokens = get();
        if (!tokens.accessToken && !tokens.refreshToken) return;
        try {
          const user = await apiFetch<SessionUser>("/v1/auth/me");
          set({ user });
        } catch {
          setStoredTokens(null);
          set({ user: null, accessToken: null, refreshToken: null });
        }
      },
    }),
    {
      name: "nexus.auth",
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    },
  ),
);
