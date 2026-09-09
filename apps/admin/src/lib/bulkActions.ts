export interface BulkActionSummary {
  succeeded: number;
  failed: number;
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
