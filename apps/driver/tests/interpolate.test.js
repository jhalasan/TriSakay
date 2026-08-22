const test = require('node:test');
const assert = require('node:assert/strict');

test('interpolate replaces every named placeholder with its value', async () => {
  const { interpolate } = await import('../src/utils/interpolate.ts');

  assert.equal(
    interpolate('Step {step} of 2', { step: 1 }),
    'Step 1 of 2'
  );
  assert.equal(
    interpolate('We sent a code to {email}.', { email: 'driver@example.com' }),
    'We sent a code to driver@example.com.'
  );
});

test('interpolate leaves an unmatched placeholder untouched', async () => {
  const { interpolate } = await import('../src/utils/interpolate.ts');

  assert.equal(interpolate('Hello {name}', {}), 'Hello {name}');
});

test('interpolate handles multiple placeholders in one string', async () => {
  const { interpolate } = await import('../src/utils/interpolate.ts');

  assert.equal(
    interpolate('{a} and {b}', { a: 'foo', b: 'bar' }),
    'foo and bar'
  );
});
