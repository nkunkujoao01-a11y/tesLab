// Exports a document's structured text (the same `#`/`##`/`-` markup
// StructuredText.tsx renders) as a standalone, styled HTML file — download
// it and open it anywhere, real headings and bullets intact, with no extra
// tooling needed. A plain string-builder mirroring StructuredText's own
// block-parsing logic, not a react-dom/server render — this only ever
// needs to stringify three known block shapes, so pulling in a whole
// server-rendering entry point for it would be more than this needs.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Reverses escapeTableCell's `|` → `\|` guard from pdf-extract.ts, same as
// StructuredText.tsx's own copy of this — see that file's comment for why
// a plain `split("|")` isn't safe here.
function unescapeTableCell(cell: string): string {
  return cell.replace(/\\\|/g, "|");
}

function renderTableBlock(block: string): string {
  const rowsRaw = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((cell) => unescapeTableCell(cell.trim())),
    );
  const [header, , ...rows] = rowsRaw;
  const headHtml = `<tr>${(header ?? []).map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;
  const bodyHtml = rows
    .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead>${headHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
}

function renderBlocksToHtml(text: string): string {
  const blocks = text.split(/\n\n+/).filter((b) => b.trim());
  const html: string[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    html.push(`<ul>${bulletBuffer.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
    bulletBuffer = [];
  };

  for (const block of blocks) {
    if (block.startsWith("- ")) {
      bulletBuffer.push(block.slice(2));
      continue;
    }
    if (block.startsWith("| ")) {
      flushBullets();
      html.push(renderTableBlock(block));
      continue;
    }
    flushBullets();
    if (block.startsWith("## ")) {
      html.push(`<h3>${escapeHtml(block.slice(3))}</h3>`);
    } else if (block.startsWith("# ")) {
      html.push(`<h2>${escapeHtml(block.slice(2))}</h2>`);
    } else {
      html.push(`<p>${escapeHtml(block)}</p>`);
    }
  }
  flushBullets();
  return html.join("\n");
}

/** Builds a complete, self-contained HTML document (inline styles, no
 * external requests) from a document's title and extracted structured
 * text — ready to hand to a Blob download. */
export function buildStructuredExportHtml(title: string, text: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 680px; margin: 3rem auto; padding: 0 1.5rem 4rem; line-height: 1.7; color: #16281f; background: #f5f0e0; }
  h1 { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 1.9rem; color: #064e3b; margin-bottom: 2rem; }
  h2 { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 1.4rem; color: #064e3b; margin-top: 2rem; }
  h3 { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 1.1rem; color: #064e3b; margin-top: 1.5rem; }
  ul { padding-left: 1.4rem; }
  li { margin: 0.3rem 0; }
  p { margin: 1rem 0; }
  table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; font-size: 0.95rem; }
  th, td { border-bottom: 1px solid rgba(6, 78, 59, 0.2); padding: 0.4rem 0.6rem; text-align: left; }
  th { font-family: -apple-system, "Segoe UI", sans-serif; font-weight: 600; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${renderBlocksToHtml(text)}
</body>
</html>
`;
}

/** Triggers a real browser download of `blob` under `fileName` — a
 * synthetic anchor click, the standard way to do this without a server
 * round-trip, used for both the original-PDF and structured-export
 * downloads. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** True when this browser can actually share a *file* via the native
 * share sheet (`navigator.canShare({ files })`) — not just the older
 * text/url-only `navigator.share`, which exists on some desktop browsers
 * but can't take the file itself. Primarily true on mobile Chrome/Safari;
 * false on most desktop browsers, where a plain download is the better
 * (and only) option anyway. */
export function canShareFiles(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator &&
    navigator.canShare({ files: [new File([""], "test.txt")] })
  );
}

/** Shares `blob` via the OS-native share sheet when the browser supports
 * it (see canShareFiles), falling back to a plain download otherwise —
 * one call site for every "Download this" button in the app, so a
 * student on a phone gets "Share to WhatsApp/Files/etc." instead of only
 * ever landing in a Downloads folder they may not check. A user
 * cancelling the share sheet throws a benign AbortError — that's a normal
 * outcome, not a failure, so it's swallowed rather than falling back to a
 * download the student never asked for. */
export async function shareOrDownloadBlob(
  blob: Blob,
  fileName: string,
  shareTitle?: string,
): Promise<void> {
  if (canShareFiles()) {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: shareTitle });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Native share failed, falling back to download", err);
      }
    }
  }
  downloadBlob(blob, fileName);
}
