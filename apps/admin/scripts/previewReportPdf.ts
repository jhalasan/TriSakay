// Makes sample report PDFs from made-up data so the layout can be looked at without a database.
// Run from apps/admin:  node scripts/previewReportPdf.ts <output folder>
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { toDocDefinition } from '../src/lib/reports/pdfLayout.ts';
import {
  SAMPLE_META,
  sampleComplaintReport,
  sampleComplaintsStatsReport,
  sampleDriverRosterReport,
  sampleFranchiseReport,
  sampleRidesRevenueReport,
  sampleSosReport,
} from '../src/lib/reports/sampleReports.ts';

const require = createRequire(import.meta.url);
const pdfmake = require('pdfmake');
pdfmake.addFonts(require('pdfmake/fonts/Roboto'));
pdfmake.setLocalAccessPolicy(() => true);

const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });

const logoPath = path.join(import.meta.dirname, '..', 'public', 'brand', 'trisakay-mark.png');
const logoDataUrl = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`;

const jobs = [
  { file: 'sample-complaint-report.pdf', model: sampleComplaintReport(), meta: SAMPLE_META },
  { file: 'sample-sos-report.pdf', model: sampleSosReport(), meta: { ...SAMPLE_META, docNo: 'PSO-SOS-2026-000045' } },
  { file: 'sample-rides-revenue-report.pdf', model: sampleRidesRevenueReport(), meta: { ...SAMPLE_META, docNo: 'PSO-RVN-2026-000001' } },
  { file: 'sample-franchise-report.pdf', model: sampleFranchiseReport(), meta: { ...SAMPLE_META, docNo: 'PSO-FRN-2026-000001' } },
  { file: 'sample-complaints-statistics-report.pdf', model: sampleComplaintsStatsReport(), meta: { ...SAMPLE_META, docNo: 'PSO-CST-2026-000001' } },
  { file: 'sample-driver-roster-report.pdf', model: sampleDriverRosterReport(), meta: { ...SAMPLE_META, docNo: 'PSO-DRV-2026-000001' } },
];

for (const job of jobs) {
  const buffer = await pdfmake.createPdf(toDocDefinition(job.model, job.meta, { logoDataUrl })).getBuffer();
  writeFileSync(path.join(outDir, job.file), buffer);
  console.log('wrote', job.file, buffer.length, 'bytes');
}
