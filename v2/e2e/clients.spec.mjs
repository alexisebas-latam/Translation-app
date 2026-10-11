import {test,expect} from '@playwright/test';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',workspace='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function setup(page){
 let vault=null,records=[];
 const user={id:owner,email:'traductor@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{}};
 const b64=s=>Buffer.from(JSON.stringify(s)).toString('base64url');
 const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:owner,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fixture';
 await page.route('https://dvqalzgyivqgnenjutub.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();let body;
  if(url.pathname.endsWith('/token'))body={access_token:jwt,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname.endsWith('/user'))body=user;
  else if(url.pathname.endsWith('/logout')){await route.fulfill({status:204});return;}
  else if(url.pathname.endsWith('/plazo_workspaces'))body={id:workspace,owner_id:owner};
  else if(url.pathname.endsWith('/plazo_vaults')){if(method==='POST')vault=req.postDataJSON();body=method==='POST'?{workspace_id:workspace}:vault;}
  else if(url.pathname.endsWith('/plazo_encrypted_records')){
   const id=url.searchParams.get('record_id')?.slice(3),version=url.searchParams.get('record_version')?.slice(3);
   if(method==='POST'){records.push(req.postDataJSON());body=null;}
   else if(method==='PATCH'){const found=records.find(r=>r.record_id===id&&String(r.record_version)===version);if(found)Object.assign(found,req.postDataJSON());body=found?{record_id:id}:null;}
   else if(method==='DELETE'){const found=records.find(r=>r.record_id===id);records=records.filter(r=>r.record_id!==id);body=found?{record_id:id}:null;}
   else body=id?(records.find(r=>r.record_id===id)||null):records;
  } else body={};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/');await page.locator('#loginEmail').fill('traductor@example.test');await page.locator('#loginPassword').fill('fixture-password-123');await page.locator('#loginForm button[type=submit]').click();
 await expect(page.locator('#createVaultPanel')).toBeVisible();await page.locator('#createVaultButton').click();await expect(page.locator('#newRecoveryPanel')).toBeVisible();
 const secret=await page.locator('#newRecoverySecret').textContent();await page.locator('#savedRecovery').check();await page.locator('#confirmRecovery').click();await expect(page.locator('#workspace')).toBeVisible();
 return {secret,records:()=>records};
}
test('clients can be added, edited, searched and deleted with explicit confirmation',async({page})=>{
 const fixture=await setup(page);
 await page.locator('#workspace [data-new-client]').click();await page.locator('#clientName').fill('Agencia ficticia');await page.locator('#clientType').fill('Agencia');await page.locator('#saveClient').click();
 await expect(page.locator('#clientList')).toContainText('Agencia ficticia');await expect(page.locator('#clientForm')).toBeHidden();
 expect(JSON.stringify(fixture.records())).not.toContain('Agencia ficticia');
 await page.getByRole('button',{name:'Editar Agencia ficticia',exact:true}).click();await page.locator('#clientName').fill('<img src=x onerror=alert(1)>');await page.locator('#clientType').fill('Directo');await page.locator('#saveClient').click();
 await expect(page.locator('#clientList')).toContainText('<img src=x onerror=alert(1)>');expect(await page.locator('#clientList img').count()).toBe(0);
 await page.locator('#clientSearch').fill('ausente');await expect(page.locator('#clientList')).toContainText('Sin resultados');await page.locator('#clientSearch').fill('');
 await page.reload();await expect(page.locator('#unlockVaultPanel')).toBeVisible();await page.locator('#unlockSecret').fill(fixture.secret);await page.locator('#unlockForm button').click();
 await page.locator('#menuButton').click();await expect(page.locator('#appMenu')).toBeVisible();await page.locator('#appMenu [data-screen=clients]').click();await expect(page.locator('#appMenu')).not.toBeVisible();
 await expect(page.locator('#clientList')).toContainText('<img src=x onerror=alert(1)>');
 await page.locator('#clientList .danger').click();await expect(page.locator('#deleteDialog')).toBeVisible();await page.locator('#cancelDelete').click();await expect(page.locator('#clientList .client-row')).toHaveCount(1);
 await page.locator('#clientList .danger').click();await page.locator('#confirmDelete').click();await expect(page.locator('#clientList .client-row')).toHaveCount(0);await expect(page.locator('#clientList')).toContainText('Todavía no tienes clientes');
 expect(fixture.records()).toHaveLength(0);
});
test('app menu is accessible and locking clears decrypted rows and forms',async({page})=>{
 await setup(page);await page.locator('#workspace [data-new-client]').click();await page.locator('#clientName').fill('Contacto de prueba');await page.locator('#saveClient').click();await expect(page.locator('#clientList')).toContainText('Contacto de prueba');
 await page.locator('#menuButton').click();await expect(page.locator('#menuButton')).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');await expect(page.locator('#menuButton')).toHaveAttribute('aria-expanded','false');
 await page.locator('#menuButton').click();await page.locator('#lockButton').click();await expect(page.locator('#unlockVaultPanel')).toBeVisible();await expect(page.locator('#clientList')).not.toContainText('Contacto de prueba');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('authenticated app composition fits desktop and mobile',async({page},testInfo)=>{
 await setup(page);await expect(page.locator('#workspace')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('home.png'),fullPage:true});
 await page.locator('#workspace [data-new-client]').click();await page.locator('#clientName').fill('Agencia Horizonte (ficticia)');await page.locator('#clientType').fill('Agencia');await page.locator('#saveClient').click();await expect(page.locator('#clientList .client-row')).toHaveCount(1);
 await page.screenshot({path:testInfo.outputPath('clients.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
