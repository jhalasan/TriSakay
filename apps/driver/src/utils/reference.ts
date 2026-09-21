/** Derives a short, human-quotable reference code from a UUID-style id (e.g. for support lookups). */
export function getReferenceCode(id: string | null | undefined, length = 6): string | null {
  if (!id) return null;
  const alphanumeric = id.replace(/[^0-9A-Za-z]/g, '');
  if (!alphanumeric) return null;
  return alphanumeric.slice(-length).toUpperCase();
}
