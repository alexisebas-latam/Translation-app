import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./v2/e2e',
 testMatch:['live.spec.mjs','clients.spec.mjs'],
 retries:process.env.CI?1:0,
 timeout:30000,
 reporter:'list',
 use:{baseURL:'http://127.0.0.1:4174',headless:true,trace:'on-first-retry'},
 projects:[
  {name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1440,height:900}}},
  {name:'mobile-chromium',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
 ],
 webServer:{
  command:'npx vite --host 127.0.0.1 --port 4174 --strictPort',
  url:'http://127.0.0.1:4174/',
  reuseExistingServer:!process.env.CI,
  timeout:30000
 }
});
