import {createMockService} from '../poc/mock-service.mjs';
import {createDemoDevice} from '../poc/device.mjs';

// No external network, persistent account store, or real identity provider.
// Reloading this page deletes all mock accounts, encrypted records and keys.
const service=createMockService();
let device=createDemoDevice(service);
let deviceNumber=1;
let screen='workspace';

const byId=id=>document.getElementById(id);
const welcome=byId('welcome'),workspace=byId('workspace'),privacy=byId('privacy');
const createPanel=byId('createPanel'),loginPanel=byId('loginPanel');
const recoveryPanel=byId('recoveryPanel'),recoveredPanel=byId('recoveredPanel');
const feedback=byId('feedback');
function notice(message,error=false){
  feedback.textContent=message;
  feedback.classList.toggle('error',error);
}
function renderScreen(){
  welcome.hidden=screen!=='workspace'||device.unlocked;
  workspace.hidden=screen!=='workspace'||!device.unlocked;
  privacy.hidden=screen!=='privacy';
  for(const btn of document.querySelectorAll('[data-screen]')){
    const active=btn.dataset.screen===screen;
    btn.classList.toggle('active',active);
    if(active)btn.setAttribute('aria-current','page');
    else btn.removeAttribute('aria-current');
  }
}
function setScreen(next){
  screen=next;
  renderScreen();
  notice('');
}
function showMode(mode){
  createPanel.hidden=mode!=='register';
  loginPanel.hidden=mode!=='login';
}
function iconFor(text){
  return text.trim().slice(0,1).toLocaleUpperCase('es-CL');
}
async function refreshClients(){
  if(!device.unlocked) return;
  const clients=await device.listClients();
  byId('clientCount').textContent=String(clients.length);
  byId('clientTag').textContent=clients.length+' registro'+(clients.length===1?'':'s');
  const ul=byId('clientList');
  ul.replaceChildren();
  if(!clients.length){
    const li=document.createElement('li');
    li.className='empty-state';
    li.textContent='Todavía no hay clientes. Agrega uno ficticio.';
    ul.append(li);
    return;
  }
  for(const client of clients){
    const li=document.createElement('li');
    li.className='client-row';
    const avatar=document.createElement('span');
    avatar.className='client-avatar';
    avatar.textContent=iconFor(client.name);
    const details=document.createElement('div');
    const name=document.createElement('strong');
    name.textContent=client.name;
    const subtype=document.createElement('small');
    subtype.textContent=client.type+' · Cifrado';
    details.append(name,subtype);
    li.append(avatar,details);
    ul.append(li);
  }
}
function exposeTemporaryCodes(codes){
  byId('shownAccountId').textContent=codes.accountId;
  byId('shownAccessCode').textContent=codes.accessCode;
  byId('shownRecovery').textContent=codes.recoverySecret;
  recoveryPanel.hidden=false;
  recoveredPanel.hidden=true;
}
function clearShownCodes(){
  for(const key of ['shownAccountId','shownAccessCode','shownRecovery'])byId(key).textContent='';
  recoveryPanel.hidden=true;
}
function setBusy(form,busy){
  for(const control of form.querySelectorAll('button,input'))control.disabled=busy;
}
for(const nav of document.querySelectorAll('[data-screen]')){
  nav.addEventListener('click',()=>setScreen(nav.dataset.screen));
}
byId('registerForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const displayName=byId('displayName').value;
  setBusy(form,true);notice('');
  try{
    const codes=await device.register(displayName);
    exposeTemporaryCodes(codes);
    showMode('register');
    await refreshClients();
    setScreen('workspace');
    notice('Tu espacio de prueba está listo. Guarda los tres códigos antes de cambiar de dispositivo.');
    form.reset();
  }catch(err){notice(err.message||'No pudimos crear la cuenta de prueba.',true);}
  finally{setBusy(form,false);}
});
byId('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  setBusy(form,true);notice('');
  try{
    await device.signIn({
      accountId:byId('accountId').value.trim(),
      accessCode:byId('accessCode').value.trim(),
      recoverySecret:byId('recoveryCode').value.trim()
    });
    form.reset();
    clearShownCodes();
    recoveredPanel.hidden=false;
    await refreshClients();
    setScreen('workspace');
    notice('La recuperación del segundo dispositivo simulado fue correcta.');
  }catch(err){notice(err.message||'No fue posible iniciar sesión.',true);}
  finally{setBusy(form,false);}
});
byId('clientForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const name=byId('clientName').value;
  setBusy(form,true);
  try{
    await device.addClient(name,'Agencia de prueba');
    form.reset();
    await refreshClients();
    notice('Cliente ficticio cifrado antes de almacenarlo.');
  }catch(err){notice(err.message||'No se pudo guardar el cliente.',true);}
  finally{setBusy(form,false);}
});
byId('newDevice').addEventListener('click',()=>{
  if(!device.unlocked)return;
  const ok=confirm('¿Guardaste el identificador, el código de acceso simulado y la clave de recuperación? Los valores desaparecerán de esta pantalla.');
  if(!ok)return;
  const accountId=device.accountId;
  device.logout();
  device=createDemoDevice(service);
  deviceNumber+=1;
  byId('deviceLabel').textContent='DISPOSITIVO '+(deviceNumber===2?'B':String(deviceNumber))+' · SIMULADO';
  byId('loginForm').reset();
  byId('accountId').value=accountId; // Account ID is not a secret; access/recovery remain blank.
  clearShownCodes();
  recoveredPanel.hidden=true;
  showMode('login');
  setScreen('workspace');
  notice('Dispositivo nuevo: usa tus códigos de prueba para recuperar los datos cifrados.');
});
byId('logout').addEventListener('click',()=>{
  const id=device.accountId;
  device.logout();
  device=createDemoDevice(service);
  byId('loginForm').reset();
  byId('accountId').value=id;
  recoveredPanel.hidden=true;
  showMode('login');
  setScreen('workspace');
  notice('Sesión simulada cerrada. Necesitas los códigos para volver a entrar.');
});
for(const btn of document.querySelectorAll('[data-copy]')){
  btn.addEventListener('click',async()=>{
    const value=byId(btn.dataset.copy).textContent;
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Copiado no disponible en este navegador.');
      await navigator.clipboard.writeText(value);
      notice('Código de demostración copiado al portapapeles. Trátalo como privado.');
    }catch{
      notice('No se pudo copiar automáticamente. Selecciona el valor y cópialo manualmente.',true);
    }
  });
}
renderScreen();
