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
      <p className="font-console-mono text-[11px] uppercase tracking-widest text-console-text-faint">
        Students
      </p>
      <h1 className="mt-1 font-console-mono text-[22px] font-semibold tracking-tight text-console-text">
        Feedback inbox
      </h1>
      <p className="mt-1 text-[12px] text-console-text-dim">
        Submitted from Profile &gt; Send feedback.
      </p>

      {error && (
        <p className="mt-5 rounded-lg border border-console-critical/40 bg-console-critical/10 p-4 text-sm text-console-critical">
          Couldn't load the feedback inbox. Try refreshing.
        </p>
      )}

      {!error && items?.length === 0 && (
        <div className="mt-6 rounded-lg border border-console-border bg-console-surface p-8 text-center">
          <MessageSquareText
            className="mx-auto h-6 w-6 text-console-text-faint"
            strokeWidth={1.5}
          />
          <p className="mt-3 text-sm text-console-text-dim">No feedback submitted yet.</p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {items?.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-console-border bg-console-surface p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12.5px] font-medium text-console-text">{item.fullName}</p>
              <p className="font-console-mono text-[10.5px] text-console-text-faint">
                {formatRelative(item.created_at)}
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-console-text-dim">{item.message}</p>
            {item.imageUrls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.imageUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt=""
                      className="h-20 w-20 rounded-md border border-console-border object-cover"
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
