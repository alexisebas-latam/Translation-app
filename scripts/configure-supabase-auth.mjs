import {appendFile} from 'node:fs/promises';
const ref='dvqalzgyivqgnenjutub';
const site='https://plazo-app.pages.dev/';
const redirects=[site,site+'?mode=reset'];
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token)throw new Error('Falta SUPABASE_ACCESS_TOKEN en GitHub Actions secrets.');
const endpoint=`https://api.supabase.com/v1/projects/${ref}/config/auth`;
async function config(method='GET',body){
 const response=await fetch(endpoint,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Supabase Auth ${method}: HTTP ${response.status}. Revisar token, proyecto y permisos Auth Config / Project Settings.`);
 const result=await response.json();
 if(typeof result!=='object' || !result || typeof result.site_url!=='string')throw new Error('Respuesta inesperada de Supabase Auth.');
 return result;
}
// Never print the full management response: it can contain SMTP/provider secrets.
const before=await config();
if(typeof before.mailer_autoconfirm!=='boolean')throw new Error('No se pudo verificar la política de confirmación de correo.');
const existing=typeof before.uri_allow_list==='string'?before.uri_allow_list.split(',').map(s=>s.trim()).filter(Boolean):[];
const allow=[...new Set([...existing,...redirects])];
await config('PATCH',{site_url:site,uri_allow_list:allow.join(','),mailer_autoconfirm:false});
const after=await config();
const confirmed=after.uri_allow_list.split(',').map(s=>s.trim());
if(after.site_url!==site || redirects.some(url=>!confirmed.includes(url)) || after.mailer_autoconfirm!==false)throw new Error('La configuración de Auth no coincide con la solicitada.');
console.log('Auth URL Configuration verificada:',JSON.stringify({project:ref,site_url:after.site_url,required_redirects:redirects,email_confirmation:true,signup_enabled:after.disable_signup===false,custom_smtp:Boolean(after.smtp_host)}));
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`## Plazo: Supabase Auth configurado y leído de nuevo\n\nProyecto: ${ref}\n\nSite URL: ${site}\n\nRedirecciones requeridas: ${redirects.join(' · ')}\n\nConfirmación de correo: habilitada.\n\nSMTP personalizado: ${Boolean(after.smtp_host)}.\n\nPendiente: probar entrega de correos, confirmación, inicio de sesión, recuperación y bóveda con usuarios reales.\n`);
