// Baseline of EXISTING Plazo 1.x behavior. These are characterization tests,
 // not proof of security, correct accounting or reliable IndexedDB.
 // No real data, secrets, third-party packages, browser requests or writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../legacy/sw.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

function between(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Cannot extract original source between ${start} and ${end}`);
  return html.slice(from, to);
}

const core = between('/* ===================== ALMACENAMIENTO', '/* ===================== SEED');
const seed = between('/* ===================== SEED', 'function currentUser()');
const dates = between('function countdown(due){', '/* ===================== RENDER');
const finance = between("const MES=['Enero'", 'function renderFinanzas(){');
const earned = between('function currentMonthEarned(){', 'let goalTarget=3500;');
const gate = between('function canAddClient(){', '/* ===================== MODALES');

function createLegacyContext(...sections) {
  // window without IndexedDB makes the original code select its memory fallback.
  const context = vm.createContext({ window: {}, console });
  for (const section of [core, ...sections]) vm.runInContext(section, context, { timeout: 1000 });
  return { context, call: (code) => vm.runInContext(code, context, { timeout: 1000 }) };
}

test('repository contains valid PWA manifest and declared icons', () => {
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.name, /Plazo/);
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(new URL('../' + icon.src, import.meta.url)), icon.src);
  }
});

test('the current service worker is cache-first and precaches only same-origin assets', () => {
  assert.match(sw, /caches\.match\(req\)/);
  assert.match(sw, /origin !== self\.location\.origin/);
  assert.match(sw, /index\.html/);
  // This test documents current behavior, NOT correct update strategies.
});

test('legacy fallback keeps records and settings in memory when IndexedDB is absent', async () => {
  const { call } = createLegacyContext();
  await call('idbOpen()');
  assert.equal(call('useMemory'), true);
  await call('put("clients", {id: 42, name: "Agencia ficticia"})');
  const clients = await call('getAll("clients")');
  assert.equal(clients.length, 1);
  assert.equal(clients[0].name, 'Agencia ficticia');
  await call('setMeta("unit_test", 7)');
  assert.equal(await call('getMeta("unit_test")'), 7);
  await call('del("clients", 42)');
  assert.equal((await call('getAll("clients")')).length, 0);
});

test('legacy initial demo creates three clients and five projects exactly once', async () => {
  const { call } = createLegacyContext(seed);
  await call('idbOpen()');
  await call('seedIfEmpty()');
  assert.equal((await call('getAll("clients")')).length, 3);
  assert.equal((await call('getAll("projects")')).length, 5);
  await call('seedIfEmpty()');
  assert.equal((await call('getAll("projects")')).length, 5);
  assert.equal(await call('getMeta("seeded")'), true);
});

test('legacy value formula multiplies word count by rate', () => {
  const { call } = createLegacyContext();
  assert.ok(Math.abs(call('value({words: 2500, rate: 0.07})') - 175) < 1e-9);
});

test('legacy deadline classification highlights an overdue task', () => {
  const { call } = createLegacyContext(dates);
  const result = call('countdown(Date.now() - 86400000)');
  assert.equal(result.overdue, true);
  assert.equal(result.level, 'urgent');
});

test('legacy financial monthly totals include projects irrespective of payment status', () => {
  const { call } = createLegacyContext(finance);
  // Characterization of known defect F-09, NOT desired future accounting.
  call('projects=[{due:new Date(2026,9,15).getTime(),words:1000,rate:0.10,status:"pend"}]');
  const month = call('projIncomeMonth(2026, 9)');
  assert.equal(month, 100);
});

test('legacy earned goal treats delivered and paid equally', () => {
  const { call } = createLegacyContext(earned);
  call('projects=[{due:Date.now(),words:1000,rate:0.1,status:"entr"}, {due:Date.now(),words:1000,rate:0.1,status:"pag"}, {due:Date.now(),words:1000,rate:0.1,status:"pend"}]');
  assert.equal(call('currentMonthEarned()'), 200);
  // Known defect: earning and cash receipts are not separated.
});

test('legacy free gate uses 3 client and 5 active project limits on UI only', () => {
  const { call } = createLegacyContext(gate);
  call('licensed=false; clients=[{id:1},{id:2},{id:3}]; projects=[]');
  assert.equal(call('canAddClient()'), false);
  call('licensed=true');
  assert.equal(call('canAddClient()'), true);
  call('licensed=false; projects=[...Array.from({length:5},(_,i)=>({id:i,status:"curso"}))]');
  assert.equal(call('canAddActive()'), false);
});

test('legacy manual backup format is versioned but exported without encryption', () => {
  assert.match(html, /version:2,exportedAt:/);
  assert.match(html, /JSON\.stringify\(data,null,2\)/);
});

test.todo('F-02: hostile names and imported fields must not become executable HTML');
test.todo('F-03/F-06: imports must be atomic and must never overwrite another profile');
test.todo('F-05: failed IndexedDB transactions must not show a success state');
test.todo('F-07/F-08: Free/Pro entitlements must be enforced in the backend');
test.todo('F-09/F-10: pending, invoiced and paid values must be reported separately');
test.todo('F-12: service worker updates must not retain stale application versions');
