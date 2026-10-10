/**
 * Simulated device controller. Never persists recovery secrets or creates
 * backend identity; this is a standalone, in-process proof of concept.
 */
import {createVault,unlockVault,encryptRecord,decryptRecord} from '../security/vault.mjs';

export function createDemoDevice(service) {
  if (!service) throw new TypeError('Falta servicio simulado.');
  let session=null,accountId=null,contentKey=null;
  const locked=()=>{if(!session||!accountId||!contentKey)throw new Error('Dispositivo bloqueado.');};
  return Object.freeze({
    get unlocked(){return Boolean(session&&accountId&&contentKey);},
    get accountId(){return accountId;},
    async register(displayName){
      if(session) throw new Error('Cierra la sesión anterior.');
      const account=await service.register(displayName);
      const initialSession=await service.login(account.accountId,account.accessCode);
      try{
        const vault=await createVault();
        service.setVault(initialSession,vault.envelope);
        session=initialSession;accountId=account.accountId;contentKey=vault.contentKey;
        return {accountId,accessCode:account.accessCode,recoverySecret:vault.recoverySecret};
      } catch(err){service.logout(initialSession);throw err;}
    },
    async signIn({accountId:id,accessCode,recoverySecret}){
      if(session) throw new Error('Cierra la sesión anterior.');
      const candidate=await service.login(id,accessCode);
      try{
        const envelope=service.getVault(candidate);
        const key=await unlockVault(envelope,recoverySecret);
        session=candidate;accountId=id;contentKey=key;
        return {accountId};
      }catch(err){
        service.logout(candidate);
        throw new Error('No se pudo desbloquear la bóveda. Comprueba el código de recuperación.');
      }
    },
    async addClient(name,type='Agencia'){
      locked();
      if(typeof name!=='string'||!name.trim()||name.trim().length>120) throw new TypeError('Nombre inválido.');
      if(typeof type!=='string'||!type.trim()||type.trim().length>80) throw new TypeError('Tipo inválido.');
      const recordId='client_'+globalThis.crypto.randomUUID();
      const record=await encryptRecord({contentKey,workspaceId:accountId,recordId,
        value:{name:name.trim(),type:type.trim(),createdAt:new Date().toISOString()}});
      service.putEncrypted(session,record);
      return recordId;
    },
    async listClients(){
      locked();
      const encrypted=service.listEncrypted(session);
      const result=[];
      for(const record of encrypted){
        result.push({id:record.recordId,...await decryptRecord({
          contentKey,workspaceId:accountId,recordId:record.recordId,record
        })});
      }
      return result;
    },
    logout(){
      if(session) service.logout(session);
      session=null;accountId=null;contentKey=null;
    }
  });
}
