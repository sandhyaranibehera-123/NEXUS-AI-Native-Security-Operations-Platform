/**
 * Workspace Feature Configuration
 * ------------------------------------------------------------------
 * Single source of truth for sidebar navigation + role gating.
 * Every navigable feature is registered once here with its group,
 * route, icon and required permission. The sidebar, command palette
 * and route guards all read from this catalog so role-based access
 * stays consistent across the platform.
 */
import {
  Activity, TriangleAlert as AlertTriangle, ChartBar as BarChart3, Bell, BookOpen,
  Boxes, Briefcase, Cloud, Code, Cpu, Crosshair, FileSearch, FileText,
  FingerprintPattern as Fingerprint, GitBranch, KeyRound, LayoutDashboard,
  ListChecks, Network, Plug, Rocket, RotateCcw, Settings, Shield, ShieldAlert,
  Sparkles, Terminal, Users, Workflow,
} from "lucide-react";
import { can, type Permission, type Role } from "./rbac";

export type FeatureGroupKey =
  | "operate" | "detect" | "investigate" | "analyze"
  | "govern" | "platform" | "admin";

export interface Feature {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  /** Short blurb used in command palette / tooltips. */
  blurb?: string;
}

export interface FeatureGroup {
  key: FeatureGroupKey;
  label: string;
  features: Feature[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    key: "operate",
    label: "Operate",
    features: [
      { to: "/dashboard",     label: "Overview",        icon: LayoutDashboard, permission: "view:dashboard" },
      { to: "/executive",     label: "Executive View",  icon: BarChart3,       permission: "view:executive" },
      { to: "/events",        label: "Security Events", icon: FileSearch,      permission: "view:events" },
      { to: "/incidents",     label: "Incidents",       icon: ShieldAlert,     permission: "view:incidents" },
      { to: "/alerts",        label: "Alerts",          icon: AlertTriangle,   permission: "view:alerts" },
      { to: "/notifications", label: "Notifications",   icon: Bell,            permission: "view:notifications" },
      { to: "/cases",         label: "Cases",           icon: Briefcase,       permission: "view:cases" },
    ],
  },
  {
    key: "detect",
    label: "Detect",
    features: [
      { to: "/threat-intelligence", label: "Threat Intel",     icon: Activity,    permission: "view:threat-intel" },
      { to: "/endpoints",           label: "Endpoints",        icon: Boxes,       permission: "view:endpoints" },
      { to: "/identity",            label: "Identity",         icon: Fingerprint, permission: "view:identity" },
      { to: "/cloud-security",      label: "Cloud",            icon: Cloud,       permission: "view:cloud" },
      { to: "/vulnerabilities",     label: "Vulnerabilities",  icon: Shield,      permission: "view:vulnerabilities" },
      { to: "/network",             label: "Network",          icon: Network,     permission: "view:network" },
    ],
  },
  {
    key: "investigate",
    label: "Investigate",
    features: [
      { to: "/attack-graph",    label: "Attack Graph",    icon: GitBranch, permission: "view:attack-graph" },
      { to: "/copilot",         label: "AI Copilot",      icon: Sparkles,  permission: "view:copilot" },
      { to: "/investigations",  label: "Investigations",  icon: BookOpen,  permission: "view:investigations" },
      { to: "/hunt",            label: "Threat Hunting",  icon: Crosshair, permission: "view:hunt" },
      { to: "/forensics",       label: "Forensics",       icon: FileSearch, permission: "view:forensics" },
      { to: "/timeline",        label: "Timeline",        icon: Activity,  permission: "view:timeline" },
    ],
  },
  {
    key: "analyze",
    label: "Analyze",
    features: [
      { to: "/security-graph",  label: "Security Graph",  icon: Network,   permission: "view:security-graph" },
      { to: "/query",           label: "Query Language",  icon: Terminal,  permission: "view:query" },
      { to: "/detection-rules", label: "Detection Rules", icon: Shield,    permission: "view:detection-rules" },
      { to: "/policies",        label: "Policy Engine",   icon: ListChecks, permission: "view:policies" },
    ],
  },
  {
    key: "govern",
    label: "Govern",
    features: [
      { to: "/compliance", label: "Compliance",    icon: ListChecks, permission: "view:compliance" },
      { to: "/audit",      label: "Audit Log",     icon: KeyRound,   permission: "view:audit" },
      { to: "/sso",        label: "SSO & Identity",icon: KeyRound,   permission: "view:sso" },
      { to: "/automation", label: "Automation",    icon: Workflow,   permission: "view:automation" },
      { to: "/ownership",  label: "Ownership",     icon: Users,      permission: "view:ownership" },
    ],
  },
  {
    key: "platform",
    label: "Platform",
    features: [
      { to: "/reports",            label: "Reports",         icon: FileText,  permission: "view:reports" },
      { to: "/developer",          label: "Developer",       icon: Code,      permission: "view:developer" },
      { to: "/status",             label: "System Status",   icon: Activity,  permission: "view:status" },
      { to: "/knowledge",          label: "Knowledge Base",  icon: BookOpen,  permission: "view:knowledge" },
      { to: "/platform-health",    label: "Platform Health", icon: Cpu,       permission: "view:platform-health" },
      { to: "/digital-twin",       label: "Digital Twin",    icon: Boxes,     permission: "view:digital-twin" },
      { to: "/attack-replay",      label: "Attack Replay",   icon: RotateCcw, permission: "view:attack-replay" },
      { to: "/threat-simulation",  label: "Simulation",      icon: Crosshair, permission: "view:threat-simulation" },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    features: [
      { to: "/organizations",  label: "Organization",   icon: Users,     permission: "manage:org" },
      { to: "/access-matrix",  label: "Access Matrix",  icon: Shield,    permission: "view:access-matrix" },
      { to: "/settings",       label: "Settings",       icon: Settings,  permission: "manage:settings" },
      { to: "/billing",        label: "Billing",        icon: BarChart3, permission: "manage:billing" },
      { to: "/onboarding",     label: "Onboarding",     icon: Rocket,    permission: "view:onboarding" },
      { to: "/integrations",   label: "Integrations",   icon: Plug,      permission: "manage:integrations" },
    ],
  },
];

/** Returns only the groups & features the given role can access. */
export function visibleGroupsForRole(role: Role | undefined): FeatureGroup[] {
  if (!role) return FEATURE_GROUPS;
  return FEATURE_GROUPS
    .map((g) => ({ ...g, features: g.features.filter((f) => can(role, f.permission)) }))
    .filter((g) => g.features.length > 0);
}

/** Flat list of all features the role can reach (handy for command palette). */
export function visibleFeaturesForRole(role: Role | undefined): Feature[] {
  return visibleGroupsForRole(role).flatMap((g) => g.features);
}
