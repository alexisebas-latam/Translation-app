export const CURRENCIES=['USD','EUR','CLP'];
export const STATUS={pending:'Pendiente',active:'En curso',delivered:'Entregado',cancelled:'Cancelado'};
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function currency(value){if(!CURRENCIES.includes(value))throw new Error('Moneda no válida.');return value;}
export function text(value,max,label,required=false){if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))throw new Error(label+' no válido.');return value.trim();}
export function minor(value,cur='USD'){
 currency(cur);const s=String(value).trim();const d=cur==='CLP'?0:2;
 if(!new RegExp('^\\d+(?:\\.\\d{1,'+(d||1)+'})?$').test(s)||(d===0&&s.includes('.')))throw new Error('Usa un importe positivo con '+d+' decimales como máximo.');
 const [a,b='']=s.split('.');const n=BigInt(a)*10n**BigInt(d)+BigInt(b.padEnd(d,'0')||0);
 if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Importe demasiado grande.');return Number(n);
}
export function decimal(n,cur='USD'){currency(cur);return (Number(n)/(cur==='CLP'?1:100)).toFixed(cur==='CLP'?0:2);}
export function money(n,cur='USD'){currency(cur);return new Intl.NumberFormat('es-CL',{style:'currency',currency:cur,currencyDisplay:'code',maximumFractionDigits:cur==='CLP'?0:2}).format(Number(n)/(cur==='CLP'?1:100));}
export function quote(words,rate,cur){
 currency(cur);if(!Number.isInteger(Number(words))||Number(words)<0||Number(words)>100000000)throw new Error('Cantidad de palabras no válida.');
 const s=String(rate);if(!/^\d+(?:\.\d{1,6})?$/.test(s))throw new Error('Tarifa no válida (máximo 6 decimales).');
 const [a,b='']=s.split('.');const r=BigInt(a)*1000000n+BigInt(b.padEnd(6,'0'));
 const n=(BigInt(words)*r*(cur==='CLP'?1n:100n)+500000n)/1000000n;
 if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Total demasiado grande.');return Number(n);
}
export function date(value,required=false){if(value===null||value===''){if(required)throw new Error('Indica la fecha.');return null;}if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw new Error('Fecha no válida.');return value;}
function clientId(value){if(value==null||value==='')return null;if(!UUID.test(value))throw new Error('Cliente no válido.');return value;}
export function clientInput(v){return {name:text(v.name,120,'Nombre',true),type:text(v.type||'Cliente',80,'Tipo'),email:text(v.email||'',254,'Correo'),notes:text(v.notes||'',4000,'Notas')};}
export function projectInput(v){
 const cur=currency(v.currency);const total=quote(v.words,v.rate,cur);const paid=minor(v.paid||'0',cur);
 if(paid>total)throw new Error('El cobro no puede superar el total del proyecto.');
 if(!Object.hasOwn(STATUS,v.status))throw new Error('Estado no válido.');
 let due=null;if(v.due_at){due=new Date(v.due_at);if(!Number.isFinite(due.getTime()))throw new Error('Entrega no válida.');due=due.toISOString();}
 return {name:text(v.name,180,'Proyecto',true),client_id:clientId(v.client_id),language:text(v.language||'',100,'Idiomas'),service:text(v.service||'Traducción',80,'Servicio'),words:Number(v.words),rate:String(v.rate),quoted_minor:total,paid_minor:paid,currency:cur,status:v.status,due_at:due,paid_date:paid?date(v.paid_date,true):null,notes:text(v.notes||'',4000,'Notas')};
}
export function entryInput(v){const cur=currency(v.currency),amount=minor(v.amount,cur);if(!amount)throw new Error('El importe debe ser mayor que cero.');if(!['income','expense'].includes(v.type))throw new Error('Tipo no válido.');return {concept:text(v.concept,180,'Concepto',true),type:v.type,amount_minor:amount,currency:cur,date:date(v.date,true),client_id:clientId(v.client_id),notes:text(v.notes||'',4000,'Notas')};}
export function monthKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
export function finance(projects,entries,month,cur){
 const p=projects.filter(x=>x.currency===cur),e=entries.filter(x=>x.currency===cur&&x.date.startsWith(month));
 const collected=p.filter(x=>x.paid_date?.startsWith(month)).reduce((a,x)=>a+Number(x.paid_minor),0);
 const extras=e.filter(x=>x.type==='income').reduce((a,x)=>a+Number(x.amount_minor),0),expenses=e.filter(x=>x.type==='expense').reduce((a,x)=>a+Number(x.amount_minor),0);
 const pending=p.filter(x=>x.status!=='cancelled').reduce((a,x)=>a+Number(x.quoted_minor)-Number(x.paid_minor),0);
 return {collected,extras,expenses,net:collected+extras-expenses,pending};
}
export function normalizeBackup(raw){
 if(raw?.app!=='Plazo'||![2,3].includes(raw.version)||!Array.isArray(raw.clients)||!Array.isArray(raw.projects)||!Array.isArray(raw.entries||[]))throw new Error('Este archivo no es un respaldo compatible de Plazo.');
 if([raw.clients,raw.projects,raw.entries||[]].some(x=>x.length>5000))throw new Error('Máximo 5000 registros por sección.');
 const ids=new Map();const isOld=raw.version===2;
 const clients=raw.clients.map(c=>{const id=isOld?crypto.randomUUID():c.id;if(!UUID.test(id)||ids.has(String(c.id)))throw new Error('Identificadores de cliente inválidos o repetidos.');ids.set(String(c.id),id);return {id,...clientInput(c),legacy_id:isOld?'v1-client-'+c.id:c.legacy_id||null};});
 const related=id=>{if(id==null||id==='')return null;const found=ids.get(String(id));if(!found)throw new Error('El respaldo tiene referencias a clientes que faltan.');return found;};
 const projects=raw.projects.map(p=>{
  if(isOld){const cur='USD',total=quote(p.words,p.rate,cur),paid=p.status==='pag';return {id:crypto.randomUUID(),...projectInput({name:p.name,client_id:related(p.client),language:p.lang,words:p.words,rate:String(p.rate),currency:cur,status:({pend:'pending',curso:'active',entr:'delivered',pag:'delivered'})[p.status],due_at:new Date(p.due).toISOString(),paid:paid?decimal(total,cur):'0',paid_date:paid?new Date(p.due).toISOString().slice(0,10):null,notes:p.notes||''}),legacy_id:'v1-project-'+p.id};}
  if(!UUID.test(p.id))throw new Error('Identificador de proyecto inválido.');return {id:p.id,...projectInput({...p,client_id:related(p.client_id),paid:decimal(p.paid_minor,p.currency)}),legacy_id:p.legacy_id||null};
 });
 const entries=(raw.entries||[]).map(e=>{const oldType={ingreso:'income',gasto:'expense'};const id=isOld?crypto.randomUUID():e.id;if(!UUID.test(id))throw new Error('Identificador de movimiento inválido.');return {id,...entryInput(isOld?{...e,type:oldType[e.type]||e.type,client_id:related(e.client),currency:'USD',amount:String(e.amount),date:new Date(e.date).toISOString().slice(0,10)}:{...e,client_id:related(e.client_id),amount:decimal(e.amount_minor,e.currency)}),legacy_id:isOld?'v1-entry-'+e.id:e.legacy_id||null};});
 return {app:'Plazo',version:3,clients,projects,entries};
}
