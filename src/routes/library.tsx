import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Layers, ListChecks, Folder, FileQuestion } from "lucide-react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { usePersonalDocuments, useDocumentCollections } from "@/hooks/use-documents";
import { useAllFlashcardSets, useAllQuizzes } from "@/hooks/use-quiz";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Quiz & flashcard library — eLearn" },
      {
        name: "description",
        content: "Every quiz and flashcard set you've generated, in one place.",
      },
    ],
  }),
  component: QuizLibrary,
});

/** Browse every generated quiz/flashcard set across all documents, grouped
 * the same way documents.index.tsx already groups documents themselves —
 * by DocumentCollection. This is the only grouping that exists today:
 * GeneratedFlashcardSet/GeneratedQuiz are keyed purely by docId, with no
 * link to the catalog's Course/Module hierarchy (that's a separate,
 * lecturer-authored system — module_quizzes — unrelated to this
 * student-generated content). A true "by catalog module" view would need
 * a future schema change linking PersonalDocument to a module; this ships
 * with what already exists rather than waiting on that. */
function QuizLibrary() {
  const docs = usePersonalDocuments();
  const collections = useDocumentCollections();
  const flashcardSets = useAllFlashcardSets();
  const quizzes = useAllQuizzes();

  const hasContent = (docId: string) =>
    flashcardSets.some((s) => s.docId === docId && s.cards.length > 0) ||
    quizzes.some((q) => q.docId === docId && q.questions.length > 0);

  const docsWithContent = docs.filter((doc) => hasContent(doc.id));
  const uncategorized = docsWithContent.filter((doc) => !doc.collectionId);
  const byCollection = (collectionId: string) =>
    docsWithContent.filter((doc) => doc.collectionId === collectionId);

  const counts = (docId: string) => ({
    cards: flashcardSets.find((s) => s.docId === docId)?.cards.length ?? 0,
    questions: quizzes.find((q) => q.docId === docId)?.questions.length ?? 0,
  });

  const DocRow = ({ doc }: { doc: (typeof docsWithContent)[number] }) => {
    const { cards, questions } = counts(doc.id);
    return (
      <Link
        to="/documents/$docId"
        params={{ docId: doc.id }}
        className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-border/60 transition-all hover:-translate-y-0.5 hover:ring-prestige-gold/40"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
          <FileQuestion className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-prestige-deep">{doc.title}</p>
          <p className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            {cards > 0 && (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" strokeWidth={1.75} />
                {cards} card{cards === 1 ? "" : "s"}
              </span>
            )}
            {questions > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-3 w-3" strokeWidth={1.75} />
                {questions} question{questions === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>
      </Link>
    );
  };

  return (
    <MobileShell>
      <div className="px-6 pt-6 lg:px-10 lg:pt-8">
        <Link
          to="/courses"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Library
        </Link>
      </div>
      <PageHeader eyebrow="Library" title="Your quizzes & flashcards" />

      <div className="px-6 pb-16 lg:px-10">
        {docsWithContent.length === 0 ? (
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <FileQuestion className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">Nothing generated yet</p>
            <p className="mt-2 max-w-[40ch] mx-auto text-sm text-muted-foreground">
              Open a document and generate flashcards or a quiz — they'll show up here afterward,
              grouped by collection.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {collections.map((collection) => {
              const collectionDocs = byCollection(collection.id);
              if (collectionDocs.length === 0) return null;
              return (
                <div key={collection.id}>
                  <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-prestige-deep">
                    <Folder className="h-3.5 w-3.5 text-prestige-mid" strokeWidth={1.75} />
                    {collection.name}
                  </h2>
                  <ul className="space-y-3">
                    {collectionDocs.map((doc) => (
                      <li key={doc.id}>
                        <DocRow doc={doc} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {uncategorized.length > 0 && (
              <div>
                {collections.length > 0 && (
                  <h2 className="mb-3 font-display text-sm font-semibold text-prestige-deep">
                    Not in a collection
                  </h2>
                )}
                <ul className="space-y-3">
                  {uncategorized.map((doc) => (
                    <li key={doc.id}>
                      <DocRow doc={doc} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
