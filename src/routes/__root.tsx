import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { useAutoSync } from "@/hooks/use-sync";
import { usePrecacheRoutes } from "@/hooks/use-precache-routes";
import {
  useDeadlineReminders,
  useStreakReminder,
  useGoalReminder,
} from "@/hooks/use-reminder-notifications";
import { useServiceWorkerUpdateNotice } from "@/hooks/use-sw-update";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeTour } from "@/components/WelcomeTour";
import { ByokPrompt } from "@/components/ByokPrompt";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";
import { ResearchConsentGate } from "@/components/ResearchConsentGate";
import { ResearchSurveyPrompt } from "@/components/ResearchSurveyPrompt";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-3">Page not found</p>
        <h1 className="font-display text-6xl font-medium text-foreground">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The page you are looking for is not part of this library.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-3">Something went wrong</p>
        <h1 className="font-display text-2xl font-medium text-foreground">
          This page did not load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again or head back to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              // reset() must wait for invalidate()'s re-run of the failed
              // loader to actually finish — clearing the error boundary
              // first (as this used to) could re-render with the same
              // stale error before the fresh attempt had resolved either
              // way, making the button look like it did nothing.
              void router.invalidate().finally(() => reset());
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "eLearn — Study anywhere, even offline" },
      {
        name: "description",
        content:
          "A mobile-first learning platform for university students. Download modules, generate AI summaries, and track progress — online or off.",
      },
      { name: "author", content: "eLearn" },
      { name: "theme-color", content: "#064e3b" },
      { property: "og:title", content: "eLearn — Study anywhere, even offline" },
      {
        property: "og:description",
        content:
          "Download modules on Wi-Fi, study offline at home. AI summaries, progress tracking, and a reading library that fits in your pocket.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "icon", href: "/icon-512.png", type: "image/png", sizes: "512x512" },
      // iOS doesn't read the manifest's icons list for "Add to Home
      // Screen" — it specifically needs its own apple-touch-icon link.
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Mounted once, inside AuthProvider (needs useAuth()) but outside any
// per-page component (needs to persist across navigation — see
// use-sync.ts's useAutoSync doc comment for why). Renders nothing.
function AutoSync() {
  useAutoSync();
  return null;
}

// Same "renders nothing, mounted once inside AuthProvider" shape as
// AutoSync above — see use-precache-routes.ts.
function PrecacheRoutes() {
  usePrecacheRoutes();
  return null;
}

// Same shape again — see use-reminder-notifications.ts. Two separate
// hooks (deadlines, streak) rather than one combined hook, since they
// read from unrelated data sources (assignments vs. activity events) and
// have nothing to share.
function ReminderNotifications() {
  useDeadlineReminders();
  useStreakReminder();
  useGoalReminder();
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed", err);
      });
    }
  }, []);

  useServiceWorkerUpdateNotice();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AutoSync />
        <PrecacheRoutes />
        <ReminderNotifications />
        <Outlet />
        <WelcomeTour />
        <ByokPrompt />
        <InstallAppPrompt />
        <ResearchConsentGate />
        <ResearchSurveyPrompt />
        <Toaster position="bottom-center" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
