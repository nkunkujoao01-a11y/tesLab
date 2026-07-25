// Generic CSV building for admin/super-admin data exports (e.g. research
// consent/survey data for presentation) — plain string-building, no
// dependency, since a CSV is simple enough not to need one.

const UTF8_BOM = String.fromCharCode(0xfeff);

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Quote only when needed (contains a comma, quote, or newline) — RFC
  // 4180's own rule, keeps most cells clean/unquoted in the output.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Builds a complete CSV string from a header row + data rows. A leading
 * UTF-8 BOM is included so Excel (which otherwise guesses the wrong
 * encoding for non-ASCII characters) opens it correctly. */
export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return `${UTF8_BOM}${lines.join("\r\n")}`;
}
