import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CloudDownload, Download } from "lucide-react";
import { usePersonalDocument, usePersonalDocumentFile } from "@/hooks/use-documents";

export const Route = createFileRoute("/documents/$docId/view")({
  head: () => ({
    meta: [
      { title: "View PDF — eLearn" },
      { name: "description", content: "View the original PDF exactly as uploaded." },
    ],
  }),
  component: DocumentViewPage,
});

/** Renders the original uploaded PDF via the browser's own native PDF
 * viewer (an <iframe> pointed at a local blob: URL) rather than any
 * custom rendering code — same proven pattern already used for Moodle
 * files (see courses.moodle.$courseId.tsx's FileViewer). Unlike that
 * one, the file here is already sitting in this device's own Dexie
 * cache (personalDocumentFiles) — no network fetch needed, just a
 * local object URL. Text extraction (pdf-extract.ts) and viewing are
 * deliberately separate concerns: this page shows the PDF exactly as
 * uploaded, unrelated to whatever the extractor did or didn't manage to
 * read out of it. */
function DocumentViewPage() {
  const { docId } = Route.useParams();
  const doc = usePersonalDocument(docId);
  const file = usePersonalDocumentFile(docId);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file.blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (doc === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3 px-5 py-4">
          <Link
            to="/documents/$docId"
            params={{ docId }}
            className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="truncate">{doc.title}</span>
          </Link>
          {objectUrl && file && (
            <a
              href={objectUrl}
              download={file.fileName}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-prestige-mid transition-colors hover:bg-secondary hover:text-prestige-deep active:scale-[0.94]"
              aria-label="Download"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
            </a>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {!file ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <CloudDownload className="h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              The original file isn't available on this device — it may not have been saved when
              this document was uploaded (usually due to low device storage at the time).
            </p>
          </div>
        ) : (
          objectUrl && <iframe src={objectUrl} title={doc.title} className="h-full w-full" />
        )}
      </div>
    </div>
  );
}
