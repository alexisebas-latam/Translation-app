import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./v2/e2e',
  testMatch:'responsive.spec.mjs',
  fullyParallel:true,
  timeout:20000,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?'list':'line',
  use:{baseURL:'http://127.0.0.1:4173',headless:true,trace:'on-first-retry'},
  projects:[
    {name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1440,height:900}}},
    {name:'mobile-chromium',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
  ],
  webServer:{
    command:'node v2/demo/dev-server.mjs',
    url:'http://127.0.0.1:4173/v2/demo/',
    reuseExistingServer:!process.env.CI,
    timeout:15000
  }
});
