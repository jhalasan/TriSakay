import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatReportDateTime } from './format.ts';
import { EMPTY_SECTION_TEXT, LETTERHEAD, OFFICIAL_COPY_NOTICE, OPEN_CASE_WATERMARK } from './letterhead.ts';
import type { ReportBlock, ReportLayoutOptions, ReportMeta, ReportModel, ReportSection } from './types.ts';

// A4 portrait, margins from the plan: 20 mm left and right, room at the top for the letterhead and at the bottom for the footer.
const MM = 2.8346;
const MARGIN_SIDE = Math.round(20 * MM); // 57 pt
const MARGIN_TOP = 112;
const MARGIN_BOTTOM = Math.round(24 * MM); // 68 pt
const CONTENT_WIDTH = 595.28 - MARGIN_SIDE * 2;

const NAVY = '#002E60';
const INK = '#1B2430';
const SOFT = '#5B6573';
const LINE = '#C9CFD8';
const BAR = '#E9EDF2';
const OPEN = '#B3261E';
const DONE = '#2F6B3A';

const FONT_BODY = 10;
const FONT_HEADING = 11;
const FONT_SMALL = 8;

/** pdfmake nodes are plain objects; its own union types reject some valid combinations (width on a column, unbreakable), so the layout builds loose nodes and casts once at the end. */
type Node = Record<string, unknown>;

function rule(width: number, color: string, lineWidth: number): Node {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth, lineColor: color }] };
}

/** Same on every page: the mark, the three office lines and a navy rule. */
function letterheadHeader(logoDataUrl?: string): Node {
  const logo: Node = logoDataUrl ? { image: logoDataUrl, width: 46, height: 46 } : { text: '', width: 46 };
  return {
    margin: [MARGIN_SIDE, 26, MARGIN_SIDE, 0],
    stack: [
      {
        columns: [
          { ...logo, width: 46 },
          {
            width: '*',
            stack: [
              { text: LETTERHEAD.line1, alignment: 'center', fontSize: 9, color: SOFT },
              { text: LETTERHEAD.line2, alignment: 'center', fontSize: 14, bold: true, color: NAVY, margin: [0, 1, 0, 1] },
              { text: LETTERHEAD.line3, alignment: 'center', fontSize: 8.5, color: SOFT },
            ],
          },
          { text: '', width: 46 },
        ],
        columnGap: 8,
      },
      { ...rule(CONTENT_WIDTH, NAVY, 1.4), margin: [0, 8, 0, 0] },
    ],
  };
}

/** Same on every page: document number, page count, who printed it and when, and the official copy notice. */
function documentFooter(meta: ReportMeta, currentPage: number, pageCount: number): Node {
  return {
    margin: [MARGIN_SIDE, 10, MARGIN_SIDE, 0],
    stack: [
      rule(CONTENT_WIDTH, LINE, 0.6),
      {
        columns: [
          { text: `Document No. ${meta.docNo}`, bold: true, fontSize: FONT_SMALL, color: INK },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: FONT_SMALL, color: INK },
        ],
        margin: [0, 4, 0, 1],
      },
      { text: `Printed by ${meta.printedByName}, ${meta.printedByRole} on ${formatReportDateTime(meta.printedAt)}`, fontSize: FONT_SMALL, color: SOFT },
      { text: OFFICIAL_COPY_NOTICE, fontSize: 7, italics: true, color: SOFT, margin: [0, 2, 0, 0] },
    ],
  };
}

function titleBand(model: ReportModel, meta: ReportMeta): Node {
  return {
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          {
            stack: [
              { text: model.title.toUpperCase(), fontSize: 15, bold: true, color: NAVY },
              { text: model.reference, fontSize: 9, color: SOFT, margin: [0, 2, 0, 0] },
            ],
          },
          {
            stack: [
              { text: meta.docNo, alignment: 'right', fontSize: 10, bold: true, color: INK },
              { text: model.status, alignment: 'right', fontSize: 9, bold: true, color: model.open ? OPEN : DONE, margin: [0, 2, 0, 0] },
            ],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0 : 1.2),
      hLineColor: () => NAVY,
      vLineWidth: () => 0,
      fillColor: () => BAR,
      paddingLeft: () => 10,
      paddingRight: () => 10,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
    margin: [0, 0, 0, 6],
  };
}

function sectionHeading(heading: string): Node {
  return {
    table: { widths: ['*'], body: [[{ text: heading, bold: true, fontSize: FONT_HEADING, color: NAVY }]] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      fillColor: () => BAR,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 12, 0, 5],
    // Keep the bar in one piece. pdfmake has no keep-with-next, so the sections below it start on the same page in practice.
    unbreakable: true,
  };
}

function renderBlock(block: ReportBlock): Node {
  switch (block.type) {
    case 'facts':
      return {
        table: {
          widths: [128, '*'],
          dontBreakRows: true,
          body: block.rows.map(([label, value]) => [
            { text: label, fontSize: 9, color: SOFT },
            { text: value || '—', fontSize: FONT_BODY, color: INK },
          ]),
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
          hLineColor: () => LINE,
          vLineWidth: () => 0,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
        margin: [0, 0, 0, 2],
      };
    case 'table':
      return {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: block.widths ?? block.columns.map(() => '*' as const),
          body: [
            block.columns.map((column) => ({ text: column, bold: true, fontSize: 9, color: NAVY, fillColor: BAR })),
            ...block.rows.map((row) => row.map((cell) => ({ text: cell || '—', fontSize: 9, color: INK }))),
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          hLineColor: () => LINE,
          vLineWidth: () => 0.5,
          vLineColor: () => LINE,
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
        margin: [0, 0, 0, 2],
      };
    case 'paragraph':
      return { text: block.text, fontSize: FONT_BODY, lineHeight: 1.25, color: INK, margin: [4, 2, 4, 4] };
    case 'image':
      return {
        stack: [
          { image: block.dataUrl, fit: [CONTENT_WIDTH - 8, 300], alignment: 'center' },
          { text: block.caption, fontSize: FONT_SMALL, color: SOFT, alignment: 'center', margin: [0, 3, 0, 0] },
        ],
        margin: [4, 4, 4, 6],
        unbreakable: true,
      };
    case 'qr':
      return {
        columns: [
          { qr: block.text, fit: 84, width: 84 },
          {
            width: '*',
            stack: [
              { text: block.caption, fontSize: 9, bold: true, color: INK },
              { text: block.text, fontSize: FONT_SMALL, color: SOFT, margin: [0, 3, 0, 0] },
            ],
            margin: [10, 14, 0, 0],
          },
        ],
        margin: [4, 2, 0, 4],
        unbreakable: true,
      };
  }
}

function renderSection(section: ReportSection): Node[] {
  const body: Node[] =
    section.blocks.length > 0
      ? section.blocks.map(renderBlock)
      : [{ text: section.emptyText ?? EMPTY_SECTION_TEXT, fontSize: FONT_BODY, italics: true, color: SOFT, margin: [4, 2, 4, 4] }];
  return [sectionHeading(section.heading), ...body];
}

/** Three signature lines. Prepared by is filled with the printing user; the other two are left blank for the officers. */
function signOff(meta: ReportMeta): Node {
  const column = (label: string, name?: string, detail?: string): Node => ({
    width: '*',
    stack: [
      { text: name ?? ' ', fontSize: FONT_BODY, bold: true, alignment: 'center', margin: [0, 26, 0, 0] },
      { ...rule(140, INK, 0.7), alignment: 'center', margin: [0, 2, 0, 3] },
      { text: label, fontSize: 9, bold: true, alignment: 'center' },
      { text: detail ?? 'Name, position and date', fontSize: 7.5, color: SOFT, alignment: 'center' },
    ],
  });
  return {
    unbreakable: true,
    margin: [0, 22, 0, 0],
    columns: [
      column('Prepared by', meta.printedByName, `${meta.printedByRole} · ${formatReportDateTime(meta.printedAt)}`),
      column('Noted by'),
      column('Received by'),
    ],
    columnGap: 14,
  };
}

/**
 * The whole PDF as a pdfmake document definition. Pure: no fonts, no files and no browser needed, so the
 * layout can be tested as plain data. downloadReportPdf (renderPdf.ts) turns it into a file.
 */
export function toDocDefinition(model: ReportModel, meta: ReportMeta, options: ReportLayoutOptions = {}): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [MARGIN_SIDE, MARGIN_TOP, MARGIN_SIDE, MARGIN_BOTTOM],
    info: {
      title: `${meta.docNo} ${model.title}`,
      author: meta.printedByName,
      subject: model.reference,
      creator: 'TriSakay',
    },
    defaultStyle: { font: 'Roboto', fontSize: FONT_BODY, color: INK },
    header: () => letterheadHeader(options.logoDataUrl) as unknown as Content,
    footer: (currentPage: number, pageCount: number) => documentFooter(meta, currentPage, pageCount) as unknown as Content,
    ...(model.open
      ? { watermark: { text: OPEN_CASE_WATERMARK, color: OPEN, opacity: 0.07, bold: true, italics: false, fontSize: 90 } }
      : {}),
    content: [titleBand(model, meta), ...model.sections.flatMap(renderSection), signOff(meta)] as unknown as Content[],
  };
}
