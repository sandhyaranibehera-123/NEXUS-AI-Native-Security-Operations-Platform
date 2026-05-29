import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { InspectorPanel } from "@/components/inspector-panel";
import { AccessDenied } from "@/components/access-denied";
import { useAuth } from "@/lib/auth-store";
import { can, permissionForPath } from "@/lib/rbac";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const user = useAuth((s) => s.user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);

  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  if (mounted && !user) {
    return <Navigate to="/login" />;
  }

  const required = permissionForPath(pathname);
  const allowed = !user || !required || can(user.role, required);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 min-w-0">
          {allowed ? (
            <Outlet />
          ) : (
            user && required && <AccessDenied role={user.role} permission={required} path={pathname} />
          )}
        </main>
      </div>
      <InspectorPanel />
    </div>
  );
}
