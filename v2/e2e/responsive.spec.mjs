import { test, expect } from '@playwright/test';

test('layout adapts between full desktop and mobile navigation',async({page},testInfo)=>{
  await page.goto('/v2/demo/');
  await expect(page.locator('.intro h1')).toBeVisible();
  const desktop=testInfo.project.name.startsWith('desktop');
  if(desktop){
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.mobile-nav')).toBeHidden();
  }else{
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('.mobile-nav')).toBeVisible();
    await expect(page.locator('.mobile-nav')).toHaveCSS('position','fixed');
  }
  await page.locator((desktop?'.sidebar ':'.mobile-nav ')+'[data-screen="privacy"]').click();
  await expect(page.getByRole('heading',{name:'La confianza se diseña.'})).toBeVisible();
  await page.locator((desktop?'.sidebar ':'.mobile-nav ')+'[data-screen="workspace"]').click();
  await expect(page.locator('#createForm')).toHaveCount(0); // validate actual form ID, no phantom overlays
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('registration, encryption and recovery work in both responsive layouts',async({page})=>{
  await page.goto('/v2/demo/');
  await page.locator('#displayName').fill('Profesional Ficticio');
  await page.locator('#registerForm button[type=submit]').click();
  await expect(page.locator('#workspace')).toBeVisible();
  const accountId=await page.locator('#shownAccountId').textContent();
  const accessCode=await page.locator('#shownAccessCode').textContent();
  const recovery=await page.locator('#shownRecovery').textContent();
  expect(accountId).toMatch(/^acct_/);
  expect(accessCode).toHaveLength(43);
  expect(recovery).toHaveLength(43);
  expect(accessCode).not.toEqual(recovery);

  await page.locator('#clientName').fill('Agencia Horizonte Ficticia');
  await page.locator('#clientForm button[type=submit]').click();
  await expect(page.locator('#clientCount')).toHaveText('1');
  await expect(page.locator('.client-list')).toHaveCount(1);
  await expect(page.locator('#clientList')).toContainText('Agencia Horizonte Ficticia');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#newDevice').click();
  await expect(page.locator('#loginPanel')).toBeVisible();
  await page.locator('#accountId').fill(accountId);
  await page.locator('#accessCode').fill(accessCode);
  await page.locator('#recoveryCode').fill(recovery);
  await page.locator('#loginForm button[type=submit]').click();
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('#clientList')).toContainText('Agencia Horizonte Ficticia');
  await expect(page.locator('#recoveredPanel')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('injected HTML in business names is shown as text, never executed',async({page})=>{
  await page.goto('/v2/demo/');
  await page.locator('#displayName').fill('Demo');
  await page.locator('#registerForm button[type=submit]').click();
  const suspicious='<img src=x onerror=window.injectedByTest=1>';
  await page.locator('#clientName').fill(suspicious);
  await page.locator('#clientForm button[type=submit]').click();
  await expect(page.locator('#clientList')).toContainText(suspicious);
  expect(await page.locator('#clientList img').count()).toBe(0);
  expect(await page.evaluate(()=>window.injectedByTest===1)).toBe(false);
});
