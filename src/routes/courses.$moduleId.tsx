import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/courses/$moduleId")({
  component: () => <Outlet />,
});
