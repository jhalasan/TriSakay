/** What a printed report is made of. The builders (complaint, SOS) produce a ReportModel; pdfLayout turns it into a PDF. */
export type ReportKind = 'complaint' | 'sos_alert';

export type ReportBlock =
  /** Label and value pairs, shown as a two column table. */
  | { type: 'facts'; rows: [label: string, value: string][] }
  /** A bordered table with a header row that repeats on every page. */
  | { type: 'table'; columns: string[]; rows: string[][]; widths?: (number | '*' | 'auto')[] }
  | { type: 'paragraph'; text: string }
  /** A QR code with a caption, for example the map link of an SOS alert. */
  | { type: 'qr'; text: string; caption: string };

export interface ReportSection {
  heading: string;
  blocks: ReportBlock[];
  /** Shown instead of the blocks when there are none (for example "No evidence was attached."). */
  emptyText?: string;
}

export interface ReportModel {
  kind: ReportKind;
  /** e.g. "Complaint Case Report". Printed in capitals in the title band. */
  title: string;
  /** e.g. "Ref. #A1B2". */
  reference: string;
  /** e.g. "Under review". */
  status: string;
  /** A case that is not finished yet. Adds the "OPEN CASE" watermark. */
  open: boolean;
  sections: ReportSection[];
}

/** What the database returns when a print is recorded (see recordCasePrint) plus the label of the printer's role. */
export interface ReportMeta {
  docNo: string;
  printedAt: string;
  printedByName: string;
  printedByRole: string;
}

export interface ReportLayoutOptions {
  /** The TriSakay mark as a data URL (png). Left out of the letterhead when missing. */
  logoDataUrl?: string;
}
