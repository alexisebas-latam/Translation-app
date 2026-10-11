import {appendFile} from 'node:fs/promises';
const base=new URL(process.env.PLAZO_PUBLIC_URL);
if(base.protocol!=='https:' || !/^[a-z0-9-]+\.pages\.dev$/.test(base.hostname))throw new Error('URL de Cloudflare inválida.');
let verified=false,lastError;
for(let attempt=0;attempt<12;attempt++){
 try{
  const response=await fetch(base,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`HTML HTTP ${response.status}`);
  const html=await response.text();
  if(!html.includes('Plazo') || !html.includes('beta'))throw new Error('HTML no corresponde a Plazo 2.0 beta.');
  const path=html.match(/<script[^>]+src="([^"]*assets\/[^"/]+\.js)"/)?.[1];
  if(!path)throw new Error('Falta el bundle compilado de Vite.');
  const asset=new URL(path,base);
  if(asset.origin!==base.origin)throw new Error('Bundle fuera del origen esperado.');
  const bundle=await fetch(asset,{signal:AbortSignal.timeout(15000)});
  if(!bundle.ok)throw new Error(`Bundle HTTP ${bundle.status}`);
  const code=await bundle.text();
  if(!code.includes('dvqalzgyivqgnenjutub.supabase.co'))throw new Error('Proyecto Supabase incorrecto.');
  if(code.includes('sb_secret_') && /sb_secret_[A-Za-z0-9_-]{20,}/.test(code))throw new Error('Posible clave privada en el bundle.');
  console.log(`Verificado: ${base.href}; bundle: ${asset.pathname}; Supabase correcto.`);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`## Plazo: despliegue comprobado\n\nURL: ${base.href}\n\nCommit: ${process.env.GITHUB_SHA}\n\nHTML y JavaScript compilados: HTTP 200. Proyecto Supabase correcto.\n\nPendientes: autenticación real, confirmación de correo, recuperación, RLS con dos usuarios y sincronización entre dispositivos.\n`);
  verified=true;break;
 }catch(error){lastError=error;console.log(`Verificación ${attempt+1}: ${error.message}`);}
 if(attempt<11)await new Promise(resolve=>setTimeout(resolve,5000));
}
if(!verified)throw lastError;
