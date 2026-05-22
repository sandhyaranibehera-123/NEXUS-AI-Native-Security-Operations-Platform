export type Role =
  | "super_admin"
  | "security_admin"
  | "soc_analyst"
  | "threat_hunter"
  | "incident_responder"
  | "compliance_officer"
  | "viewer";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  security_admin: "Security Admin",
  soc_analyst: "SOC Analyst",
  threat_hunter: "Threat Hunter",
  incident_responder: "Incident Responder",
  compliance_officer: "Compliance Officer",
  viewer: "Viewer",
};

export type Permission =
  | "view:dashboard"
  | "view:events"
  | "view:incidents"
  | "act:incidents"
  | "view:compliance"
  | "view:audit"
  | "manage:integrations"
  | "manage:org"
  | "manage:settings";

const ALL: Permission[] = [
  "view:dashboard", "view:events", "view:incidents", "act:incidents",
  "view:compliance", "view:audit", "manage:integrations", "manage:org", "manage:settings",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ALL,
  security_admin: ALL.filter(p => p !== "manage:org"),
  soc_analyst: ["view:dashboard", "view:events", "view:incidents", "act:incidents", "view:audit"],
  threat_hunter: ["view:dashboard", "view:events", "view:incidents", "view:audit"],
  incident_responder: ["view:dashboard", "view:incidents", "act:incidents", "view:events"],
  compliance_officer: ["view:dashboard", "view:compliance", "view:audit"],
  viewer: ["view:dashboard", "view:events", "view:incidents", "view:compliance"],
};

export function can(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(perm);
}
