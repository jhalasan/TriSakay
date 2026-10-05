import test from 'node:test';
import assert from 'node:assert/strict';
import { toDocDefinition } from '../src/lib/reports/pdfLayout.ts';
import type { ReportMeta, ReportModel } from '../src/lib/reports/types.ts';

const META: ReportMeta = {
  docNo: 'PSO-CMP-2026-000123',
  printedAt: '2026-10-05T07:15:00.000Z',
  printedByName: 'Rina Cabuslay',
  printedByRole: 'PSO Supervisor',
};

function model(overrides: Partial<ReportModel> = {}): ReportModel {
  return {
    kind: 'complaint',
    title: 'Complaint Case Report',
    reference: 'Ref. #A1B2',
    status: 'Under review',
    open: true,
    sections: [
      { heading: 'Parties', blocks: [{ type: 'facts', rows: [['Complainant', 'Ana Reyes'], ['Respondent', 'Juan Cruz']] }] },
      { heading: 'Evidence', blocks: [], emptyText: 'No evidence was attached.' },
    ],
    ...overrides,
  };
}

const text = (value: unknown) => JSON.stringify(value);

test('the page is A4 with 20 mm side margins and room for the letterhead and footer', () => {
  const def = toDocDefinition(model(), META);
  assert.equal(def.pageSize, 'A4');
  assert.equal(def.pageOrientation, 'portrait');
  const [left, top, right, bottom] = def.pageMargins as [number, number, number, number];
  assert.equal(left, 57);
  assert.equal(right, 57);
  assert.ok(top >= 100, 'top margin leaves room for the letterhead');
  assert.ok(bottom >= 57, 'bottom margin leaves room for the footer');
});

test('every page header carries the letterhead wording, and the logo only when one is given', () => {
  const withLogo = toDocDefinition(model(), META, { logoDataUrl: 'data:image/png;base64,AAAA' });
  const withoutLogo = toDocDefinition(model(), META);

  for (const def of [withLogo, withoutLogo]) {
    const header = (def.header as (page: number, count: number) => unknown)(3, 5);
    const body = text(header);
    assert.match(body, /City Government of General Santos/);
    assert.match(body, /Public Safety Office \(PSO\)/);
    assert.match(body, /TriSakay Tricycle Ride-Hailing System/);
  }
  assert.match(text((withLogo.header as any)(1, 1)), /data:image\/png;base64,AAAA/);
  assert.doesNotMatch(text((withoutLogo.header as any)(1, 1)), /data:image/);
});

test('every page footer has the document number, who printed it in Manila time, the page count and the official copy notice', () => {
  const def = toDocDefinition(model(), META);
  const footer = text((def.footer as (page: number, count: number) => unknown)(2, 5));
  assert.match(footer, /Document No\. PSO-CMP-2026-000123/);
  assert.match(footer, /Printed by Rina Cabuslay, PSO Supervisor on 5 October 2026, 3:15 PM/);
  assert.match(footer, /Page 2 of 5/);
  assert.match(footer, /Official copy generated from TriSakay\. Alteration makes this copy invalid\./);
});

test('the title band shows the title in capitals, the reference, the document number and the status', () => {
  const body = text(toDocDefinition(model(), META).content);
  assert.match(body, /COMPLAINT CASE REPORT/);
  assert.match(body, /Ref\. #A1B2/);
  assert.match(body, /PSO-CMP-2026-000123/);
  assert.match(body, /Under review/);
});

test('an open case gets the OPEN CASE watermark and a finished case does not', () => {
  const open = toDocDefinition(model({ open: true }), META);
  const closed = toDocDefinition(model({ open: false }), META);
  assert.equal((open.watermark as { text: string }).text, 'OPEN CASE');
  assert.equal(closed.watermark, undefined);
});

test('a section with nothing to show prints its own "none" line instead of an empty gap', () => {
  const body = text(toDocDefinition(model(), META).content);
  assert.match(body, /No evidence was attached\./);

  const generic = text(toDocDefinition(model({ sections: [{ heading: 'Assignment history', blocks: [] }] }), META).content);
  assert.match(generic, /None\./);
});

test('facts print as label and value pairs under a section heading', () => {
  const body = text(toDocDefinition(model(), META).content);
  assert.match(body, /Parties/);
  assert.match(body, /Complainant/);
  assert.match(body, /Ana Reyes/);
  assert.match(body, /Juan Cruz/);
});

test('a table repeats its header row on every page and does not split a row across pages', () => {
  const def = toDocDefinition(
    model({
      sections: [{ heading: 'Case handling', blocks: [{ type: 'table', columns: ['Step', 'By', 'When'], rows: [['Filed', 'Ana Reyes', '1 October 2026, 9:00 AM']] }] }],
    }),
    META,
  );
  const tables: any[] = [];
  const walk = (node: any) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      if (node.table && node.table.headerRows === 1 && node.table.body?.[0]?.length === 3) tables.push(node);
      Object.values(node).forEach(walk);
    }
  };
  walk(def.content);
  assert.equal(tables.length, 1);
  assert.equal(tables[0].table.dontBreakRows, true);
  assert.equal(tables[0].table.body.length, 2);
});

test('a QR block is drawn with its caption', () => {
  const body = text(
    toDocDefinition(
      model({ sections: [{ heading: 'Location', blocks: [{ type: 'qr', text: 'https://maps.google.com/?q=6.1,125.1', caption: 'Scan to open the map' }] }] }),
      META,
    ).content,
  );
  assert.match(body, /"qr":"https:\/\/maps\.google\.com\/\?q=6\.1,125\.1"/);
  assert.match(body, /Scan to open the map/);
});

test('long text, accents, the peso sign and Filipino names go into the document unchanged', () => {
  const longMessage = 'Hindi ako binayaran ng ₱150 ni Peña, kahit nakarating na kami sa Barangay Dadiangas West. '.repeat(200);
  const body = text(toDocDefinition(model({ sections: [{ heading: 'Complaint', blocks: [{ type: 'paragraph', text: longMessage }] }] }), META).content);
  assert.ok(body.includes('₱150'));
  assert.ok(body.includes('Peña'));
  assert.ok(body.length > longMessage.length);
});

test('the PDF file info names the document and who made it', () => {
  const def = toDocDefinition(model(), META);
  assert.equal(def.info?.title, 'PSO-CMP-2026-000123 Complaint Case Report');
  assert.equal(def.info?.author, 'Rina Cabuslay');
});

test('the report ends with Prepared by, Noted by and Received by, and Prepared by names the person who printed it', () => {
  const body = text(toDocDefinition(model(), META).content);
  assert.match(body, /Prepared by/);
  assert.match(body, /Noted by/);
  assert.match(body, /Received by/);
  assert.match(body, /Rina Cabuslay/);
  assert.match(body, /PSO Supervisor · 5 October 2026, 3:15 PM/);
});
