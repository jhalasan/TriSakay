import type { DriverRow } from '../../types/driver.ts';
import { titleCaseLabel } from '../format.ts';
import { formatReportDate, formatReportDateTime } from './format.ts';
import type { ReportModel } from './types.ts';

export interface DriverRosterReportInput {
  drivers: DriverRow[];
  asOfIso: string;
}

const dash = '—';

/**
 * The register of drivers: who is verified to operate, on which tricycle and cluster, with their rating and
 * trips. No phone numbers or emails are printed, so the same report is safe to hand around the office.
 */
export function buildDriverRosterReport(input: DriverRosterReportInput): ReportModel {
  const drivers = [...input.drivers].sort((a, b) => a.fullName.localeCompare(b.fullName));

  const verification = (status: DriverRow['verificationStatus']) => drivers.filter((d) => d.verificationStatus === status).length;
  const account = (status: DriverRow['accountStatus']) => drivers.filter((d) => d.accountStatus === status).length;

  return {
    kind: 'report_drivers',
    title: 'Driver Roster Report',
    reference: `As of ${formatReportDate(input.asOfIso)} · ${drivers.length} ${drivers.length === 1 ? 'driver' : 'drivers'}`,
    status: 'Summary report',
    open: false,
    sections: [
      {
        heading: 'Summary',
        blocks: [
          {
            type: 'facts',
            rows: [
              ['Verification', `${verification('approved')} approved · ${verification('pending')} pending · ${verification('rejected')} rejected · ${verification('unsubmitted')} not submitted`],
              ['Account status', `${account('active')} active · ${account('flagged')} flagged · ${account('suspended')} suspended · ${account('deactivated')} deactivated`],
            ],
          },
          { type: 'paragraph', text: `Prepared ${formatReportDateTime(input.asOfIso)} (Manila time).` },
        ],
      },
      drivers.length > 0
        ? {
            heading: 'Drivers',
            blocks: [
              {
                type: 'table',
                columns: ['Driver', 'Plate no.', 'Cluster', 'Verification', 'Account', 'Rating', 'Trips'],
                widths: ['*', 56, 58, 62, 54, 52, 28],
                rows: drivers.map((d) => [
                  d.fullName,
                  d.plateNo || dash,
                  d.cluster ? titleCaseLabel(d.cluster) : dash,
                  titleCaseLabel(d.verificationStatus),
                  titleCaseLabel(d.accountStatus),
                  d.ratingCount > 0 ? `${d.ratingAvg.toFixed(1)} (${d.ratingCount})` : dash,
                  String(d.tripCount),
                ]),
              },
              { type: 'paragraph', text: 'Rating is the average out of 5 with the number of ratings. Trips counts trips that carried a completed ride.' },
            ],
          }
        : { heading: 'Drivers', blocks: [], emptyText: 'No drivers are registered.' },
    ],
  };
}
