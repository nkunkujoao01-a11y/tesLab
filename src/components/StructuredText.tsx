type StructuredTextProps = {
  text: string;
  className?: string;
};

// Reverses escapeTableCell's `|` → `\|` guard from pdf-extract.ts so a cell
// that genuinely contained a pipe character renders as the real text
// again, not the escaped form.
function unescapeTableCell(cell: string): string {
  return cell.replace(/\\\|/g, "|");
}

/** Parses one GFM-style pipe-table block (as emitted by pdf-extract.ts's
 * detectTableRows/formatStructuredText) into header + body rows. Plain
 * string splitting, not a Markdown table parser — this only ever needs to
 * read the one exact shape this app's own extractor produces (a header
 * row, a `---` separator row, then body rows), not arbitrary GFM tables
 * from elsewhere. */
function parseTableBlock(block: string): { header: string[]; rows: string[][] } {
  // Split on "|" only when it isn't escaped ("\|", a real pipe character
  // inside a cell's own text — see escapeTableCell) — a plain `split("|")`
  // would incorrectly treat that escaped pipe as another column boundary.
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
  return { header: header ?? [], rows };
}

/** Renders extracted document text with the lightweight Markdown-style
 * structure `src/lib/pdf-extract.ts` produces — `#`/`##` become real
 * headings, consecutive `-` blocks become one real bullet list, a
 * `|`-prefixed block becomes a real `<table>` (see parseTableBlock),
 * everything else stays a paragraph. Plain string matching, not a Markdown
 * library:
 * the extractor only ever emits this one small, known vocabulary, so a
 * full parser would be unused surface area, not extra safety. Falls back
 * to plain paragraphs for any text that has none of these prefixes (older
 * documents extracted before this existed, or a PDF with unusually
 * uniform styling that the classifier read as all body text) — still
 * correct, just unstructured, same as before this feature existed. */
export function StructuredText({ text, className }: StructuredTextProps) {
  const blocks = text.split(/\n\n+/).filter((b) => b.trim());
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="list-disc space-y-1.5 pl-5">
        {bulletBuffer.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  for (const block of blocks) {
    if (block.startsWith("- ")) {
      bulletBuffer.push(block.slice(2));
      continue;
    }
    if (block.startsWith("| ")) {
      flushBullets();
      const { header, rows } = parseTableBlock(block);
      elements.push(
        <div key={`table-${elements.length}`} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((cell, i) => (
                  <th
                    key={i}
                    className="border-b border-prestige-deep/20 px-2 py-1 text-left font-medium"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-b border-prestige-deep/10 px-2 py-1">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    flushBullets();
    if (block.startsWith("## ")) {
      elements.push(
        <h3
          key={elements.length}
          className="mt-2 font-display text-base font-medium text-prestige-deep"
        >
          {block.slice(3)}
        </h3>,
      );
    } else if (block.startsWith("# ")) {
      elements.push(
        <h2
          key={elements.length}
          className="mt-3 font-display text-xl font-medium text-prestige-deep"
        >
          {block.slice(2)}
        </h2>,
      );
    } else {
      elements.push(<p key={elements.length}>{block}</p>);
    }
  }
  flushBullets();

  return <div className={className}>{elements}</div>;
}
