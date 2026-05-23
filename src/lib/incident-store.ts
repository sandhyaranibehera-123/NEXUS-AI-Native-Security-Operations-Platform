import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IncidentStatus } from "./mock/types";

export interface IncidentNote {
  id: string;
  author: string;
  at: string;
  body: string;
}

export interface IncidentOverride {
  status?: IncidentStatus;
  assignee?: string;
  notes: IncidentNote[];
  starred?: boolean;
}

interface IncidentState {
  overrides: Record<string, IncidentOverride>;
  setStatus: (code: string, status: IncidentStatus) => void;
  setAssignee: (code: string, assignee: string) => void;
  addNote: (code: string, author: string, body: string) => void;
  toggleStar: (code: string) => void;
}

const empty = (): IncidentOverride => ({ notes: [] });

export const useIncidentStore = create<IncidentState>()(
  persist(
    (set) => ({
      overrides: {},
      setStatus: (code, status) =>
        set((s) => ({
          overrides: { ...s.overrides, [code]: { ...(s.overrides[code] ?? empty()), status } },
        })),
      setAssignee: (code, assignee) =>
        set((s) => ({
          overrides: { ...s.overrides, [code]: { ...(s.overrides[code] ?? empty()), assignee } },
        })),
      addNote: (code, author, body) =>
        set((s) => {
          const o = s.overrides[code] ?? empty();
          const note: IncidentNote = {
            id: crypto.randomUUID(),
            author,
            at: new Date().toISOString(),
            body,
          };
          return {
            overrides: { ...s.overrides, [code]: { ...o, notes: [...o.notes, note] } },
          };
        }),
      toggleStar: (code) =>
        set((s) => {
          const o = s.overrides[code] ?? empty();
          return {
            overrides: { ...s.overrides, [code]: { ...o, starred: !o.starred } },
          };
        }),
    }),
    { name: "nexus.incidents" },
  ),
);
