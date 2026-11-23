import fs from 'node:fs';
import { fileURLToPath,URL } from 'node:url';
import { defineConfig } from '@playwright/test';
process.env.PLAYWRIGHT_NO_COPY_PROMPT='1';
const data=JSON.parse(fs.readFileSync('.cache/studio-batch/m15/delivery-site-artifacts.json','utf8')) as {records:{base:string;output:string}[]};
export default defineConfig({
  testDir:'.',testMatch:'site.spec.ts',fullyParallel:false,workers:1,retries:0,reporter:'list',
  use:{trace:'off',screenshot:'off',viewport:{width:1280,height:900}},
  projects:['chromium','webkit'].flatMap(browser=>data.records.map((record,index)=>({name:browser+(index?'-base':'-root'),use:{browserName:browser as 'chromium'|'webkit',baseURL:`http://127.0.0.1:${4930+index}${record.base}`}}))),
  webServer:data.records.map((record,index)=>({command:'node tests/serve.mjs',cwd:fileURLToPath(new URL('../../../',import.meta.url)),env:{E2E_PORT:String(4930+index),E2E_BASE_PATH:record.base,E2E_DIST:record.output},url:`http://127.0.0.1:${4930+index}${record.base}`,reuseExistingServer:false,timeout:30000})),
});
