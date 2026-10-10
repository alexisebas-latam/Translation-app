/**
 * Read-only Plazo 1.x JSON backup validator and local migration planner.
 * Never uploads, deletes or overwrites anything. All returned business data
 * is PLAINTEXT and must be encrypted in the browser prior to cloud sync.
 */
const MAX_BYTES = 5_000_000;
const MAX_OBJECTS = 10000;
const ST = new Set(['pend', 'curso', 'entr', 'pag']);
const TYPES = new Set(['ingreso', 'gasto']);
const encoder = new TextEncoder();

function text(v, label, max=500) {
  if (typeof v !== 'string' || v.trim().length === 0 || v.length > max) {
    throw new TypeError(label + ': texto inválido.');
  }
  return v.trim();
}
function number(v, label, max=1e12) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) {
    throw new TypeError(label + ': número inválido.');
  }
  return v;
}
function integer(v, label) {
  if (!Number.isSafeInteger(v) || v <= 0) throw new TypeError(label + ': ID inválido.');
  return v;
}
function timestamp(v, label) {
  number(v, label, 4_102_444_800_000);
  if (v < 946_684_800_000) throw new TypeError(label + ': fecha fuera de rango.');
  return v;
}
function collection(items, label) {
  if (!Array.isArray(items) || items.length > MAX_OBJECTS) throw new TypeError(label + ': colección inválida.');
  const ids = new Set();
  for (const it of items) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) throw new TypeError(label + ': objeto inválido.');
    const id = integer(it.id, label + '.id');
    if (ids.has(id)) throw new TypeError(label + ': ID duplicado.');
    ids.add(id);
  }
  return ids;
}
function newUnique(factory, seen) {
  for (let i=0; i<8; i++) {
    const result = factory();
    if (typeof result === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(result) && !seen.has(result)) {
      seen.add(result);
      return result;
    }
  }
  throw new TypeError('No fue posible crear ID único.');
}
export function parseLegacyBackup(json) {
  if (typeof json !== 'string' || encoder.encode(json).length > MAX_BYTES) {
    throw new TypeError('Respaldo no válido o superior a 5 MB.');
  }
  let data;
  try { data = JSON.parse(json); } catch { throw new TypeError('JSON inválido.'); }
  if (!data || Array.isArray(data) || data.app !== 'Plazo' || data.version !== 2) {
    throw new TypeError('Formato de respaldo incompatible.');
  }
  const clientIds = collection(data.clients, 'clientes');
  collection(data.projects, 'proyectos');
  collection(data.entries ?? [], 'movimientos');
  const clients = data.clients.map(c=>({
    id:c.id, name:text(c.name,'cliente.nombre'), type:text(c.type,'cliente.tipo'),
    color:typeof c.color==='string' && /^#[0-9a-fA-F]{6}$/.test(c.color)?c.color:'#0E7C6B'
  }));
  const projects = data.projects.map(p=>{
    if (!clientIds.has(p.client)) throw new TypeError('Proyecto sin cliente.');
    if (!ST.has(p.status)) throw new TypeError('Estado de proyecto inválido.');
    return { id:p.id, client:p.client, name:text(p.name,'proyecto.nombre'),
      lang:text(p.lang,'proyecto.idiomas',100), words:number(p.words,'palabras',1e9),
      rate:number(p.rate,'tarifa',1e7), due:timestamp(p.due,'entrega'), legacyStatus:p.status };
  });
  const entries=(data.entries??[]).map(e=>{
    if (!TYPES.has(e.type)) throw new TypeError('Tipo de movimiento inválido.');
    if (e.client != null && !clientIds.has(e.client)) throw new TypeError('Movimiento sin cliente.');
    return {id:e.id, client:e.client??null, concept:text(e.concept,'movimiento.concepto'),
      type:e.type, amount:number(e.amount,'monto'), date:timestamp(e.date,'fecha')};
  });
  return { clients, projects, entries,
    userName:typeof data.userName==='string'?data.userName.slice(0,250):'',
    goalTarget:data.goalTarget == null?null:number(data.goalTarget,'meta'),
    sourceVersion:2 };
}
export function stageLegacyMigration(json, { workspaceId, idFactory=()=>globalThis.crypto.randomUUID() }={}) {
  text(workspaceId,'workspaceId',100);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(workspaceId)) throw new TypeError('Workspace inválido.');
  const source=parseLegacyBackup(json);
  const seen=new Set(), mapping=new Map();
  const clients=source.clients.map(c=>{
    const id=newUnique(idFactory,seen);
    mapping.set(c.id,id);
    return {id, workspaceId, name:c.name, type:c.type, color:c.color};
  });
  const projects=source.projects.map(p=>({
    id:newUnique(idFactory,seen), workspaceId, clientId:mapping.get(p.client),
    name:p.name, sourceLangPair:p.lang, unit:'word', unitCount:p.words, unitRate:p.rate,
    currencyAssumption:'USD', dueAt:new Date(p.due).toISOString(),
    legacyStatus:p.legacyStatus, financialStatusNeedsReview:true
  }));
  const entries=source.entries.map(e=>({
    id:newUnique(idFactory,seen), workspaceId, clientId:e.client===null?null:mapping.get(e.client),
    concept:e.concept, kind:e.type, amount:e.amount, currencyAssumption:'USD',
    occurredAt:new Date(e.date).toISOString()
  }));
  return {
    data: {workspaceId, clients, projects, entries, profile:{displayName:source.userName,goalTarget:source.goalTarget}},
    preview: {clients:clients.length,projects:projects.length,entries:entries.length,
      words:projects.reduce((sum,p)=>sum+p.unitCount,0), currencyAssumption:'USD',
      financialStatusNeedsReview:true, originalBackupRetainedByCaller:true}
  };
}
