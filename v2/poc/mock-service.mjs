/**
 * NON-PRODUCTION, PROCESS-MEMORY simulator of an identity provider and remote store.
 * No persistence, email verification, auth hardening or security boundary exists.
 * Account access code is a random 256-bit demo credential, not a real login system.
 * Only synthetic data. Do not reuse this class for a SaaS backend.
 */
const clone = value => structuredClone(value);
const api = () => {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Web Crypto no disponible.');
  }
  return globalThis.crypto;
};
function token() {
  const bytes = api().getRandomValues(new Uint8Array(32));
  const chars = Array.from(bytes, n=>String.fromCharCode(n)).join('');
  return btoa(chars).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
async function fingerprint(accessCode) {
  if (typeof accessCode !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(accessCode)) {
    throw new Error('Código de demostración inválido.');
  }
  const bytes = new TextEncoder().encode(accessCode);
  return new Uint8Array(await api().subtle.digest('SHA-256',bytes));
}
function constantTimeEqual(a,b) {
  if (a.length !== b.length) return false;
  let difference=0;
  for(let i=0;i<a.length;i++) difference |= a[i]^b[i];
  return difference===0;
}
function invalidSession() {
  throw new Error('Sesión simulada no válida.');
}
export function createMockService() {
  const accounts = new Map();
  const sessions = new Map();
  const vaults = new Map();
  const records = new Map();
  function owner(session) {
    if (typeof session !== 'string') invalidSession();
    const accountId=sessions.get(session);
    if (!accountId || !accounts.has(accountId)) invalidSession();
    return accountId;
  }
  return Object.freeze({
    async register(displayName) {
      if(typeof displayName!=='string'||!displayName.trim()||displayName.trim().length>80){
        throw new TypeError('Se requiere un nombre de demostración válido.');
      }
      const accountId='acct_'+api().randomUUID();
      const accessCode=token();
      accounts.set(accountId,{displayName:displayName.trim(),fingerprint:await fingerprint(accessCode)});
      return { accountId, accessCode };
    },
    async login(accountId,accessCode) {
      const account=accounts.get(accountId);
      // In production, authentication belongs to the external Auth service.
      let supplied;
      try {supplied=await fingerprint(accessCode);}catch{throw new Error('Credenciales de prueba incorrectas.');}
      if(!account || !constantTimeEqual(supplied,account.fingerprint)) {
        throw new Error('Credenciales de prueba incorrectas.');
      }
      const session=token();
      sessions.set(session,accountId);
      return session;
    },
    logout(session) {sessions.delete(session);},
    setVault(session,envelope) {
      const accountId=owner(session);
      if(vaults.has(accountId)) throw new Error('La bóveda ya existe.');
      if(!envelope||envelope.format!==1||envelope.cipher!=='AES-256-GCM'||
         typeof envelope.nonce!=='string'||typeof envelope.wrappedKey!=='string') {
        throw new TypeError('Sobre de clave inválido.');
      }
      vaults.set(accountId,clone(envelope));
      records.set(accountId,new Map());
    },
    getVault(session) {
      const accountId=owner(session);
      if(!vaults.has(accountId)) throw new Error('La cuenta aún no tiene bóveda.');
      return clone(vaults.get(accountId));
    },
    putEncrypted(session,record) {
      const accountId=owner(session);
      if(!vaults.has(accountId)) throw new Error('La cuenta aún no tiene bóveda.');
      if(!record||record.format!==1||record.workspaceId!==accountId||
         typeof record.recordId!=='string'||!/^client_[\w-]{10,100}$/.test(record.recordId)||
         !Number.isSafeInteger(record.version)||record.version<1||
         typeof record.nonce!=='string'||typeof record.ciphertext!=='string'||
         !/^[a-zA-Z0-9_-]{10,7000000}$/.test(record.ciphertext)) {
        throw new TypeError('Registro cifrado inválido para esta cuenta.');
      }
      // Persist only encrypted fields. No plaintext names, prices or content.
      const stored={format:record.format,workspaceId:accountId,recordId:record.recordId,
        version:record.version,nonce:record.nonce,ciphertext:record.ciphertext};
      records.get(accountId).set(stored.recordId,clone(stored));
      return stored.recordId;
    },
    listEncrypted(session) {
      const accountId=owner(session);
      if(!records.has(accountId)) throw new Error('No hay bóveda activa.');
      return clone([...records.get(accountId).values()]);
    },
    inspectOpaqueStateForTestOnly() {
      return clone({accounts:[...accounts.keys()],vaults:[...vaults.entries()],
        records:[...records.entries()].map(([accountId,rs])=>[accountId,[...rs.values()]])});
    }
  });
}
