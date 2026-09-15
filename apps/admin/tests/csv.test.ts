import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/lib/csv.ts';

test('toCsv quotes fields containing a comma, quote, or newline per RFC 4180', () => {
  const csv = toCsv(
    [{ a: 'has, comma', b: 'has "quote"', c: 'has\nnewline', d: 'plain' }],
    [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
      { header: 'C', value: (r) => r.c },
      { header: 'D', value: (r) => r.d },
    ]
  );
  assert.equal(csv, 'A,B,C,D\r\n"has, comma","has ""quote""","has\nnewline",plain');
});

// P2 (2026-09-15 launch audit): CSV formula injection — a free-text field
// (e.g. AuditLog's "Reason", entered by any PSO Staff account) starting
// with =, +, -, or @ is interpreted as a formula by Excel/Sheets when the
// export is opened.
test('toCsv neutralizes a leading =, +, -, or @ with a single-quote prefix', () => {
  const csv = toCsv(
    [
      { reason: '=1+1' },
      { reason: '+1+1' },
      { reason: '-1+1' },
      { reason: '@SUM' },
      { reason: 'normal text' },
    ],
    [{ header: 'Reason', value: (r) => r.reason }]
  );
  const lines = csv.split('\r\n').slice(1);
  assert.equal(lines[0], "'=1+1");
  assert.equal(lines[1], "'+1+1");
  assert.equal(lines[2], "'-1+1");
  assert.equal(lines[3], "'@SUM");
  assert.equal(lines[4], 'normal text');
});

test('toCsv still RFC-4180-quotes a neutralized formula that also contains a comma or quote', () => {
  const csv = toCsv([{ reason: '=cmd|"/c calc"!A1' }], [{ header: 'Reason', value: (r) => r.reason }]);
  assert.equal(csv, 'Reason\r\n"\'=cmd|""/c calc""!A1"');
});

test('toCsv does not alter a value that merely contains (not starts with) a formula-trigger character', () => {
  const csv = toCsv([{ reason: 'refund = ₱50' }], [{ header: 'Reason', value: (r) => r.reason }]);
  assert.equal(csv, 'Reason\r\nrefund = ₱50');
});
