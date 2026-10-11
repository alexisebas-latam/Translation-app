import {appendFile} from 'node:fs/promises';

const projectName='plazo-app';
const accountId=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!accountId || !token)throw new Error('Falta CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_API_TOKEN en GitHub Actions secrets.');
if(!/^[a-f0-9]{32}$/i.test(accountId))throw new Error('CLOUDFLARE_ACCOUNT_ID debe ser el Account ID de 32 caracteres, no un Zone ID ni correo.');
const root=`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;
async function request(url,method='GET',body){
 const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:(body?JSON.stringify(body):undefined),signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(!response.ok || !data.success)throw new Error(`Cloudflare ${method}: HTTP ${response.status}; codes ${(data.errors||[]).map(e=>e.code).join(',')}. Comprueba los secretos y el permiso Account / Cloudflare Pages / Edit.`);
 return data;
}
const projects=[];
for(let page=1;;page++){
 const data=await request(page===1 ? root : `${root}?page=${page}`);
 if(!Array.isArray(data.result))throw new Error('Respuesta de proyectos inválida.');
 projects.push(...data.result);
 if(page>=(data.result_info?.total_pages||1))break;
}
const connected=projects.filter(p=>p.source?.config?.owner==='alexisebas-latam' && p.source?.config?.repo_name==='Translation-app');
if(connected.some(p=>p.name!==projectName))throw new Error('Ya existe otro proyecto vinculado a Translation-app. Revisar su identidad antes de crear un duplicado.');
let project=projects.find(p=>p.name===projectName);
if(project?.source && (project.source.config?.owner!=='alexisebas-latam' || project.source.config?.repo_name!=='Translation-app'))throw new Error('plazo-app pertenece a otro repositorio. No se modificó.');
const nativeGit=Boolean(project?.source);
if(nativeGit){
 console.log('Integración Git confirmada: alexisebas-latam/Translation-app.');
 project=(await request(`${root}/${projectName}`,'PATCH',{
  production_branch:'main',
  build_config:{build_command:'npm run build',destination_dir:'dist',root_dir:'/'},
  source:{type:'github',config:{...project.source.config,production_branch:'main',production_deployments_enabled:true}}
 })).result;
 if(project.build_config?.build_command!=='npm run build' || project.build_config?.destination_dir!=='dist' || !project.source?.config?.production_deployments_enabled)throw new Error('Cloudflare no confirmó la configuración Vite y Git automática.');
}

if(project && project.production_branch!=='main')throw new Error('plazo-app existe con otra rama de producción. No se modificó.');
if(!project)project=(await request(root,'POST',{name:projectName,production_branch:'main',build_config:{build_command:'npm run build',destination_dir:'dist',root_dir:''}})).result;
if(!project || project.name!==projectName || project.production_branch!=='main')throw new Error('Cloudflare no confirmó el proyecto esperado.');
if(!/^[a-z0-9-]+\.pages\.dev$/.test(project.subdomain||''))throw new Error('Cloudflare no devolvió un dominio pages.dev válido.');
const url=`https://${project.subdomain}/`;
console.log(`Proyecto verificado: ${project.name}; producción: main; URL asignada: ${url}`);
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`url=${url}\n`);

if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`native_git=${nativeGit}\n`);
if(nativeGit){
 const form=new FormData();form.set('branch','main');
 let deployment=(await request(`${root}/${projectName}/deployments`,'POST',form)).result;
 if(!deployment?.id)throw new Error('Cloudflare no devolvió ID de despliegue.');
 console.log(`Build Git iniciado: ${deployment.id}`);
 let success=false;
 for(let attempt=0;attempt<72;attempt++){
  deployment=(await request(`${root}/${projectName}/deployments/${deployment.id}`)).result;
  const stage=deployment.latest_stage;
  console.log(`Build Git: ${stage?.name} / ${stage?.status}`);
  if(stage?.status==='failure' || stage?.status==='canceled')throw new Error('El build Git de Cloudflare falló. Revisar su registro en el panel.');
  if(stage?.name==='deploy' && stage.status==='success'){
   if(deployment.environment!=='production' || deployment.deployment_trigger?.metadata?.commit_hash!==process.env.GITHUB_SHA)throw new Error('El despliegue terminado no corresponde al commit esperado de main.');
   success=true;break;
  }
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 if(!success)throw new Error('El build Git no terminó dentro del plazo de verificación.');
}
