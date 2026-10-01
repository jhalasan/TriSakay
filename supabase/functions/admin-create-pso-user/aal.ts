/** Reads the `aal` claim from the bearer token. The token was already validated by getUser() before this is used. */
export function assuranceLevel(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof claims.aal === 'string' ? claims.aal : null;
  } catch {
    return null;
  }
}
