import { useEffect, useRef, useState } from "react";
import { makeEvent } from "./mock/generators";
import type { SecurityEvent } from "./mock/types";

/** Simulated websocket-like event stream. */
export function useLiveEvents(max = 50, intervalMs = 1500) {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    const tick = () => {
      setEvents((prev) => [makeEvent(new Date()), ...prev].slice(0, max));
    };
    tick();
    ref.current = window.setInterval(tick, intervalMs + Math.random() * 800);
    return () => { if (ref.current) window.clearInterval(ref.current); };
  }, [max, intervalMs]);
  return events;
}

export function useHeartbeat(intervalMs = 1200) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setBeat((b) => b + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return beat;
}
