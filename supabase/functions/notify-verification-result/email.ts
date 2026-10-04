// Builds the email a driver gets when the PSO decides on their verification.
// The title and message are the same text the in-app notification already
// carries (written by perform_verification_decision), so the email and the app
// always say the same thing. Everything is HTML escaped: the message contains
// reviewer written reasons.

export interface VerificationEmailInput {
  firstName: string;
  title: string;
  message: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildVerificationEmail({ firstName, title, message }: VerificationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const name = firstName.trim();
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `TriSakay: ${title}`;
  const footer = 'Open the TriSakay Driver app to see the details and continue.';

  const text = `${greeting}\n\n${message}\n\n${footer}\n`;

  const body = escapeHtml(message).replace(/\n/g, '<br>');
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111827">` +
    `<p style="font-size:14px">${escapeHtml(greeting)}</p>` +
    `<h2 style="font-size:18px;margin:16px 0 8px">${escapeHtml(title)}</h2>` +
    `<p style="font-size:14px;line-height:1.5">${body}</p>` +
    `<p style="font-size:13px;color:#6b7280;margin-top:20px">${escapeHtml(footer)}</p>` +
    `</div>`;

  return { subject, html, text };
}
