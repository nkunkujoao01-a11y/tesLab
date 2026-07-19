import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout: the actual collection detail page lives in
// documents.collections.$collectionId.index.tsx, and the collection-scoped
// chat page (Phase I2) lives in documents.collections.$collectionId.chat.tsx
// — this route's only job is delegating to whichever matches via <Outlet/>.
// Same routing fix as DEV_LOG.md's "courses.$moduleId routing bug": a
// parent route that renders real content instead of <Outlet/> silently
// prevents any nested child route from ever mounting.
export const Route = createFileRoute("/documents/collections/$collectionId")({
  component: () => <Outlet />,
});
