// Lets an admin populate the "Add a material" form (heading/lead/body/pull)
// from a real uploaded file instead of hand-typing every field — see
// DEV_LOG.md, Feature 56. Reuses the same extraction/lead-derivation this
// app already relies on for personal documents (pdf-extract.ts,
// document-lead.ts) rather than inventing a second heuristic: a catalog
// material's `content` shape (heading/lead/body/pull) is just a different
// *storage* convention for the same kind of editorial structure a personal
// document already gets derived for it at read time.
import { extractPdfText } from "@/lib/pdf-extract";
import { ocrImageFile } from "@/lib/pdf-ocr";
import { deriveDocumentLead } from "@/lib/document-lead";

export type ExtractedMaterialFields = {
  heading: string;
  lead: string;
  body: string;
  pull: string;
  pageCount: number;
  sizeMb: number;
};

const HEADING_LINE_PATTERN = /^#{1,2}\s+(.+)$/;

function stripBlockMarker(block: string): string {
  return block.replace(/^(#{1,2}|-)\s+/, "").trim();
}

const DOCX_EXTENSION = /\.docx$/i;
const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|bmp)$/i;

/** Extracts plain text from a .docx file via mammoth — dynamically
 * imported (browser-only, same "keep it out of the SSR bundle" reasoning
 * as pdf-extract.ts's own dynamic imports). Only `extractRawText`, not
 * `convertToHtml`: this app's own `#`/`##`/`- ` structure convention
 * isn't something mammoth produces either way, so there's nothing extra
 * to gain from its richer HTML output here — same flat-text degrade as
 * OCR output below, left for the admin to add real structure to by hand
 * if the source document had any worth preserving. */
async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/** Reads raw text from a PDF, Word document, image, Markdown, or
 * plain-text file. Markdown/text files are read as-is — a `.md` file
 * already uses the same `#`/`##`/`- ` convention pdf-extract.ts produces,
 * so no separate parser is needed; a `.txt` file just has no structure
 * markers, which the fallbacks below handle the same way a heading-less
 * PDF page would. Word documents and images (a photographed handout, a
 * scanned page) both come back as flat, unstructured prose — an honest
 * degrade, not a lesser version of the same structure detection PDFs get
 * (see extractDocxText/ocrImageFile's own comments for why). */
async function readRawText(file: File): Promise<{ text: string; pageCount: number }> {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  if (isPdf) {
    const { text, pageCount } = await extractPdfText(file);
    return { text, pageCount };
  }
  if (DOCX_EXTENSION.test(name)) {
    const text = await extractDocxText(file);
    return { text, pageCount: 1 };
  }
  if (file.type.startsWith("image/") || IMAGE_EXTENSION.test(name)) {
    const text = await ocrImageFile(file);
    return { text, pageCount: 1 };
  }
  const text = await file.text();
  return { text, pageCount: 1 };
}

/** Extracts heading/lead/body/pull from a real uploaded file, ready to
 * pre-fill (and let the admin review/edit) the manual material form — not
 * a silent black box, since a lecturer should still confirm what a
 * heuristic derived before it goes live for every student in the module. */
export async function extractMaterialFields(file: File): Promise<ExtractedMaterialFields> {
  const { text, pageCount } = await readRawText(file);
  const blocks = text.split(/\n\n+/).filter((b) => b.trim());

  const headingIndex = blocks.findIndex((b) => HEADING_LINE_PATTERN.test(b.trim()));
  let heading: string;
  let remainingBlocks: string[];
  if (headingIndex === -1) {
    // No real heading found — fall back to the filename, same "don't
    // fabricate, use what's actually there" rule the rest of this app's
    // extraction pipeline already follows.
    heading = file.name.replace(/\.[^.]+$/, "");
    remainingBlocks = blocks;
  } else {
    heading = blocks[headingIndex].trim().match(HEADING_LINE_PATTERN)![1].trim();
    remainingBlocks = [...blocks.slice(0, headingIndex), ...blocks.slice(headingIndex + 1)];
  }

  const { lead, pullQuote, bodyText } = deriveDocumentLead(remainingBlocks.join("\n\n"));

  const body = bodyText.split(/\n\n+/).map(stripBlockMarker).filter(Boolean).join("\n\n");

  return {
    heading,
    lead: lead ?? "",
    body,
    pull: pullQuote ?? "",
    pageCount,
    sizeMb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
  };
}
