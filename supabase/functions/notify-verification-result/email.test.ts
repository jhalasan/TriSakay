// Run with: node --test supabase/functions/notify-verification-result/email.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerificationEmail } from './email.ts';

test('the subject carries the result and the greeting uses the first name', () => {
  const email = buildVerificationEmail({ firstName: 'Jay', title: 'Verification approved', message: 'You can now go online.' });

  assert.equal(email.subject, 'TriSakay: Verification approved');
  assert.match(email.text, /Hi Jay,/);
  assert.match(email.html, /Hi Jay,/);
});

test('every rejected document and its reason appears, one per line', () => {
  const email = buildVerificationEmail({
    firstName: 'Jay',
    title: 'Verification rejected',
    message: "Your driver verification was rejected.\nPlease replace:\nDriver's license: Photo is blurry\nOR / CR: Plate number is cut off",
  });

  assert.match(email.text, /Driver's license: Photo is blurry\nOR \/ CR: Plate number is cut off/);
  assert.ok(email.html.includes('Photo is blurry'));
  assert.ok(email.html.includes('<br'));
});

test('a reviewer note with HTML characters cannot inject markup into the email', () => {
  const email = buildVerificationEmail({
    firstName: '<b>Jay</b>',
    title: 'Verification rejected',
    message: 'Reason: <script>alert(1)</script> & "quotes"',
  });

  assert.ok(!email.html.includes('<script>'));
  assert.ok(!email.html.includes('<b>Jay</b>'));
  assert.ok(email.html.includes('&lt;script&gt;'));
  assert.ok(email.html.includes('&amp;'));
});

test('a missing first name falls back to a plain greeting', () => {
  const email = buildVerificationEmail({ firstName: '', title: 'Verification approved', message: 'Done.' });

  assert.match(email.text, /Hello,/);
});
