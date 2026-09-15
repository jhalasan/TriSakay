/**
 * P2 (2026-09-15 launch audit): a field beginning with =, +, -, or @ is
 * interpreted as a formula by Excel/Sheets/LibreOffice when the CSV is
 * opened — a free-text field this app exports verbatim (AuditLog.tsx's
 * "Reason", entered by any PSO Staff account) could otherwise carry a
 * formula that executes on the reviewer's machine when they open the
 * export. Standard mitigation (OWASP CSV Injection): prefix with a single
 * quote, which Excel/Sheets treat as "force text" and hide from the
 * rendered cell.
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

/** Escapes a CSV field per RFC 4180: wrap in quotes and double any embedded quote whenever the value contains a comma, quote, or newline. */
function escapeCsvField(value: string): string {
  const safe = neutralizeFormula(value);
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsvField(String(c.value(row)))).join(','));
  return [header, ...lines].join('\r\n');
}

/**
 * Triggers a browser download of `content` as a file — the only DOM-touching
 * function in this module, kept isolated so the CSV formatting above stays
 * unit-testable. Returns the object URL so a caller can also offer it via
 * the export success toast's "Open" link (README §12); the URL stays valid
 * for two minutes, then is revoked rather than held forever.
 */
export function downloadCsv(filename: string, content: string): string {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return url;
}
