# NEXUS — AI-Native Security Operations Platform

Enterprise-grade Security Operations Center (SOC) UI inspired by CrowdStrike Falcon,
Microsoft Sentinel, Datadog Security, Splunk ES, Wiz, and Elastic SIEM.

> Built frontend-first on **TanStack Start + React 19 + Tailwind v4 + shadcn/ui**.
> Backend integration arrives in future phases; all data is mocked but realistic.

## Demo

The dev preview lands on `/login`. Pick any role (default: **Security Admin**) and
continue — you'll be dropped into the SOC console.

Try:
- **⌘K / Ctrl+K** anywhere → global command palette
- Click any event row in the live stream or events table → right-side **Inspector**
- Click an incident → opens the full investigation page with timeline + RCA

## Phase 1 — shipped

Foundation + Dashboard + Events + Incidents.

- ✅ Dark enterprise design system (Inter + JetBrains Mono, severity tokens, grid bg)
- ✅ App shell: sidebar, top bar, time-range chip, stream throughput, command palette
- ✅ Mock auth (Zustand + persist) with 7-role RBAC
- ✅ Realtime event stream simulator + heartbeat
- ✅ Operational `/dashboard` — 8 KPI cards w/ sparklines, threat trend, detections by type, live attack stream, incident feed
- ✅ `/events` — SIEM explorer with query bar, severity facets, stream toggle, dense table
- ✅ `/incidents` — triage table with status facets, severity counts, deep links
- ✅ `/incidents/$incidentId` — investigation view with timeline, RCA, MITRE ATT&CK chips, recommended actions, comments
- ✅ Inspector drawer (Framer Motion) for events + incidents — no page nav required
- ✅ Marketing-style auth screen with role picker

See [ROADMAP.md](./ROADMAP.md) for what's next.

## Stack

| Concern | Library |
|---|---|
| Framework | TanStack Start (Vite, file-based routing, SSR-ready) |
| UI | shadcn/ui + Tailwind v4 |
| State | Zustand (auth, inspector) + TanStack Query (server cache, ready for backend) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Motion | Framer Motion |
| Command palette | cmdk |
| Icons | lucide-react |
| Mock data | @faker-js/faker (seeded for determinism) |

## File layout

```
src/
  components/
    app-sidebar.tsx       — grouped nav (Operate / Detect / Investigate / Govern)
    app-topbar.tsx        — search, ⌘K, time range, stream rate, user pill
    command-palette.tsx   — cmdk palette w/ navigation + actions
    inspector-panel.tsx   — right drawer for events + incidents
    metric-card.tsx       — KPI tile with sparkline
    severity-badge.tsx    — semantic severity chip
  lib/
    auth-store.ts         — Zustand mock session
    inspector-store.ts    — drawer target
    rbac.ts               — roles + permissions + can()
    realtime.ts           — useLiveEvents + useHeartbeat
    mock/
      types.ts            — SecurityEvent, Incident, etc
      generators.ts       — faker generators + seeded singletons
  routes/
    __root.tsx            — shell + fonts + meta
    index.tsx             — redirect → /dashboard
    login.tsx             — mock auth
    _app.tsx              — gated layout (sidebar + topbar + inspector)
    _app.dashboard.tsx    — SOC overview
    _app.events.tsx       — SIEM explorer
    _app.incidents.tsx    — incident triage
    _app.incidents.$incidentId.tsx — investigation view
  styles.css              — design tokens (oklch), severity colors, utilities
```

## Conventions

- **No hardcoded colors in components** — use semantic tokens (`bg-critical/15`, `text-healthy`, etc.).
- **No `react-router-dom`** — TanStack Router only.
- **No `src/pages/`** — pages live in `src/routes/` (flat dot naming).
- **Mock data is seeded** (`faker.seed(42)`) so demos stay stable per session.
