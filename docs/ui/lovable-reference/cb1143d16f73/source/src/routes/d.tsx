import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DesktopShell } from "@/widgets/desktop-shell/ui";

export const Route = createFileRoute("/d")({
  component: () => (
    <DesktopShell>
      <Outlet />
    </DesktopShell>
  ),
});
