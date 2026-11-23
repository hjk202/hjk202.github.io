import {createRequire}from'node:module';import path from'node:path';
import{URL}from'node:url';import{log}from'node:console';
// Public website only, temporary browser contexts. No author session, login or saved credentials.
const site='https://hjk202.github.io/',require=createRequire(path.resolve('package.json')),{chromium,webkit}=require('playwright');
const response=await globalThis.fetch(site+'search-index.json',{redirect:'error',cache:'no-store'});if(!response.ok)throw new Error('LIVE_INDEX_UNAVAILABLE');const index=await response.json();
const routes=[...new Set(['/',...index.modules.map(m=>m.route),...index.results.map(r=>r.url)])];if(routes.length>1000||routes.some(route=>typeof route!=='string'||!/^\/(?:[a-z0-9-]+\/)*$/.test(route)))throw new Error('LIVE_ROUTE_INVALID');
let visits=0;
for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],failed=[];let intentional404='';page.on('pageerror',()=>errors.push('PAGE_ERROR'));page.on('requestfailed',r=>failed.push(r.url()));page.on('response',r=>{if(new URL(r.url()).origin===new URL(site).origin&&r.status()>=400&&r.url()!==intentional404)failed.push(r.url());});
  for(const route of routes){const r=await page.goto(new URL(route,site).href,{waitUntil:'networkidle'});if(!r||r.status()!==200||!await page.locator('body').innerText())throw new Error('LIVE_ROUTE_FAILED');visits++;}
  await page.goto(site);await page.getByRole('button',{name:'Search my space',exact:true}).click();await page.getByRole('combobox').fill(index.results[0]?.title??'不存在的非敏感查询');await page.getByRole('combobox').press('Escape');if(await page.locator('[data-spotlight]').isVisible())throw new Error('LIVE_SEARCH_FAILED');
  intentional404=new URL('/studio-verification-missing-route/',site).href;const missing=await page.goto(intentional404);if(missing?.status()!==404)throw new Error('LIVE_404_FAILED');if(errors.length||failed.length)throw new Error('LIVE_BROWSER_FAILED');
}finally{await browser.close();}}
log(JSON.stringify({liveBrowserVerified:true,engines:2,visits,pageerrors:0}));
