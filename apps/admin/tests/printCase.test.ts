import test from 'node:test';
import assert from 'node:assert/strict';
import { printComplaintReport, printSosReport, type PrintDeps } from '../src/lib/reports/printCase.ts';
import { loadEvidenceItems } from '../src/lib/reports/evidenceImages.ts';
import type { ComplaintRow } from '../src/types/complaint.ts';
import type { EmergencyAlertRow } from '../src/types/emergency.ts';
import type { ReportMeta, ReportModel } from '../src/lib/reports/types.ts';

const COMPLAINT = {
  id: 'a1b2c3d4-0000-0000-0000-00000000a1b2',
  subject: 'Fare',
  message: 'Message',
  submittedById: 'p1',
  submittedByName: 'Sample Passenger',
  againstUserId: 'd1',
  againstUserName: 'Sample Driver',
  rideRequestId: 'ride-1',
  category: 'fare',
  status: 'under_review',
  dhDirective: null,
  mediationMeetingAt: null,
  mediationLocation: null,
  resolutionNotes: null,
  businessDaysElapsed: 1,
  createdAt: '2026-10-01T02:00:00.000Z',
  triagedByName: null,
  triagedAt: null,
  dhReviewedByName: null,
  dhReviewedAt: null,
  mediationScheduledByName: null,
  mediationScheduledAt: null,
  resolvedByName: null,
  resolvedAt: null,
  assignedToId: null,
  assignedToName: null,
  assignedAt: null,
  assignmentAcceptedAt: null,
  businessDaysUnowned: 1,
} as ComplaintRow;

const ALERT = {
  id: '7d2e0000-0000-0000-0000-00000000007d2e',
  triggeredById: 'p1',
  triggeredByName: 'Sample Passenger',
  triggeredRole: 'passenger',
  counterpartId: 'd1',
  counterpartName: 'Sample Driver',
  tricyclePlateNo: 'GSC-0000',
  rideRequestId: 'ride-1',
  lat: 6.1,
  lng: 125.1,
  status: 'reviewed',
  reviewedByName: 'Sample Supervisor',
  reviewedAt: '2026-10-05T00:05:00.000Z',
  closedByName: null,
  closedAt: null,
  notes: 'Checked.',
  createdAt: '2026-10-04T12:41:00.000Z',
} as EmergencyAlertRow;

const RECEIPT = { docNo: 'PSO-CMP-2026-000123', printedAt: '2026-10-05T07:15:00.000Z', printedByName: 'Rina Cabuslay', printedByRole: 'pso_supervisor' };

function fakeDeps(overrides: Partial<PrintDeps> = {}) {
  const calls: string[] = [];
  const downloads: { model: ReportModel; meta: ReportMeta; filename: string }[] = [];
  const deps: PrintDeps = {
    recordPrint: async (input) => {
      calls.push(`record:${input.kind}:${input.includeChat ? 'chat' : 'nochat'}`);
      return { data: RECEIPT, error: null };
    },
    getRide: async () => {
      calls.push('ride');
      return { data: null, error: null };
    },
    getContacts: async (ids) => {
      calls.push(`contacts:${ids.sort().join(',')}`);
      return { data: { p1: { phone: '09000000001', email: null } }, error: null };
    },
    loadEvidence: async () => {
      calls.push('evidence');
      return [];
    },
    viewChat: async (_ride, reason) => {
      calls.push(`chat:${reason}`);
      return { data: [], error: null };
    },
    download: async (model, meta, filename) => {
      calls.push('download');
      downloads.push({ model, meta, filename });
    },
    ...overrides,
  };
  return { deps, calls, downloads };
}

const baseComplaintArgs = { complaint: COMPLAINT, assignments: [], statusHistory: [], attachments: [] };

test('a Supervisor prints a complaint: the print is recorded first, contacts are fetched, and the file is named by the document number', async () => {
  const { deps, calls, downloads } = fakeDeps();

  const result = await printComplaintReport({ ...baseComplaintArgs, viewerRole: 'pso_supervisor' }, deps);

  assert.deepEqual(result, { error: null, docNo: 'PSO-CMP-2026-000123' });
  assert.equal(calls[0], 'record:complaint:nochat', 'the print is recorded before anything else happens');
  assert.ok(calls.includes('contacts:d1,p1'));
  assert.equal(downloads[0].filename, 'PSO-CMP-2026-000123.pdf');
  assert.equal(downloads[0].meta.printedByRole, 'PSO Supervisor');
  assert.equal(downloads[0].meta.printedByName, 'Rina Cabuslay');
  assert.equal(downloads[0].model.kind, 'complaint');
});

test('PSO Staff never trigger a contact lookup, so no phone numbers can reach the PDF', async () => {
  const { deps, calls, downloads } = fakeDeps();

  const result = await printComplaintReport({ ...baseComplaintArgs, viewerRole: 'pso_staff' }, deps);

  assert.equal(result.error, null);
  assert.ok(!calls.some((c) => c.startsWith('contacts')));
  assert.doesNotMatch(JSON.stringify(downloads[0].model), /0900000000/);
});

test('PSO Staff cannot include the chat thread even if it is asked for', async () => {
  const { deps, calls } = fakeDeps();

  await printComplaintReport({ ...baseComplaintArgs, viewerRole: 'pso_staff', includeChat: true, chatReason: 'because' }, deps);

  assert.equal(calls[0], 'record:complaint:nochat');
  assert.ok(!calls.some((c) => c.startsWith('chat:')));
});

test('when the print cannot be recorded nothing else runs and nothing is downloaded', async () => {
  const { deps, calls, downloads } = fakeDeps({
    recordPrint: async () => ({ data: null, error: 'Claim this complaint (or accept it once assigned) before printing it.' }),
  });

  const result = await printComplaintReport({ ...baseComplaintArgs, viewerRole: 'pso_staff' }, deps);

  assert.deepEqual(result, { error: 'Claim this complaint (or accept it once assigned) before printing it.' });
  assert.deepEqual(calls, []);
  assert.equal(downloads.length, 0);
});

test('a Supervisor can include the chat thread with a reason, and it is loaded through the logged call', async () => {
  const { deps, calls, downloads } = fakeDeps();

  const result = await printComplaintReport({ ...baseComplaintArgs, viewerRole: 'admin', includeChat: true, chatReason: 'Police request' }, deps);

  assert.equal(result.error, null);
  assert.equal(calls[0], 'record:complaint:chat');
  assert.ok(calls.includes('chat:Police request'));
  assert.ok(downloads[0].model.sections.some((s) => s.heading === 'Chat thread'));
});

test('a failed ride lookup stops the print with an error instead of printing an incomplete report', async () => {
  const { deps, downloads } = fakeDeps({ getRide: async () => ({ data: null, error: 'connection refused' }) });

  const result = await printComplaintReport({ ...baseComplaintArgs, viewerRole: 'pso_supervisor' }, deps);

  assert.equal(result.error, 'connection refused');
  assert.equal(downloads.length, 0);
});

test('a failed chat load stops the print with the error', async () => {
  const { deps, downloads } = fakeDeps({ viewChat: async () => ({ data: [], error: 'This ride has no linked complaint or emergency alert.' }) });

  const result = await printComplaintReport({ ...baseComplaintArgs, viewerRole: 'admin', includeChat: true, chatReason: 'x' }, deps);

  assert.equal(result.error, 'This ride has no linked complaint or emergency alert.');
  assert.equal(downloads.length, 0);
});

test('printing an SOS alert records an sos_alert print and builds the SOS report with the printer as Prepared by', async () => {
  const { deps, calls, downloads } = fakeDeps({
    recordPrint: async (input) => {
      assert.equal(input.kind, 'sos_alert');
      return { data: { ...RECEIPT, docNo: 'PSO-SOS-2026-000007' }, error: null };
    },
  });

  const result = await printSosReport({ alert: ALERT, viewerRole: 'pso_supervisor' }, deps);

  assert.deepEqual(result, { error: null, docNo: 'PSO-SOS-2026-000007' });
  assert.equal(downloads[0].filename, 'PSO-SOS-2026-000007.pdf');
  assert.equal(downloads[0].model.kind, 'sos_alert');
  assert.ok(calls.includes('ride'));
});

test('an SOS print never includes the chat thread unless it was asked for with a reason', async () => {
  const { deps, calls, downloads } = fakeDeps();

  await printSosReport({ alert: ALERT, viewerRole: 'admin' }, deps);

  assert.ok(!calls.some((c) => c.startsWith('chat:')));
  assert.ok(!downloads[0].model.sections.some((s) => s.heading === 'Chat thread'));
});

// ---- evidence images

test('loadEvidenceItems names each file, loads images, flags the ones that fail and skips non-images', async () => {
  const loaded: string[] = [];
  const items = await loadEvidenceItems(
    [{ storagePath: 'c1/photo-1.JPG' }, { storagePath: 'c1/photo-2.png' }, { storagePath: 'c1/receipt.pdf' }],
    async (path) => {
      loaded.push(path);
      return path.endsWith('photo-1.JPG') ? 'data:image/jpeg;base64,AAAA' : null;
    },
  );

  assert.deepEqual(items, [
    { name: 'photo-1.JPG', imageDataUrl: 'data:image/jpeg;base64,AAAA' },
    { name: 'photo-2.png', imageDataUrl: null, imageFailed: true },
    { name: 'receipt.pdf' },
  ]);
  assert.deepEqual(loaded, ['c1/photo-1.JPG', 'c1/photo-2.png']);
});

test('loadEvidenceItems loads at most 6 pictures and lists the rest without them', async () => {
  const attachments = Array.from({ length: 8 }, (_, i) => ({ storagePath: `c1/p${i}.jpg` }));
  let loads = 0;
  const items = await loadEvidenceItems(attachments, async () => {
    loads++;
    return 'data:image/jpeg;base64,AAAA';
  });

  assert.equal(loads, 6);
  assert.equal(items.length, 8);
  assert.equal(items.filter((i) => i.imageDataUrl).length, 6);
  assert.equal(items[7].imageDataUrl, undefined);
});

test('loadEvidenceItems treats a loader that throws as a failed picture, not a failed print', async () => {
  const items = await loadEvidenceItems([{ storagePath: 'c1/a.jpg' }], async () => {
    throw new Error('network down');
  });
  assert.deepEqual(items, [{ name: 'a.jpg', imageDataUrl: null, imageFailed: true }]);
});
