import { test, expect } from '@playwright/test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { encryptVault, decryptVault } from '../../src/core/vault/crypto.ts';
const scripts=Object.fromEntries(['crypto','validation'].map(name=>[name,ts.transpileModule(readFileSync(`src/core/vault/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,rewriteRelativeImportExtensions:true}}).outputText]));
test('Vault protocol interoperates between Node and actual secure browser without persisting plaintext',async({page})=>{
  const password='browser-test-only-not-real';
  const payload={version:1,modules:{},assets:{}};
  const envelope=await encryptVault(payload,password);
  await page.route('**/vault-protocol-test/*.js',route=>route.fulfill({contentType:'text/javascript',body:scripts[new URL(route.request().url()).pathname.split('/').at(-1)!.replace('.js','')]}));
  await page.goto('./');
  const response=await page.evaluate(async({envelope,password})=>{
    const url=new URL('vault-protocol-test/crypto.js',location.href).href;
    const protocol=await import(url) as typeof import('../../src/core/vault/crypto.ts');
    const start=performance.now();
    const payload=await protocol.decryptVault(envelope,password);
    const encrypted=await protocol.encryptVault(payload,password);
    return {payload,encrypted,elapsed:performance.now()-start,storage:localStorage.length+sessionStorage.length,secure:window.isSecureContext};
  },{envelope,password});
  expect(response.secure).toBe(true);expect(response.storage).toBe(0);expect(response.payload).toEqual(payload);
  expect(await decryptVault(response.encrypted,password)).toEqual(payload);
  expect(response.elapsed).toBeLessThan(15000);
});
