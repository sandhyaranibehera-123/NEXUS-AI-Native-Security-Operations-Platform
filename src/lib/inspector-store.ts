import { create } from "zustand";
import type { SecurityEvent } from "./mock/types";
import type { Incident } from "./mock/types";

type InspectorTarget =
  | { kind: "event"; event: SecurityEvent }
  | { kind: "incident"; incident: Incident }
  | null;

interface InspectorState {
  target: InspectorTarget;
  open: (t: NonNullable<InspectorTarget>) => void;
  close: () => void;
}

export const useInspector = create<InspectorState>((set) => ({
  target: null,
  open: (t) => set({ target: t }),
  close: () => set({ target: null }),
}));
