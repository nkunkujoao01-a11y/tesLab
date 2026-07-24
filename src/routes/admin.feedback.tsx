import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { fetchAdminFeedback, type AdminFeedbackItem } from "@/lib/admin-console-api";
import { formatRelative } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/feedback")({
  component: AdminFeedbackPage,
});

function AdminFeedbackPage() {
  const [items, setItems] = useState<AdminFeedbackItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminFeedback()
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch((err) => {
        console.error("Failed to load admin feedback inbox", err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[760px]">
      <p className="eyebrow">Students</p>
      <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-prestige-deep">
        Feedback inbox
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Submitted from Profile &gt; Send feedback.
      </p>

      {error && (
        <p className="mt-5 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/30">
          Couldn't load the feedback inbox. Try refreshing.
        </p>
      )}

      {!error && items?.length === 0 && (
        <div className="animate-rise mt-6 rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
          <MessageSquareText className="mx-auto h-6 w-6 text-prestige-gold" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-muted-foreground">No feedback submitted yet.</p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {items?.map((item) => (
          <div key={item.id} className="animate-rise rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-prestige-deep">{item.fullName}</p>
              <p className="text-[10.5px] text-muted-foreground">
                {formatRelative(item.created_at)}
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/85">{item.message}</p>
            {item.imageUrls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.imageUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt=""
                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-border/60"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
