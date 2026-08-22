const test = require('node:test');
const assert = require('node:assert/strict');

test('submit() stages a file as selected; remove() clears it back to unsubmitted', async () => {
  const { useDocumentsStore } = await import('../src/store/useDocumentsStore.ts');

  useDocumentsStore.getState().reset();
  useDocumentsStore.getState().submit('drivers_license', 'file:///a.jpg');

  assert.deepEqual(useDocumentsStore.getState().documents.drivers_license, {
    status: 'selected',
    uri: 'file:///a.jpg',
  });

  useDocumentsStore.getState().remove('drivers_license');

  assert.deepEqual(useDocumentsStore.getState().documents.drivers_license, { status: 'unsubmitted', uri: null });
});

test('reset() clears every staged document back to unsubmitted', async () => {
  const { useDocumentsStore } = await import('../src/store/useDocumentsStore.ts');

  useDocumentsStore.getState().submit('drivers_license', 'file:///a.jpg');
  useDocumentsStore.getState().submit('or_cr', 'file:///b.jpg');

  useDocumentsStore.getState().reset();

  const { documents } = useDocumentsStore.getState();
  for (const type of Object.keys(documents)) {
    assert.deepEqual(documents[type], { status: 'unsubmitted', uri: null });
  }
});
