import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockService } from '../poc/mock-service.mjs';
import { createDemoDevice } from '../poc/device.mjs';

test('registration -> unlock -> save -> second simulated device -> recover', async () => {
  const service=createMockService();
  const deviceA=createDemoDevice(service);
  const credentials=await deviceA.register('Usuario ficticio A');
  assert.equal(deviceA.unlocked,true);
  assert.equal(credentials.recoverySecret.length,43);
  assert.equal(credentials.accessCode.length,43);
  assert.notEqual(credentials.accessCode,credentials.recoverySecret);
  await deviceA.addClient('Agencia Sol Ficticia','Agencia');
  await deviceA.addClient('Cliente Río Ficticio','Directo');
  const names=(await deviceA.listClients()).map(x=>x.name);
  assert.deepEqual(names,['Agencia Sol Ficticia','Cliente Río Ficticio']);
  const stored=JSON.stringify(service.inspectOpaqueStateForTestOnly());
  assert.doesNotMatch(stored,/Agencia Sol Ficticia|Cliente Río Ficticio/);
  assert.equal(stored.includes(credentials.recoverySecret),false);
  assert.equal(stored.includes(credentials.accessCode),false);

  const deviceB=createDemoDevice(service);
  await deviceB.signIn(credentials);
  assert.equal(deviceB.unlocked,true);
  assert.deepEqual((await deviceB.listClients()).map(x=>x.name),names);
  deviceA.logout();
  assert.equal(deviceA.unlocked,false);
  await assert.rejects(deviceA.listClients(),/bloqueado/);
  assert.deepEqual((await deviceB.listClients()).map(x=>x.name),names);
});

test('second device rejects incorrect vault recovery without granting access', async () => {
  const service=createMockService();
  const original=createDemoDevice(service);
  const credentials=await original.register('Cliente ficticio');
  const different=createDemoDevice(service);
  const another=await different.register('Segunda cuenta ficticia');
  const badDevice=createDemoDevice(service);
  await assert.rejects(badDevice.signIn({...credentials,recoverySecret:another.recoverySecret}),/desbloquear/);
  assert.equal(badDevice.unlocked,false);
  await badDevice.signIn(credentials);
  assert.equal(badDevice.unlocked,true);
});

test('authentication mock does not accept the recovery key as a login token', async () => {
  const service=createMockService();
  const original=createDemoDevice(service);
  const account=await original.register('Demo A');
  const other=createDemoDevice(service);
  await assert.rejects(other.signIn({...account,accessCode:account.recoverySecret}),/Credenciales de prueba incorrectas/);
  assert.equal(other.unlocked,false);
});

test('opaque store denies cross-account access even if workspace IDs are forged', async () => {
  const service=createMockService();
  const a=createDemoDevice(service),b=createDemoDevice(service);
  const ca=await a.register('Demo A');
  const cb=await b.register('Demo B');
  await a.addClient('Cliente privado A');
  await b.addClient('Cliente privado B');
  assert.deepEqual((await a.listClients()).map(x=>x.name),['Cliente privado A']);
  assert.deepEqual((await b.listClients()).map(x=>x.name),['Cliente privado B']);

  const sessionA=await service.login(ca.accountId,ca.accessCode);
  const sessionB=await service.login(cb.accountId,cb.accessCode);
  const blobA=service.listEncrypted(sessionA)[0];
  assert.throws(()=>service.putEncrypted(sessionB,blobA),/inválido para esta cuenta/);
  assert.deepEqual(service.listEncrypted(sessionB).map(x=>x.workspaceId),[cb.accountId]);
  service.logout(sessionA);
  assert.throws(()=>service.listEncrypted(sessionA),/Sesión simulada no válida/);
  await assert.rejects(service.login(ca.accountId,cb.accessCode),/Credenciales de prueba incorrectas/);
});

test('demo provides no persistence or actual identity guarantees', async () => {
  const one=createMockService(),a=createDemoDevice(one);
  const credentials=await a.register('Cuenta temporal');
  const fresh=createMockService();
  await assert.rejects(fresh.login(credentials.accountId,credentials.accessCode),/incorrectas/);
});

test('responsive lab defines desktop sidebar and mobile bottom navigation',()=>{
  const fs=process.getBuiltinModule('node:fs');
  const css=fs.readFileSync(new URL('../demo/styles.css',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../demo/index.html',import.meta.url),'utf8');
  const js=fs.readFileSync(new URL('../demo/main.mjs',import.meta.url),'utf8');
  assert.match(html,/name="viewport"/);
  assert.match(html,/class="sidebar"/);
  assert.match(html,/class="mobile-nav"/);
  assert.match(css,/@media\s*\(max-width:\s*780px\)/);
  assert.match(css,/\.mobile-nav\s*\{/);
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(js,/createDemoDevice/);
  assert.doesNotMatch(js,/innerHTML/);
});
