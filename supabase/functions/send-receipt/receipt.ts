// Pure helpers for send-receipt, kept free of Deno APIs so they can be unit-tested with node (see receipt.test.ts).

export interface ReceiptData {
  rideRequestId: string;
  passengerFirstName: string | null;
  driverFirstName: string | null;
  plateNo: string | null;
  pickupLabel: string | null;
  destLabel: string | null;
  fare: number;
  seats: number | null;
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  completedAt: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  discountApplied: boolean;
  discountPercent: number | null;
}

/** Same short, quotable code the passenger app shows (last six characters of the ride id, upper-case). */
export function referenceCode(id: string): string {
  return id.replace(/[^0-9A-Za-z]/g, '').slice(-6).toUpperCase();
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

function paymentLine(r: ReceiptData): string | null {
  if (!r.paymentMethod) return null;
  const method = r.paymentMethod === 'gcash' ? 'GCash' : 'Cash';
  const status = r.paymentStatus ? PAYMENT_STATUS_LABEL[r.paymentStatus] : null;
  return status ? `${method} — ${status}` : method;
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Row {
  label: string;
  value: string;
}

function rowsFor(r: ReceiptData): Row[] {
  const rows: (Row | null)[] = [
    { label: 'Reference', value: `#${referenceCode(r.rideRequestId)}` },
    formatWhen(r.completedAt) ? { label: 'Date', value: formatWhen(r.completedAt)! } : null,
    r.pickupLabel ? { label: 'Pickup', value: r.pickupLabel } : null,
    r.destLabel ? { label: 'Destination', value: r.destLabel } : null,
    r.distanceKm !== null ? { label: 'Distance', value: `${r.distanceKm.toFixed(1)} km` } : null,
    r.durationMinutes !== null ? { label: 'Duration', value: `${Math.round(r.durationMinutes)} min` } : null,
    r.seats !== null ? { label: 'Seats', value: String(r.seats) } : null,
    r.driverFirstName ? { label: 'Driver', value: r.driverFirstName } : null,
    r.plateNo ? { label: 'Plate', value: r.plateNo } : null,
    r.discountApplied && r.discountPercent !== null ? { label: 'Discount', value: `${r.discountPercent}% discount applied` } : null,
    paymentLine(r) ? { label: 'Payment', value: paymentLine(r)! } : null,
  ];
  return rows.filter((row): row is Row => row !== null);
}

/** Subject, HTML and plain-text bodies for one completed ride. Built only from the server record. */
export function buildReceiptEmail(r: ReceiptData): { subject: string; html: string; text: string } {
  const ref = referenceCode(r.rideRequestId);
  const total = `₱${r.fare.toFixed(2)}`;
  const rows = rowsFor(r);
  const greeting = r.passengerFirstName ? `Hi ${r.passengerFirstName},` : 'Hi,';

  const text = [
    greeting,
    '',
    'Thanks for riding with TriSakay. Here is your trip receipt.',
    '',
    ...rows.map((row) => `${row.label}: ${row.value}`),
    '',
    `Total: ${total}`,
    '',
    'You are receiving this because you turned on email receipts, or asked for this one, in the TriSakay app.',
  ].join('\n');

  const htmlRows = rows
    .map(
      (row) =>
        `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">${escapeHtml(row.label)}</td>` +
        `<td style="padding:6px 0;text-align:right;font-size:14px;color:#111827">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');

  const html =
    `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">` +
    `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">` +
    `<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:24px">` +
    `<tr><td><div style="font-size:20px;font-weight:bold;color:#0b1f4d">TriSakay</div>` +
    `<p style="font-size:14px;color:#111827">${escapeHtml(greeting)}</p>` +
    `<p style="font-size:14px;color:#374151">Thanks for riding with TriSakay. Here is your trip receipt.</p>` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:12px 0">${htmlRows}</table>` +
    `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:16px;font-weight:bold;color:#111827">Total</td>` +
    `<td style="text-align:right;font-size:18px;font-weight:bold;color:#0b1f4d">${escapeHtml(total)}</td></tr></table>` +
    `<p style="font-size:12px;color:#6b7280;margin-top:20px">You are receiving this because you turned on email receipts, or asked for this one, in the TriSakay app.</p>` +
    `</td></tr></table></td></tr></table></body></html>`;

  return { subject: `Your TriSakay receipt #${ref}`, html, text };
}

export type SendDecision = 'ok' | 'ride_limit' | 'day_limit';

export const MAX_MANUAL_PER_RIDE = 3;
export const MAX_MANUAL_PER_DAY = 20;

/**
 * Manual sends are limited per ride and per day (counts include every earlier attempt, failed ones too, so the
 * endpoint can't be used to hammer the email provider). The one automatic send per ride is enforced by the
 * database (unique index), not here, and is exempt from these limits.
 */
export function checkSendAllowed(kind: 'auto' | 'manual', counts: { perRide: number; perDay: number }): SendDecision {
  if (kind === 'auto') return 'ok';
  if (counts.perRide >= MAX_MANUAL_PER_RIDE) return 'ride_limit';
  if (counts.perDay >= MAX_MANUAL_PER_DAY) return 'day_limit';
  return 'ok';
}
