import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlazoCloud} from '../live/store.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function database(){
 const tables={plazo_workspaces:[],plazo_vaults:[],plazo_encrypted_records:[]};
 const client=userId=>({auth:{getUser:async()=>({data:{user:{id:userId}}}),signOut:async()=>({error:null})},from(table){
  const filters=[];let action='read',value;
  const q={select(){return q;},order(){return q;},eq(k,v){filters.push([k,v]);return q;},insert(v){action='insert';value=v;return q;},update(v){action='update';value=v;return q;},delete(){action='delete';return q;},single(){return exec(true);},maybeSingle(){return exec(true);},then(ok,bad){return exec(false).then(ok,bad);}};
  async function exec(single){
   let rows=tables[table].filter(r=>r.owner_id===userId&&filters.every(([k,v])=>r[k]===v));
   if(action==='insert'){const row={...value};if(table==='plazo_workspaces')row.id=globalThis.crypto.randomUUID();tables[table].push(row);rows=[row];}
   if(action==='update')rows.forEach(r=>Object.assign(r,value));
   if(action==='delete')tables[table]=tables[table].filter(r=>!rows.includes(r));
   return {data:structuredClone(single?(rows[0]||null):rows),error:null};
  }
  return q;
 }});
 return {tables,client};
}
test('live client edits preserve identity and creation date, reencrypt and reject stale simultaneous edits',async()=>{
 const db=database(),cloud=createPlazoCloud(db.client(A));
 const {recoverySecret}=await cloud.initializeVault();
 const id=await cloud.addClient('Cliente original','Agencia');
 const original=(await cloud.listClients())[0];const cipher=db.tables.plazo_encrypted_records[0].ciphertext;
 await cloud.updateClient(id,'Cliente editado','Directo');
 const edited=(await cloud.listClients())[0];assert.equal(edited.id,id);assert.equal(edited.createdAt,original.createdAt);assert.equal(edited.name,'Cliente editado');assert.equal(edited.type,'Directo');
 assert.notEqual(db.tables.plazo_encrypted_records[0].ciphertext,cipher);
 assert.equal(db.tables.plazo_encrypted_records[0].record_version,2);
 assert.ok(!JSON.stringify(db.tables).includes('Cliente editado'));assert.ok(!JSON.stringify(db.tables).includes(recoverySecret));
 const results=await Promise.allSettled([cloud.updateClient(id,'Cambio uno','Agencia'),cloud.updateClient(id,'Cambio dos','Agencia')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 assert.equal(db.tables.plazo_encrypted_records[0].record_version,3);
});
test('live update and delete cannot change another owner, and deletion persists after recovery',async()=>{
 const db=database(),a=createPlazoCloud(db.client(A)),b=createPlazoCloud(db.client(B));
 const recovery=await a.initializeVault();await b.initializeVault();const id=await a.addClient('Solo A');
 await assert.rejects(()=>b.updateClient(id,'Intruso'));await assert.rejects(()=>b.deleteClient(id));assert.equal((await a.listClients()).length,1);
 a.lock();await assert.rejects(()=>a.deleteClient(id));await assert.rejects(()=>a.updateClient(id,'Bloqueado'));
 await a.unlock(recovery.recoverySecret);await a.deleteClient(id);assert.equal((await a.listClients()).length,0);
 const another=createPlazoCloud(db.client(A));await another.unlock(recovery.recoverySecret);assert.equal((await another.listClients()).length,0);
 await assert.rejects(()=>a.deleteClient(id));
});
