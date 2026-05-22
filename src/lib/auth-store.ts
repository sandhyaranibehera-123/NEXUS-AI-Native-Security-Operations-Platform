import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "./rbac";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  workspace: string;
  avatarSeed: string;
}

interface AuthState {
  user: SessionUser | null;
  login: (email: string, role?: Role) => void;
  logout: () => void;
  setRole: (role: Role) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      login: (email, role = "security_admin") => {
        const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        set({
          user: {
            id: crypto.randomUUID(),
            email,
            name,
            role,
            workspace: "Acme Federal",
            avatarSeed: email,
          },
        });
      },
      logout: () => set({ user: null }),
      setRole: (role) => {
        const u = get().user;
        if (u) set({ user: { ...u, role } });
      },
    }),
    { name: "nexus.auth" },
  ),
);
