import {createPlazoSupabaseClient} from './supabase-client.mjs';
import {createPlazoCloud} from './store.mjs';

const supabase=createPlazoSupabaseClient();
const cloud=createPlazoCloud(supabase);
const $=id=>document.getElementById(id);
const panes=['welcome','vaultAccess','workspace','clients','privacy'];
let clients=[];
let editingId=null;
let deletingId=null;
let screen='workspace';
let stage='login'; // login / signup / forgot / reset / create / unlock / newSecret / open
let email='';
let doing=false;
let authLoad=0;
let passwordRecoveryMode=new URLSearchParams(location.search).get('mode')==='reset';
let loggedIn=false;

function feedback(message='',error=false){
 const el=$('feedback');
 el.textContent=message;
 el.classList.toggle('error',error);
}
function busy(formOrButton,flag){
 if(formOrButton?.matches?.('form')){
   for(const element of formOrButton.querySelectorAll('input,button'))element.disabled=flag;
 } else if(formOrButton)formOrButton.disabled=flag;
}
function hideSecret(){
 $('newRecoverySecret').textContent='';
 $('savedRecovery').checked=false;
 $('confirmRecovery').disabled=true;
}
function showPane(id){
 for(const pane of panes)$(pane).hidden=pane!==id;
 for(const btn of document.querySelectorAll('[data-screen]')){
   const current=btn.dataset.screen===screen;
   btn.classList.toggle('active',current);
   if(current)btn.setAttribute('aria-current','page');
   else btn.removeAttribute('aria-current');
 }
}
function render(){
 $('menuAccount').hidden=!loggedIn;
 $('signedEmail').textContent=email;
 $('pageTitle').textContent={workspace:'Tu espacio de trabajo',clients:'Clientes',privacy:'Privacidad'}[screen]||'Plazo';
 if(screen==='privacy'){showPane('privacy');return;}
 if(!loggedIn){
   showPane('welcome');
   $('loginForm').hidden=stage!=='login';
   $('signupForm').hidden=stage!=='signup';
   $('forgotForm').hidden=stage!=='forgot';
   $('resetForm').hidden=stage!=='reset';
   $('showForgot').hidden=stage!=='login';
   $('backLogin').hidden=stage!=='forgot'&&stage!=='signup';
   $('authTitle').textContent={login:'Ingresa a Plazo',signup:'Crea tu cuenta',forgot:'Recupera tu acceso',reset:'Cambia tu contraseña'}[stage]||'Ingresa a Plazo';
   $('showLogin').classList.toggle('selected',stage==='login');
   $('showSignup').classList.toggle('selected',stage==='signup');
   return;
 }
 if(!cloud.ready||stage==='newSecret'){
   showPane('vaultAccess');
   $('accountEmail').textContent=email;
   $('createVaultPanel').hidden=stage!=='create';
   $('unlockVaultPanel').hidden=stage!=='unlock';
   $('newRecoveryPanel').hidden=stage!=='newSecret';
   return;
 }
 showPane(screen==='clients'?'clients':'workspace');
}
function selectScreen(next){
 if(!['workspace','clients','privacy'].includes(next))return;
 screen=next;
 closeMenu();
 closeClientForm();
 render();
 feedback('');
}
function selectAuth(next){
 if(loggedIn)return;
 stage=next;
 render();
 feedback('');
}
async function refreshAuth(){
 const nonce=++authLoad;
 const {data,error}=await supabase.auth.getUser();
 if(nonce!==authLoad)return;
 if(error||!data?.user||data.user.is_anonymous){
   loggedIn=false;email='';cloud.lock();clearPrivateUI();
   if(!passwordRecoveryMode)stage='login';else stage='reset';
   render();return;
 }
 email=data.user.email||'Usuario autenticado';
 loggedIn=true;
 if(passwordRecoveryMode){
   // Auth can complete before PASSWORD_RECOVERY arrives. Keep reset screen ready.
   loggedIn=false;stage='reset';render();return;
 }
 if(stage==='newSecret'&&cloud.ready){render();return;}
 try{
   await cloud.ensureWorkspace();
   if(nonce!==authLoad)return;
   if(cloud.ready){stage='open';render();await loadClients();return;}
   stage=await cloud.vaultExists()?'unlock':'create';
   render();
 }catch(err){
   feedback('No se pudo abrir el espacio privado: '+err.message,true);
 }
}
async function operate(buttonOrForm,action){
 if(doing)return;
 doing=true;busy(buttonOrForm,true);
 buttonOrForm?.setAttribute('aria-busy','true');
 try{await action();}
 catch(err){feedback(err?.message||'No se pudo completar la operación.',true);}
 finally{busy(buttonOrForm,false);buttonOrForm?.removeAttribute('aria-busy');doing=false;}
}
function validEmail(s){return typeof s==='string'&&s.includes('@')&&s.length<=254;}
function closeMenu(){
 if($('appMenu').open)$('appMenu').close();
 $('menuButton').setAttribute('aria-expanded','false');
}
function closeClientForm(){
 $('clientForm').hidden=true;$('clientForm').reset();editingId=null;
 $('clientFormError').hidden=true;
}
function clearPrivateUI(){
 clients=[];$('clientList').replaceChildren();$('clientCount').textContent='0';
 $('clientSearch').value='';closeClientForm();
 if($('deleteDialog').open)$('deleteDialog').close();
 deletingId=null;$('deleteClientName').textContent='';
}
function openClientForm(client=null){
 if(!loggedIn||!cloud.ready){selectScreen('clients');feedback('Desbloquea tu bóveda para gestionar clientes.');return;}
 screen='clients';closeMenu();render();
 editingId=client?.id||null;
 $('clientFormTitle').textContent=client?'Editar cliente':'Nuevo cliente';
 $('saveClient').textContent=client?'Guardar cambios':'Guardar cliente';
 $('clientName').value=client?.name||'';$('clientType').value=client?.type||'Cliente';
 $('clientFormError').hidden=true;$('clientForm').hidden=false;
 $('clientName').focus();$('clientForm').scrollIntoView({block:'nearest'});
}
function requestDelete(client){
 if(doing)return;
 deletingId=client.id;$('deleteClientName').textContent=client.name;
 $('deleteError').hidden=true;$('deleteDialog').showModal();
 $('cancelDelete').focus();
}
function renderClients(){
 const query=$('clientSearch').value.trim().toLocaleLowerCase('es');
 const filtered=clients.filter(c=>(c.name+' '+c.type).toLocaleLowerCase('es').includes(query));
 const list=$('clientList');list.replaceChildren();
 $('clientCount').textContent=String(clients.length);
 $('clientTag').textContent=clients.length===1?'1 cliente':clients.length+' clientes';
 $('homePrompt').textContent=clients.length?'Tus contactos, a mano':'Empieza con tu primer cliente';
 $('homeDescription').textContent=clients.length?'Busca un cliente o actualiza sus datos cuando lo necesites.':'Guarda sus datos y ten tus contactos a mano.';
 if(!filtered.length){
  const item=document.createElement('li');item.className='empty-state';
  const title=document.createElement('strong');title.textContent=query?'Sin resultados':'Todavía no tienes clientes';
  const text=document.createElement('span');text.textContent=query?'Prueba con otro nombre o tipo de cliente.':'Pulsa "Añadir cliente" para guardar tu primer contacto.';
  item.append(title,text);list.append(item);return;
 }
 for(const client of filtered){
  const item=document.createElement('li');item.className='client-row';
  const avatar=document.createElement('span');avatar.className='client-avatar';
  avatar.setAttribute('aria-hidden','true');avatar.textContent=client.name.slice(0,1).toLocaleUpperCase('es-CL');
  const content=document.createElement('div');content.className='client-info';
  const name=document.createElement('strong');name.textContent=client.name;
  const type=document.createElement('small');type.textContent=client.type||'Cliente';
  content.append(name,type);
  const actions=document.createElement('div');actions.className='client-actions';
  const edit=document.createElement('button');edit.type='button';edit.className='row-action';edit.textContent='Editar';
  edit.setAttribute('aria-label','Editar '+client.name);edit.addEventListener('click',()=>openClientForm(client));
  const remove=document.createElement('button');remove.type='button';remove.className='row-action danger';remove.textContent='Eliminar';
  remove.setAttribute('aria-label','Eliminar '+client.name);remove.addEventListener('click',()=>requestDelete(client));
  actions.append(edit,remove);item.append(avatar,content,actions);list.append(item);
 }
}
async function loadClients(){
 if(!cloud.ready)return;
 clients=await cloud.listClients();renderClients();
}
$('menuButton').addEventListener('click',()=>{$('appMenu').showModal();$('menuButton').setAttribute('aria-expanded','true');});
$('closeMenu').addEventListener('click',closeMenu);
$('appMenu').addEventListener('close',()=>{$('menuButton').setAttribute('aria-expanded','false');});
$('appMenu').addEventListener('click',event=>{if(event.target===$('appMenu')){const box=$('appMenu').getBoundingClientRect();if(event.clientX<box.left)closeMenu();}});
for(const btn of document.querySelectorAll('[data-new-client]'))btn.addEventListener('click',()=>openClientForm());
$('cancelClient').addEventListener('click',closeClientForm);
$('cancelClientBottom').addEventListener('click',closeClientForm);
$('clientSearch').addEventListener('input',renderClients);
$('cancelDelete').addEventListener('click',()=>{$('deleteDialog').close();});
$('deleteDialog').addEventListener('close',()=>{deletingId=null;$('deleteClientName').textContent='';});
$('confirmDelete').addEventListener('click',event=>void operate(event.currentTarget,async()=>{
 if(!deletingId)return;
 const id=deletingId;
 try{await cloud.deleteClient(id);}catch(error){$('deleteError').textContent=error.message;$('deleteError').hidden=false;throw error;}
 $('deleteDialog').close();if(editingId===id)closeClientForm();
 await loadClients();feedback('Cliente eliminado.');
}));
for(const btn of document.querySelectorAll('[data-screen]')){
 btn.addEventListener('click',()=>selectScreen(btn.dataset.screen));
}
$('showLogin').addEventListener('click',()=>selectAuth('login'));
$('showSignup').addEventListener('click',()=>selectAuth('signup'));
$('showForgot').addEventListener('click',()=>selectAuth('forgot'));
$('backLogin').addEventListener('click',()=>{passwordRecoveryMode=false;history.replaceState(null,'',location.pathname);selectAuth('login');});

$('signupForm').addEventListener('submit',event=>{
 event.preventDefault();const form=event.currentTarget;
 void operate(form,async()=>{
  const address=$('signupEmail').value.trim().toLowerCase(),password=$('signupPassword').value;
  if(!validEmail(address)||password.length<8)throw new Error('Introduce un correo y una contraseña de al menos 8 caracteres.');
  const {data,error}=await supabase.auth.signUp({email:address,password,
   options:{emailRedirectTo:location.origin+location.pathname}});
  if(error)throw new Error('No fue posible registrarte: '+error.message);
  form.reset();
  if(!data?.session){
   stage='login';render();
   feedback('Revisa tu correo para verificar la cuenta. Después podrás iniciar sesión.');
  }else{await refreshAuth();feedback('Cuenta creada. Configura tu bóveda personal.');}
 });
});
$('loginForm').addEventListener('submit',event=>{
 event.preventDefault();const form=event.currentTarget;
 void operate(form,async()=>{
  const address=$('loginEmail').value.trim().toLowerCase(),password=$('loginPassword').value;
  const {error}=await supabase.auth.signInWithPassword({email:address,password});
  if(error)throw new Error('No fue posible iniciar sesión. Verifica tus datos y tu correo.');
  form.reset();await refreshAuth();
  feedback('Sesión iniciada. Desbloquea tu información personal.');
 });
});
$('forgotForm').addEventListener('submit',event=>{
 event.preventDefault();const form=event.currentTarget;
 void operate(form,async()=>{
  const address=$('forgotEmail').value.trim().toLowerCase();
  const {error}=await supabase.auth.resetPasswordForEmail(address,{
   redirectTo:location.origin+location.pathname+'?mode=reset'
  });
  if(error)throw new Error('No pudimos procesar la solicitud. Inténtalo de nuevo.');
  form.reset();feedback('Si existe una cuenta con ese correo, recibirás instrucciones para recuperar el acceso.');
 });
});
$('resetForm').addEventListener('submit',event=>{
 event.preventDefault();const form=event.currentTarget;
 void operate(form,async()=>{
  const {error}=await supabase.auth.updateUser({password:$('resetPassword').value});
  if(error)throw new Error('El enlace expiró o no pudimos cambiar la contraseña.');
  form.reset();
  passwordRecoveryMode=false;
  history.replaceState(null,'',location.pathname);
  await supabase.auth.signOut();
  cloud.lock();loggedIn=false;stage='login';render();
  feedback('Contraseña actualizada. Inicia sesión y usa tu clave de bóveda para ver tus datos.');
 });
});
$('createVaultButton').addEventListener('click',event=>void operate(event.currentTarget,async()=>{
 const value=await cloud.initializeVault();
 $('newRecoverySecret').textContent=value.recoverySecret;
 stage='newSecret';render();
 feedback('Guarda tu clave de recuperación. Esta es la única vez que se mostrará.');
}));
$('copyRecovery').addEventListener('click',event=>void operate(event.currentTarget,async()=>{
 const value=$('newRecoverySecret').textContent;
 if(!value)throw new Error('No hay clave disponible.');
 await navigator.clipboard.writeText(value);
 feedback('Clave copiada. Guárdala en un lugar privado, no en un mensaje a soporte.');
}));
$('savedRecovery').addEventListener('change',event=>{
 $('confirmRecovery').disabled=!event.currentTarget.checked;
});
$('confirmRecovery').addEventListener('click',event=>void operate(event.currentTarget,async()=>{
 if(!$('savedRecovery').checked)throw new Error('Confirma que guardaste tu clave de recuperación.');
 hideSecret();stage='open';render();await loadClients();
 feedback('Bóveda lista. Tu información se cifrará antes de guardarse.');
}));
$('unlockForm').addEventListener('submit',event=>{
 event.preventDefault();const form=event.currentTarget;
 void operate(form,async()=>{
  const secret=$('unlockSecret').value.trim();
  await cloud.unlock(secret);form.reset();
  stage='open';render();await loadClients();
  feedback('Tus datos se descifraron únicamente en este dispositivo.');
 });
});
$('clientForm').addEventListener('submit',event=>{
 event.preventDefault();const form=event.currentTarget;
 void operate(form,async()=>{
  const name=$('clientName').value;
  const type=$('clientType').value;const edited=Boolean(editingId);
  try{if(editingId)await cloud.updateClient(editingId,name,type);else await cloud.addClient(name,type);}
  catch(error){$('clientFormError').textContent=error.message;$('clientFormError').hidden=false;throw error;}
  closeClientForm();await loadClients();
  feedback(edited?'Cambios guardados.':'Cliente guardado.');
 });
});
$('lockButton').addEventListener('click',()=>{
 cloud.lock();hideSecret();clearPrivateUI();closeMenu();stage='unlock';screen='workspace';render();feedback('Bóveda bloqueada en este dispositivo.');
});
$('signOutButton').addEventListener('click',event=>void operate(event.currentTarget,async()=>{
 cloud.lock();hideSecret();clearPrivateUI();closeMenu();await cloud.signOut();
 authLoad+=1;loggedIn=false;email='';stage='login';render();feedback('Sesión cerrada.');
}));
const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
 if(event==='PASSWORD_RECOVERY'){
  passwordRecoveryMode=true;loggedIn=false;stage='reset';render();return;
 }
 if(event==='SIGNED_OUT'){
  authLoad+=1;cloud.lock();hideSecret();clearPrivateUI();loggedIn=false;email='';
  if(!passwordRecoveryMode)stage='login';render();return;
 }
 if(event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='USER_UPDATED'){
  // Do not call Supabase APIs synchronously inside auth state callback.
  setTimeout(()=>{void refreshAuth();},0);
 }
});
window.addEventListener('pagehide',()=>{cloud.lock();hideSecret();clearPrivateUI();subscription.unsubscribe();});
render();
void refreshAuth();
