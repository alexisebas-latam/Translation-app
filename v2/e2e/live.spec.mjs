import {test,expect} from '@playwright/test';

test('Plazo root builds and shows Supabase sign-in on desktop and mobile', async({page},testInfo)=>{
 await page.goto('/');
 await expect(page).toHaveTitle(/Plazo/);
 await expect(page.locator('#welcome')).toBeVisible();
 await expect(page.getByLabel('Correo electrónico').first()).toBeVisible();
 const desktop=testInfo.project.name.startsWith('desktop');
 if(desktop){await expect(page.locator('.sidebar')).toBeVisible();await expect(page.locator('.mobile-nav')).toBeHidden();}
 else{await expect(page.locator('.sidebar')).toBeHidden();await expect(page.locator('.mobile-nav')).toBeVisible();}
 await expect(page.locator('#workspace')).toBeHidden();
 await expect(page.locator('#vaultAccess')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Sign-up, login and recovery forms respond without client-side secrets',async({page})=>{
 await page.goto('/');
 await page.locator('#showSignup').click();
 await expect(page.locator('#signupForm')).toBeVisible();
 await expect(page.locator('#loginForm')).toBeHidden();
 await page.locator('#showLogin').click();
 await expect(page.locator('#loginForm')).toBeVisible();
 await page.locator('#showForgot').click();
 await expect(page.locator('#forgotForm')).toBeVisible();
 await page.locator('#backLogin').click();
 await expect(page.locator('#loginForm')).toBeVisible();
 expect(await page.locator('[value*=sb_secret_]').count()).toBe(0);
});

test('Privacy navigation returns to sign-in without exposing protected data',async({page},testInfo)=>{
 await page.goto('/');
 const selector=testInfo.project.name.startsWith('desktop')?'.sidebar':'.mobile-nav';
 await page.locator(selector+' [data-screen="privacy"]').click();
 await expect(page.locator('#privacy')).toBeVisible();
 await page.locator(selector+' [data-screen="workspace"]').click();
 await expect(page.locator('#welcome')).toBeVisible();
 await expect(page.locator('#clientList')).toBeHidden();
});

test('Client data is not available to unauthenticated browser users',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#clientForm')).toBeHidden();
 const markup=await page.locator('body').textContent();
 expect(markup).not.toContain('Agencia Sol Ficticia');
});
