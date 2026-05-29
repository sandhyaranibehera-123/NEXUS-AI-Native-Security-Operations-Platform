import { useCallback, useEffect, useRef, useState } from "react";
import { makeEvent } from "./mock/generators";
import type { SecurityEvent } from "./mock/types";
import { getWsUrl } from "./api-client";
import { useAuth } from "./auth-store";

type ConnectionState = "connected" | "reconnecting" | "disconnected";

export function useConnectionState(): ConnectionState {
  const user = useAuth((s) => s.user);
  const [state, setState] = useState<ConnectionState>(user ? "connected" : "disconnected");

  useEffect(() => {
    if (!user) {
      setState("disconnected");
      return;
    }
    setState("connected");
  }, [user]);

  return state;
}

export interface StreamStats {
  eventsPerSec: number;
  throughput: number;
  bufferSize: number;
  lagMs: number;
}

export function useStreamStats(): StreamStats {
  const [stats, setStats] = useState<StreamStats>({ eventsPerSec: 0, throughput: 0, bufferSize: 0, lagMs: 0 });
  const counterRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const eps = counterRef.current;
      counterRef.current = 0;
      setStats({
        eventsPerSec: eps,
        throughput: eps * 340,
        bufferSize: 0,
        lagMs: Math.floor(Math.random() * 5),
      });
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  return stats;
}

type LiveEventStatus = "live" | "paused" | "buffering" | "mock" | "reconnecting";

function mapApiEvent(e: Record<string, unknown>): SecurityEvent {
  return {
    id: String(e.id),
    timestamp: String(e.timestamp),
    type: e.type as SecurityEvent["type"],
    severity: e.severity as SecurityEvent["severity"],
    source: String(e.source),
    sourceIp: String(e.sourceIp ?? ""),
    destIp: String(e.destIp ?? ""),
    user: String(e.user ?? ""),
    host: String(e.host ?? ""),
    rule: String(e.rule ?? ""),
    message: String(e.message),
    country: String(e.country ?? ""),
    asset: String(e.asset ?? ""),
    mitre: String(e.mitre ?? ""),
    raw: (e.raw as Record<string, unknown>) ?? {},
  };
}

/** Live event stream — WebSocket when authenticated, mock fallback otherwise. */
export function useLiveEvents(max = 50, intervalMs = 1500) {
  const user = useAuth((s) => s.user);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [status, setStatus] = useState<LiveEventStatus>("mock");
  const wsRef = useRef<WebSocket | null>(null);
  const mockRef = useRef<number | null>(null);

  const addEvent = useCallback((event: SecurityEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, max));
  }, [max]);

  useEffect(() => {
    if (mockRef.current) {
      window.clearInterval(mockRef.current);
      mockRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (!user) {
      setStatus("mock");
      const tick = () => addEvent(makeEvent(new Date()));
      tick();
      mockRef.current = window.setInterval(tick, intervalMs + Math.random() * 800);
      return () => {
        if (mockRef.current) window.clearInterval(mockRef.current);
      };
    }

    setStatus("live");
    try {
      const ws = new WebSocket(getWsUrl("/v1/ws/events"));
      wsRef.current = ws;

      ws.onopen = () => setStatus("live");
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed.type === "event" && parsed.data) {
            addEvent(mapApiEvent(parsed.data));
          }
        } catch {
          // ignore
        }
      };
      ws.onerror = () => setStatus("buffering");
      ws.onclose = () => {
        setStatus("reconnecting");
        setTimeout(() => setStatus("mock"), 2000);
      };
    } catch {
      setStatus("mock");
      mockRef.current = window.setInterval(
        () => addEvent(makeEvent(new Date())),
        intervalMs,
      );
    }

    return () => {
      wsRef.current?.close();
      if (mockRef.current) window.clearInterval(mockRef.current);
    };
  }, [user, max, intervalMs, addEvent]);

  return { events, status };
}

export function useHeartbeat(intervalMs = 1200) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setBeat((b) => b + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return beat;
}
