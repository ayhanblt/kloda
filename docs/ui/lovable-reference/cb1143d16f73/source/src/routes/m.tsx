import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MobileShell } from "@/widgets/mobile-shell/ui";

export const Route = createFileRoute("/m")({
  component: () => (
    <MobileShell>
      <Outlet />
    </MobileShell>
  ),
});
