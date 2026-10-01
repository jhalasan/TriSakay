/** Masks an email for display: first letter + the domain. `—` when empty, `•••` when it isn't an email. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const at = email.indexOf('@');
  if (at < 1) return '•••';
  return `${email[0]}***${email.slice(at)}`;
}

/** Masks a PH mobile number for display, keeping only the last 4 digits. Accepts `09…`, spaced, or `+639…`. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '•••';
  return `09•• ••• ${digits.slice(-4)}`;
}
