import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLegacyBackup, stageLegacyMigration } from '../migration/legacy.mjs';
import { createVault, encryptRecord, decryptRecord } from '../security/vault.mjs';

const valid = {
  app:'Plazo', version:2, exportedAt:'2026-10-10T00:00:00.000Z',
  userName:'Traductor demo', goalTarget:3500, nextId:45,
  clients:[{id:1,uid:5,name:'Cliente ficticio',type:'Agencia',color:'#0E7C6B'}],
  projects:[{id:2,uid:5,client:1,name:'Traducción demo',lang:'EN › ES',words:2500,rate:0.07,
    due:Date.UTC(2026,9,11,12),status:'entr'}],
  entries:[{id:3,uid:5,client:1,concept:'Gasto de demostración',type:'gasto',
    amount:75,date:Date.UTC(2026,9,10,12)}]
};
const json = x => JSON.stringify(x);
const ids = () => {
  let n = 0;
  return () => 'new_id_000' + (++n);
};

test('accepts valid legacy format without mutating source JSON', () => {
  const before = json(valid);
  const parsed = parseLegacyBackup(before);
  assert.equal(json(valid), before);
  assert.equal(parsed.projects[0].legacyStatus, 'entr');
  assert.equal(parsed.projects[0].words, 2500);
  assert.equal(parsed.clients.length, 1);
});

test('stages independent unique IDs and preserves client references', () => {
  const { data, preview } = stageLegacyMigration(json(valid), { workspaceId:'workspace_demo_a', idFactory:ids() });
  assert.deepEqual([preview.clients,preview.projects,preview.entries,preview.words],[1,1,1,2500]);
  assert.notEqual(data.clients[0].id, String(valid.clients[0].id));
  assert.equal(data.projects[0].clientId, data.clients[0].id);
  assert.equal(data.entries[0].clientId, data.clients[0].id);
  assert.equal(data.projects[0].currencyAssumption, 'USD');
  assert.equal(data.projects[0].financialStatusNeedsReview, true);
  assert.equal(data.projects[0].legacyStatus, 'entr');
});

test('rejects duplicate IDs, missing references and wrong formats before staging', () => {
  assert.throws(()=>parseLegacyBackup(json({...valid,app:'Other'})),/incompatible/);
  assert.throws(()=>parseLegacyBackup(json({...valid,clients:[valid.clients[0],valid.clients[0]]})),/duplicado/);
  assert.throws(()=>parseLegacyBackup(json({...valid,projects:[{...valid.projects[0],client:99}]})),/sin cliente/);
  assert.throws(()=>parseLegacyBackup('{invalid'),/JSON inválido/);
  assert.throws(()=>parseLegacyBackup(json({...valid,projects:[{...valid.projects[0],words:-1}]})),/número inválido/);
  assert.throws(()=>stageLegacyMigration(json(valid),{workspaceId:'bad space',idFactory:ids()}),/Workspace inválido/);
  assert.throws(()=>stageLegacyMigration(json(valid),{workspaceId:'workspace_demo_a',idFactory:()=> 'same_id_000'}),/ID único/);
});

test('staged business data can be encrypted before sending to any server', async () => {
  const { data } = stageLegacyMigration(json(valid), { workspaceId:'workspace_demo_a', idFactory:ids() });
  const { contentKey } = await createVault();
  const record = await encryptRecord({
    contentKey, workspaceId:'workspace_demo_a', recordId:'clients_batch_001', value:data.clients
  });
  assert.equal(JSON.stringify(record).includes('Cliente ficticio'),false);
  const result = await decryptRecord({
    contentKey, workspaceId:'workspace_demo_a', recordId:'clients_batch_001', record
  });
  assert.deepEqual(result,data.clients);
});
