/**
 * Plazo 2.0 — authenticated cloud adapter. This module is intentionally
 * independent of the SDK implementation for deterministic unit tests.
 * The server only receives ciphertext, nonce and opaque record identifiers.
 *
 * PROTOTYPE. Auth policy and E2EE have not been independently audited.
 */
import {createVault,unlockVault,encryptRecord,decryptRecord} from '../security/vault.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function unwrap(response, context){
  if(response?.error)throw new Error(context+': '+(response.error.code||response.error.message||'error'));
  return response?.data ?? null;
}
function checkUser(user){
  if(!user || !UUID.test(user.id))throw new Error('Inicia sesión con una cuenta de Supabase válida.');
  if(user.is_anonymous)throw new Error('Las cuentas anónimas no están habilitadas en Plazo.');
  return user;
}
function checkClient(name,type){
  if(typeof name!=='string'||!name.trim()||name.trim().length>120)
    throw new TypeError('Nombre de cliente inválido.');
  if(typeof type!=='string'||!type.trim()||type.trim().length>80)
    throw new TypeError('Tipo de cliente inválido.');
}
function checkClientId(id){
  if(typeof id!=='string'||!id.startsWith('client_')||!UUID.test(id.slice(7)))
    throw new TypeError('Identificador de cliente inválido.');
}
export function createPlazoCloud(supabase){
  if(!supabase?.auth?.getUser || !supabase?.from)throw new TypeError('Falta un cliente Supabase válido.');
  let workspaceId=null,userId=null,key=null;

  async function authenticated(){
    const user=checkUser(unwrap(await supabase.auth.getUser(),'Sesión')?.user);
    if(userId && user.id!==userId){
      workspaceId=null;key=null;
    }
    userId=user.id;
    return user;
  }
  async function getWorkspace(){
    const user=await authenticated();
    const data=unwrap(await supabase.from('plazo_workspaces')
      .select('id,owner_id').eq('owner_id',user.id).maybeSingle(),'Consultar espacio');
    if(!data)return null;
    if(data.owner_id!==user.id||!UUID.test(data.id))throw new Error('Respuesta de espacio inesperada.');
    workspaceId=data.id;
    return data;
  }
  async function ensureWorkspace(){
    const previous=await getWorkspace();
    if(previous)return previous;
    const user=await authenticated();
    const inserted=await supabase.from('plazo_workspaces')
      .insert({owner_id:user.id}).select('id,owner_id').single();
    if(inserted.error?.code==='23505'){
      const race=await getWorkspace();
      if(race)return race;
    }
    const workspace=unwrap(inserted,'Crear espacio');
    if(!workspace||workspace.owner_id!==user.id||!UUID.test(workspace.id)){
      throw new Error('No se pudo verificar el espacio de trabajo.');
    }
    workspaceId=workspace.id;
    return workspace;
  }
  async function getEnvelope(){
    await ensureWorkspace();
    const data=unwrap(await supabase.from('plazo_vaults')
      .select('workspace_id,owner_id,format_version,cipher,nonce,wrapped_key')
      .eq('workspace_id',workspaceId).maybeSingle(),'Consultar bóveda');
    if(!data)return null;
    if(data.workspace_id!==workspaceId||data.owner_id!==userId)
      throw new Error('La bóveda no pertenece a esta cuenta.');
    return {format:data.format_version,cipher:data.cipher,
      nonce:data.nonce,wrappedKey:data.wrapped_key};
  }
  return Object.freeze({
    get ready(){return Boolean(workspaceId && key);},
    get workspaceId(){return workspaceId;},
    async currentUser(){return authenticated();},
    async ensureWorkspace(){return ensureWorkspace();},
    async vaultExists(){return Boolean(await getEnvelope());},
    async initializeVault(){
      if(await getEnvelope())throw new Error('La bóveda ya existe. Utiliza tu clave de recuperación.');
      const owner=await authenticated();
      const generated=await createVault();
      const response=await supabase.from('plazo_vaults').insert({
        workspace_id:workspaceId,owner_id:owner.id,
        format_version:generated.envelope.format,cipher:generated.envelope.cipher,
        nonce:generated.envelope.nonce,wrapped_key:generated.envelope.wrappedKey
      }).select('workspace_id').single();
      if(response.error){
        key=null;throw new Error('No se pudo crear la bóveda. Comprueba si ya existe antes de repetir.');
      }
      if(response.data?.workspace_id!==workspaceId)throw new Error('Respuesta de bóveda inesperada.');
      key=generated.contentKey;
      return {recoverySecret:generated.recoverySecret};
    },
    async unlock(recoverySecret){
      key=null;
      const envelope=await getEnvelope();
      if(!envelope)throw new Error('No hay bóveda registrada.');
      try{key=await unlockVault(envelope,recoverySecret);}
      catch{throw new Error('La clave de recuperación no es correcta o la bóveda está dañada.');}
      return true;
    },
    async addClient(name,type='Agencia'){
      if(!key||!workspaceId)throw new Error('Desbloquea la bóveda antes de guardar.');
      const user=await authenticated();
      checkClient(name,type);
      const id='client_'+globalThis.crypto.randomUUID();
      const record=await encryptRecord({contentKey:key,workspaceId,recordId:id,
        value:{name:name.trim(),type:type.trim(),createdAt:new Date().toISOString()}});
      // Strict whitelist. No plaintext values, secret or financial fields are uploaded.
      unwrap(await supabase.from('plazo_encrypted_records').insert({
        workspace_id:workspaceId,owner_id:user.id,record_id:record.recordId,
        format_version:record.format,record_version:record.version,
        nonce:record.nonce,ciphertext:record.ciphertext
      }),'Guardar registro cifrado');
      return id;
    },
    async updateClient(id,name,type='Cliente'){
      if(!key||!workspaceId)throw new Error('Desbloquea la bóveda antes de editar.');
      checkClientId(id);checkClient(name,type);
      const user=await authenticated();
      const row=unwrap(await supabase.from('plazo_encrypted_records')
        .select('workspace_id,owner_id,record_id,format_version,record_version,nonce,ciphertext')
        .eq('workspace_id',workspaceId).eq('owner_id',user.id).eq('record_id',id).maybeSingle(),'Consultar cliente');
      if(!row)throw new Error('El cliente ya no existe. Actualiza la lista.');
      if(row.owner_id!==user.id||row.workspace_id!==workspaceId||row.record_id!==id)
        throw new Error('El registro no pertenece a esta cuenta.');
      const previous=await decryptRecord({contentKey:key,workspaceId,recordId:id,record:{
        format:row.format_version,workspaceId,recordId:id,version:row.record_version,
        nonce:row.nonce,ciphertext:row.ciphertext
      }});
      const record=await encryptRecord({contentKey:key,workspaceId,recordId:id,
        version:row.record_version+1,value:{...previous,name:name.trim(),type:type.trim()}});
      const saved=unwrap(await supabase.from('plazo_encrypted_records').update({
        format_version:record.format,record_version:record.version,
        nonce:record.nonce,ciphertext:record.ciphertext
      }).eq('workspace_id',workspaceId).eq('owner_id',user.id).eq('record_id',id)
        .eq('record_version',row.record_version).select('record_id').maybeSingle(),'Editar cliente');
      if(saved?.record_id!==id)throw new Error('El cliente cambió en otro dispositivo. Actualiza antes de editar.');
      return id;
    },
    async deleteClient(id){
      if(!key||!workspaceId)throw new Error('Desbloquea la bóveda antes de eliminar.');
      checkClientId(id);
      const user=await authenticated();
      const deleted=unwrap(await supabase.from('plazo_encrypted_records').delete()
        .eq('workspace_id',workspaceId).eq('owner_id',user.id).eq('record_id',id)
        .select('record_id').maybeSingle(),'Eliminar cliente');
      if(deleted?.record_id!==id)throw new Error('El cliente ya no existe o no pudo eliminarse. Actualiza la lista.');
      return id;
    },
    async listClients(){
      if(!key||!workspaceId)throw new Error('Desbloquea la bóveda para consultar.');
      await authenticated();
      const rows=unwrap(await supabase.from('plazo_encrypted_records')
        .select('workspace_id,owner_id,record_id,format_version,record_version,nonce,ciphertext')
        .eq('workspace_id',workspaceId).order('created_at',{ascending:true}),'Consultar registros') ?? [];
      if(!Array.isArray(rows))throw new Error('Respuesta de registros inválida.');
      const output=[];
      for(const row of rows){
        if(row.owner_id!==userId||row.workspace_id!==workspaceId)
          throw new Error('El servidor respondió con un registro de otra cuenta.');
        if(!row.record_id.startsWith('client_'))continue;
        const record={
          format:row.format_version,workspaceId:row.workspace_id,
          recordId:row.record_id,version:row.record_version,
          nonce:row.nonce,ciphertext:row.ciphertext
        };
        const payload=await decryptRecord({contentKey:key,workspaceId,
          recordId:row.record_id,record});
        output.push({id:row.record_id,...payload});
      }
      return output;
    },
    lock(){key=null;},
    async signOut(){
      key=null;workspaceId=null;userId=null;
      const {error}=await supabase.auth.signOut();
      if(error)throw new Error('No se pudo cerrar la sesión remota. Inténtalo nuevamente.');
    }
  });
}
