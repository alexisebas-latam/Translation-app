import {createPlazoSupabaseClient} from './supabase-client.mjs';
import {createPlazoCloud} from './store.mjs';

const supabase=createPlazoSupabaseClient();
const cloud=createPlazoCloud(supabase);
const $=id=>document.getElementById(id);
const panes=['welcome','vaultAccess','workspace','privacy'];
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
 showPane('workspace');
 $('signedEmail').textContent=email;
}
function selectScreen(next){
 screen=next;
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
   loggedIn=false;email='';cloud.lock();
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
 try{await action();}
 catch(err){feedback(err?.message||'No se pudo completar la operación.',true);}
 finally{busy(buttonOrForm,false);doing=false;}
}
function validEmail(s){return typeof s==='string'&&s.includes('@')&&s.length<=254;}
async function loadClients(){
 if(!cloud.ready)return;
 const result=await cloud.listClients();
 $('clientCount').textContent=String(result.length);
 $('clientTag').textContent=result.length+' registro'+(result.length===1?'':'s');
 const list=$('clientList');
 list.replaceChildren();
 if(!result.length){
  const item=document.createElement('li');
  item.className='empty-state';item.textContent='Aún no tienes clientes. Agrega el primero.';list.append(item);return;
 }
 for(const client of result){
  const item=document.createElement('li');
  item.className='client-row';
  const avatar=document.createElement('span');
  avatar.className='client-avatar';
  avatar.textContent=client.name.slice(0,1).toLocaleUpperCase('es-CL');
  const content=document.createElement('div');
  const name=document.createElement('strong');name.textContent=client.name;
  const type=document.createElement('small');type.textContent=(client.type||'Cliente')+' · Cifrado';
  content.append(name,type);item.append(avatar,content);list.append(item);
 }
}
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
  await cloud.addClient(name,'Cliente');
  form.reset();await loadClients();
  feedback('Cliente guardado en Supabase como registro cifrado.');
 });
});
$('lockButton').addEventListener('click',()=>{
 cloud.lock();hideSecret();stage='unlock';render();feedback('Bóveda bloqueada en este dispositivo.');
});
$('signOutButton').addEventListener('click',event=>void operate(event.currentTarget,async()=>{
 cloud.lock();hideSecret();await cloud.signOut();
 authLoad+=1;loggedIn=false;email='';stage='login';render();feedback('Sesión cerrada.');
}));
const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
 if(event==='PASSWORD_RECOVERY'){
  passwordRecoveryMode=true;loggedIn=false;stage='reset';render();return;
 }
 if(event==='SIGNED_OUT'){
  authLoad+=1;cloud.lock();hideSecret();loggedIn=false;email='';
  if(!passwordRecoveryMode)stage='login';render();return;
 }
 if(event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='USER_UPDATED'){
  // Do not call Supabase APIs synchronously inside auth state callback.
  setTimeout(()=>{void refreshAuth();},0);
 }
});
window.addEventListener('pagehide',()=>{cloud.lock();hideSecret();subscription.unsubscribe();});
render();
void refreshAuth();
