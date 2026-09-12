export interface BulkActionSummary {
  succeeded: number;
  failed: number;
}

const BULK_LIST_PREVIEW_LIMIT = 4;

/** Names the selected rows, not just the count, in a bulk-action confirm message — so a mis-click
 * that selected the wrong rows is catchable before confirming a real change. Shared by every screen
 * with bulk actions (Drivers, Passengers, Complaints) rather than each re-implementing the truncation. */
export function formatBulkTargets(names: string[]): string {
  if (names.length <= BULK_LIST_PREVIEW_LIMIT) return names.join(', ');
  const shown = names.slice(0, BULK_LIST_PREVIEW_LIMIT);
  return `${shown.join(', ')}, and ${names.length - BULK_LIST_PREVIEW_LIMIT} more`;
}

/** Runs the same single-row action across many ids (Promise.allSettled — one failure doesn't stop the rest), returning a pass/fail count for the caller to report. */
export async function runBulkAction(
  ids: string[],
  action: (id: string, reason: string) => Promise<{ error: string | null }>,
  reason: string,
): Promise<BulkActionSummary> {
  const results = await Promise.allSettled(ids.map((id) => action(id, reason)));
  const succeeded = results.filter((r) => r.status === 'fulfilled' && !r.value.error).length;
  return { succeeded, failed: ids.length - succeeded };
}
