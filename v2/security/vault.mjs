/**
 * Local Web Crypto proof-of-concept. No backend integration and NO audited E2EE claim.
 * The caller must never send a recoverySecret or decrypted content to the server.
 * A 256-bit recovery secret wraps a randomly generated AES-256-GCM content key.
 */
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });
const FORMAT = 1;
const MAX_CIPHERTEXT_BYTES = 5_000_016;

const cryptoAPI = () => {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Se requiere Web Crypto en un contexto seguro.');
  }
  return globalThis.crypto;
};
function toB64url(input) {
  let str = '';
  for (let i = 0; i < input.length; i += 16384) {
    str += String.fromCharCode(...input.subarray(i, i + 16384));
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64url(encoded, maxBytes = MAX_CIPHERTEXT_BYTES) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length > Math.ceil(maxBytes * 4 / 3) + 5) {
    throw new TypeError('Codificación base64url inválida.');
  }
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const str = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  if (str.length > maxBytes) throw new RangeError('Campo demasiado grande.');
  return Uint8Array.from(str, ch => ch.charCodeAt(0));
}
function requiredId(s, name) {
  if (typeof s !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(s)) {
    throw new TypeError(name + ': identificador inválido.');
  }
  return s;
}
function aadFor(workspaceId, recordId, version) {
  return enc.encode(JSON.stringify({ app: 'Plazo', vault: FORMAT, workspaceId, recordId, version }));
}
function validateVersion(version) {
  if (!Number.isSafeInteger(version) || version < 1 || version > 2_147_483_647) {
    throw new TypeError('Versión de registro inválida.');
  }
  return version;
}
const wrapAAD = enc.encode('Plazo:vault-envelope:1');

/** Recovery secret must be shown once and stored by the user, not the operator. */
export async function createVault() {
  const crypto = cryptoAPI();
  const contentKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const recoveryBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await crypto.subtle.importKey('raw', recoveryBytes, 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: wrapAAD }, wrappingKey, contentKeyBytes
  );
  const contentKey = await crypto.subtle.importKey('raw', contentKeyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const recoverySecret = toB64url(recoveryBytes);
  contentKeyBytes.fill(0);
  recoveryBytes.fill(0);
  return {
    contentKey,
    recoverySecret,
    envelope: {
      format: FORMAT,
      cipher: 'AES-256-GCM',
      nonce: toB64url(nonce),
      wrappedKey: toB64url(new Uint8Array(ciphertext))
    }
  };
}

/** Recover the client-only content key from a user-controlled secret. */
export async function unlockVault(envelope, recoverySecret) {
  if (!envelope || envelope.format !== FORMAT || envelope.cipher !== 'AES-256-GCM') {
    throw new TypeError('Sobre de clave incompatible.');
  }
  const crypto = cryptoAPI();
  const recoveryBytes = fromB64url(recoverySecret, 32);
  if (recoveryBytes.length !== 32) throw new TypeError('Secreto de recuperación inválido.');
  const nonce = fromB64url(envelope.nonce, 12);
  if (nonce.length !== 12) throw new TypeError('Nonce inválido.');
  const wrappingKey = await crypto.subtle.importKey('raw', recoveryBytes, 'AES-GCM', false, ['decrypt']);
  recoveryBytes.fill(0);
  const contentKeyBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: wrapAAD },
    wrappingKey, fromB64url(envelope.wrappedKey, 48)
  );
  if (contentKeyBytes.byteLength !== 32) throw new TypeError('Longitud de clave inválida.');
  return crypto.subtle.importKey('raw', contentKeyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Encrypt in the user's device. Identifiers and version are cryptographically bound. */
export async function encryptRecord({ contentKey, workspaceId, recordId, version = 1, value }) {
  requiredId(workspaceId, 'workspaceId');
  requiredId(recordId, 'recordId');
  validateVersion(version);
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') throw new TypeError('Se requiere contenido JSON.');
  const plaintext = enc.encode(serialized);
  if (plaintext.length > 5_000_000) throw new RangeError('Registro mayor a 5 MB.');
  const nonce = cryptoAPI().getRandomValues(new Uint8Array(12));
  const encrypted = await cryptoAPI().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aadFor(workspaceId, recordId, version) },
    contentKey, plaintext
  );
  return {
    format: FORMAT, workspaceId, recordId, version,
    nonce: toB64url(nonce), ciphertext: toB64url(new Uint8Array(encrypted))
  };
}

/** The expected identifiers must come from a trusted user/context, not the record alone. */
export async function decryptRecord({ contentKey, workspaceId, recordId, record }) {
  requiredId(workspaceId, 'workspaceId');
  requiredId(recordId, 'recordId');
  if (!record || record.format !== FORMAT || record.workspaceId !== workspaceId || record.recordId !== recordId) {
    throw new Error('Registro incompatible con este espacio.');
  }
  validateVersion(record.version);
  const nonce = fromB64url(record.nonce, 12);
  if (nonce.length !== 12) throw new TypeError('Nonce inválido.');
  const ciphertext = fromB64url(record.ciphertext, MAX_CIPHERTEXT_BYTES);
  if (ciphertext.length < 17) throw new TypeError('Ciphertext demasiado corto.');
  const plaintext = await cryptoAPI().subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aadFor(workspaceId, recordId, record.version) },
    contentKey, ciphertext
  );
  return JSON.parse(dec.decode(plaintext));
}
