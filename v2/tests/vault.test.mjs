import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVault, unlockVault, encryptRecord, decryptRecord } from '../security/vault.mjs';

const recordInput = (key, value = { name: 'Cliente de prueba', rate: 0.07 }) => ({
  contentKey: key, workspaceId: 'workspace_test_a', recordId: 'project_test_a', version: 1, value
});

test('the same vault encrypts, decrypts and recovers on a separate session', async () => {
  const { contentKey, envelope, recoverySecret } = await createVault();
  assert.equal(envelope.format, 1);
  assert.equal(typeof recoverySecret, 'string');
  assert.equal(recoverySecret.length, 43); // 32 bytes encoded as base64url.
  const plain = { client: 'Agencia Ficticia', rate: 0.027, words: 1234 };
  const encrypted = await encryptRecord(recordInput(contentKey, plain));
  assert.equal(encrypted.ciphertext.includes(plain.client), false);
  assert.deepEqual(await decryptRecord({
    contentKey, workspaceId: 'workspace_test_a', recordId: 'project_test_a', record: encrypted
  }), plain);
  const recoveredKey = await unlockVault(envelope, recoverySecret);
  assert.deepEqual(await decryptRecord({
    contentKey: recoveredKey, workspaceId: 'workspace_test_a', recordId: 'project_test_a', record: encrypted
  }), plain);
});

test('encrypting same contents twice creates different ciphertext and nonces', async () => {
  const { contentKey } = await createVault();
  const a = await encryptRecord(recordInput(contentKey));
  const b = await encryptRecord(recordInput(contentKey));
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test('altering encrypted record or binding to a different account is rejected', async () => {
  const { contentKey } = await createVault();
  const encrypted = await encryptRecord(recordInput(contentKey));
  const parameters = { contentKey, workspaceId: 'workspace_test_a', recordId: 'project_test_a', record: encrypted };
  await assert.rejects(
    decryptRecord({ ...parameters, workspaceId: 'workspace_test_b' }), /Registro incompatible/
  );
  await assert.rejects(
    decryptRecord({ ...parameters, recordId: 'project_test_b' }), /Registro incompatible/
  );
  await assert.rejects(
    decryptRecord({ ...parameters, record: { ...encrypted, version: 2 } }),
    /OperationError|operation-specific|decrypt/i
  );
  const swapped = encrypted.ciphertext.slice(0, -1) + (encrypted.ciphertext.endsWith('A') ? 'B' : 'A');
  await assert.rejects(
    decryptRecord({ ...parameters, record: { ...encrypted, ciphertext: swapped } })
  );
});

test('wrong recovery secret and altered key envelope cannot unlock vault', async () => {
  const one = await createVault();
  const two = await createVault();
  await assert.rejects(unlockVault(one.envelope, two.recoverySecret));
  await assert.rejects(unlockVault({ ...one.envelope, nonce: 'a' }, one.recoverySecret));
});

test('invalid identifiers and unsupported data types cannot be encrypted', async () => {
  const { contentKey } = await createVault();
  await assert.rejects(encryptRecord({ ...recordInput(contentKey), workspaceId: '../tenant' }));
  await assert.rejects(encryptRecord({ ...recordInput(contentKey), value: undefined }));
});
