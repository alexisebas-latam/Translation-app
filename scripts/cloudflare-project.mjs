import {appendFile} from 'node:fs/promises';

const projectName='plazo-app';
const accountId=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!accountId || !token)throw new Error('Falta CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_API_TOKEN en GitHub Actions secrets.');
if(!/^[a-f0-9]{32}$/i.test(accountId))throw new Error('CLOUDFLARE_ACCOUNT_ID debe ser el Account ID de 32 caracteres, no un Zone ID ni correo.');
const root=`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;
async function request(url,method='GET',body){
 const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(!response.ok || !data.success)throw new Error(`Cloudflare ${method}: HTTP ${response.status}; codes ${(data.errors||[]).map(e=>e.code).join(',')}. Comprueba los secretos y el permiso Account / Cloudflare Pages / Edit.`);
 return data;
}
const projects=[];
for(let page=1;;page++){
 const data=await request(`${root}?page=${page}&per_page=20`);
 if(!Array.isArray(data.result))throw new Error('Respuesta de proyectos inválida.');
 projects.push(...data.result);
 if(page>=(data.result_info?.total_pages||1))break;
}
const connected=projects.filter(p=>p.source?.config?.owner==='alexisebas-latam' && p.source?.config?.repo_name==='Translation-app');
if(connected.some(p=>p.name!==projectName))throw new Error('Ya existe otro proyecto vinculado a Translation-app. Revisar su identidad antes de crear un duplicado.');
let project=projects.find(p=>p.name===projectName);
if(project?.source && (project.source.config?.owner!=='alexisebas-latam' || project.source.config?.repo_name!=='Translation-app'))throw new Error('plazo-app pertenece a otro repositorio. No se modificó.');
if(project?.source)throw new Error('plazo-app ya usa integración Git nativa. Revisar esa configuración antes de activar un segundo pipeline.');
if(project && project.production_branch!=='main')throw new Error('plazo-app existe con otra rama de producción. No se modificó.');
if(!project)project=(await request(root,'POST',{name:projectName,production_branch:'main',build_config:{build_command:'npm run build',destination_dir:'dist',root_dir:''}})).result;
if(!project || project.name!==projectName || project.production_branch!=='main')throw new Error('Cloudflare no confirmó el proyecto esperado.');
if(!/^[a-z0-9-]+\.pages\.dev$/.test(project.subdomain||''))throw new Error('Cloudflare no devolvió un dominio pages.dev válido.');
const url=`https://${project.subdomain}/`;
console.log(`Proyecto verificado: ${project.name}; producción: main; URL asignada: ${url}`);
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`url=${url}\n`);
