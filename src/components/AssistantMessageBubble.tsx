// The assistant-side chat bubble, shared across every AI chat surface
// (assistant.tsx, documents.$docId.chat.tsx,
// documents.collections.$collectionId.chat.tsx,
// courses.$moduleId.chat.$docId.tsx, courses.$moduleId.chat.index.tsx) —
// these were byte-for-byte identical divs wrapping <StructuredText>
// duplicated in all five; a single shared component avoids five diverging
// copies now that it also carries the copy-to-clipboard button. Reuses
// the same navigator.clipboard.writeText(...).then(...).catch(...)
// pattern already used for "Copy full summary" elsewhere in this app
// (documents.$docId.summary.tsx), just as a small icon-only affordance
// rather than a prominent CTA button, since this appears under every
// single message rather than once per page.
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { StructuredText } from "@/components/StructuredText";

export function AssistantMessageBubble({
  content,
  showCopy = true,
}: {
  content: string;
  // false while a response is still streaming in — nothing useful to
  // copy yet, and the button would just be confusing mid-generation.
  showCopy?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Couldn't copy. Try selecting the text instead."));
  };

  return (
    <div className="max-w-[80%] rounded-2xl bg-card px-4 py-2.5 text-sm leading-relaxed text-foreground/90 ring-1 ring-border/60">
      <StructuredText text={content} className="space-y-2" />
      {showCopy && content && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy response"}
          className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? (
            <Check className="h-3 w-3" strokeWidth={2} />
          ) : (
            <Copy className="h-3 w-3" strokeWidth={2} />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}
