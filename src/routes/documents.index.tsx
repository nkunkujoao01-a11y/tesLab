import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileText,
  Folder,
  FolderPlus,
  Upload,
  Loader2,
  Trash2,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { formatMb, formatRelative } from "@/lib/mock-data";
import {
  usePersonalDocuments,
  useUploadDocument,
  useDeletePersonalDocument,
  useDocumentCollections,
  useCreateCollection,
  useStalePdfExtractionWarning,
} from "@/hooks/use-documents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/documents/")({
  head: () => ({
    meta: [
      { title: "My documents — eLearn" },
      {
        name: "description",
        content: "Upload your own PDFs — extracted and summarised entirely on this device.",
      },
    ],
  }),
  component: DocumentsIndex,
});

function NewCollectionDialog() {
  const { createCollection } = useCreateCollection();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    await createCollection(name);
    setCreating(false);
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.97]"
      >
        <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        New collection
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Group related documents together — e.g. everything for one course.
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
          placeholder="e.g. Botany 210"
          className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-prestige-gold"
        />
        <button
          type="button"
          disabled={!name.trim() || creating}
          onClick={() => void handleCreate()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> : null}
          Create
        </button>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsIndex() {
  const docs = usePersonalDocuments();
  const collections = useDocumentCollections();
  const { upload, status, progress } = useUploadDocument();
  const { deleteDocument } = useDeletePersonalDocument();
  const staleExtraction = useStalePdfExtractionWarning();

  const uncategorized = docs.filter((doc) => !doc.collectionId);
  const countInCollection = (collectionId: string) =>
    docs.filter((doc) => doc.collectionId === collectionId).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void upload(file);
  };

  return (
    <MobileShell>
      <PageHeader
        eyebrow="My documents"
        title="Your own PDFs, extracted on-device"
        action={
          <div>
            {/* No `accept` filter — real Android testing found it can hide
             * or block genuine PDFs from the native picker entirely
             * (some storage providers don't report a MIME type the
             * filter recognizes), which reads as "the app doesn't accept
             * PDFs" even though a real PDF was picked. Any non-PDF that
             * slips through already gets a clear, specific error from
             * extractPdfText (pdf-extract.ts) instead. */}
            <input
              id="documents-pdf-upload"
              type="file"
              className="sr-only"
              onChange={handleFileChange}
              disabled={status === "extracting"}
            />
            {/* A <label htmlFor> associated with the input, not a separate
             * button proxying a ref .click() — real Android testing found
             * the button+ref pattern's file picker sometimes never fired
             * its own change event afterward (a known Android PWA/Chrome
             * quirk with JS-triggered file inputs specifically); a native
             * label association is the standard, more broadly reliable
             * fix, and needs no JS click handler at all. */}
            <label
              htmlFor="documents-pdf-upload"
              className={`inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-transform active:scale-[0.97] ${
                status === "extracting" ? "pointer-events-none opacity-60" : "cursor-pointer"
              }`}
            >
              {status === "extracting" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {status === "extracting"
                ? progress
                  ? `Extracting ${progress.page}/${progress.totalPages}…`
                  : "Reading…"
                : "Upload PDF"}
            </label>
          </div>
        }
      />

      <div className="px-6 lg:px-10 lg:pb-16">
        {staleExtraction && (
          <div className="animate-rise mb-6 flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <p>
              The upload of "{staleExtraction.fileName}" didn't finish last time — this can happen
              if the app closed or crashed partway through. Try again, ideally with a smaller file;
              if it keeps happening, testing with the device plugged into a computer (via Chrome's
              remote inspector) will show the real error.
            </p>
          </div>
        )}
        <p className="mb-6 max-w-[52ch] text-sm text-muted-foreground">
          Upload lecture notes or readings you already have as PDFs. Text is extracted right on this
          device — nothing is sent anywhere except your own account's storage, and it works offline
          once uploaded.
        </p>

        {/* Collections */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-prestige-deep">Collections</h2>
            <NewCollectionDialog />
          </div>
          {collections.length > 0 && (
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection) => (
                <li key={collection.id}>
                  <Link
                    to="/documents/collections/$collectionId"
                    params={{ collectionId: collection.id }}
                    className="group flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-border/60 transition-all hover:-translate-y-0.5 hover:ring-prestige-gold/40"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                      <Folder className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-prestige-deep">
                        {collection.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {countInCollection(collection.id)} document
                        {countInCollection(collection.id) === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-prestige-gold opacity-0 transition-opacity group-hover:opacity-100"
                      strokeWidth={2}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Uncategorized documents */}
        {docs.length === 0 ? (
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <FileText className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">No documents yet</p>
            <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
              Upload a PDF to get started — it'll show up here, fully readable and summarisable
              offline.
            </p>
          </div>
        ) : (
          <>
            {collections.length > 0 && (
              <h2 className="mb-3 font-display text-sm font-semibold text-prestige-deep">
                Not in a collection
              </h2>
            )}
            {uncategorized.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every document is filed into a collection.
              </p>
            ) : (
              <ul className="space-y-3">
                {uncategorized.map((doc, i) => (
                  <li
                    key={doc.id}
                    className="animate-rise"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-border/60 transition-colors hover:ring-prestige-gold/40">
                      <Link to="/documents/$docId" params={{ docId: doc.id }} className="contents">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                          <FileText className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-prestige-deep">
                            {doc.title}
                          </p>
                          <p className="text-[11px] uppercase tracking-widest text-prestige-mid/70">
                            {doc.pageCount} pages · {formatMb(doc.sizeMb)} ·{" "}
                            {formatRelative(new Date(doc.uploadedAt).toISOString())}
                          </p>
                        </div>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Delete ${doc.title}`}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-all hover:text-destructive active:scale-90"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {doc.title} and its extracted text will be permanently removed. This
                              can't be undone — you'd need to upload the PDF again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void deleteDocument(doc.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
}
