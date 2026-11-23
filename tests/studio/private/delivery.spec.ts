import fs from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { decryptVault } from '../../../src/core/vault/crypto.ts';
import { test,open,save,secret,password } from './fixtures.ts';
import type { Repo } from './fixtures.ts';
test.use({deliveryMode:true});
async function exportCandidate(page:Page,repo:Repo,name='candidate.json'){
  const path=join(repo.file,'..',name);await repo.choose(page,'export',path);await page.locator('#private-export').click();await secret(page,true);await expect(page.locator('#private-delivery-message')).toContainText('网站更新文件已生成');return path;
}
test('M15 candidate export, explicit cancel/confirm and external old-bundle backup are separate from master save',async({page,repo})=>{
  await open(page,repo);const master=fs.readFileSync(repo.file),source=fs.readFileSync(repo.source),candidate=await exportCandidate(page,repo);expect(fs.existsSync(repo.bundle)).toBe(false);expect(fs.readFileSync(repo.file).equals(master)).toBe(true);expect(JSON.stringify(await decryptVault(JSON.parse(fs.readFileSync(candidate,'utf8')),password))===JSON.stringify(repo.original)).toBe(true);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#private-deliver').click();await expect(page.locator('#private-deliver')).toBeEnabled();expect(fs.existsSync(repo.bundle)).toBe(false);
  repo.expectBundle();page.once('dialog',dialog=>dialog.accept());await page.locator('#private-deliver').click();await expect(page.locator('#private-delivery-message')).toContainText('本地网站已更新');const old=fs.readFileSync(repo.bundle);expect(fs.readFileSync(repo.file).equals(master)).toBe(true);
  await page.locator('#private-list button').first().click();await page.getByLabel('私人标题',{exact:true}).fill('非敏感二次交付');await save(page);await exportCandidate(page,repo,'candidate-second.json');page.once('dialog',dialog=>dialog.accept());await page.locator('#private-deliver').click();await expect(page.locator('#private-delivery-details')).toContainText('旧密文备份');
  const backups=fs.readdirSync(join(repo.file,'..')).filter(name=>name.startsWith('.studio-delivery-backup-'));expect(backups.length).toBe(1);expect(fs.readFileSync(join(repo.file,'..',backups[0]!)).equals(old)).toBe(true);expect(fs.readFileSync(repo.source).equals(source)).toBe(true);expect(fs.readdirSync(join(repo.bundle,'..'))).toEqual(['bundle.json']);
});
test('M15 editing invalidates delivery, and modified candidate bytes cannot replace the formal bundle',async({page,repo})=>{
  await open(page,repo);await exportCandidate(page,repo);await page.locator('#private-list button').first().click();await page.getByLabel('私人标题',{exact:true}).fill('非敏感候选失效');await expect(page.locator('#private-deliver')).toBeDisabled();expect(fs.existsSync(repo.bundle)).toBe(false);
  await save(page);const path=await exportCandidate(page,repo,'changed-candidate.json');fs.appendFileSync(path,'\n');page.once('dialog',dialog=>dialog.accept());await page.locator('#private-deliver').click();await expect(page.locator('#private-state')).toContainText('DELIVERY_STALE');expect(fs.existsSync(repo.bundle)).toBe(false);await expect(page.locator('#private-deliver')).toBeDisabled();
});
test('M15 changed public source rejects export; changed formal target rejects confirmation without overwrite',async({page,repo})=>{
  await open(page,repo);const path=join(repo.file,'..','stale-export.json');await repo.choose(page,'export',path);await page.locator('#private-export').click();await expect(page.locator('#private-password-dialog')).toBeVisible();fs.appendFileSync(repo.source,'\n// public changed\n');await secret(page,true);await expect(page.locator('#private-state')).toContainText('PRIVATE_PUBLIC_CHANGED');expect(fs.existsSync(path)).toBe(false);
  await exportCandidate(page,repo,'fresh-export.json');repo.expectBundle();fs.mkdirSync(join(repo.bundle,'..'),{recursive:true});fs.writeFileSync(repo.bundle,fs.readFileSync(repo.file));const before=fs.readFileSync(repo.bundle);await page.locator('#private-deliver').click();await expect(page.locator('#private-state')).toContainText('DELIVERY_STALE');expect(fs.readFileSync(repo.bundle).equals(before)).toBe(true);
});
test('M15 an unknown formal write result is never retried and read-only SHA inspection confirms the actual result',async({page,repo})=>{
  await open(page,repo);const master=fs.readFileSync(repo.file);await exportCandidate(page,repo);await page.route('**/api/studio-private/delivery/replace',async route=>{await route.fetch();await route.abort('connectionfailed');});repo.expectBundle();page.once('dialog',dialog=>dialog.accept());await page.locator('#private-deliver').click();await expect(page.locator('#private-state')).toContainText('CONNECTION_LOST');await expect(page.locator('#private-deliver')).toBeDisabled();expect(JSON.stringify(await decryptVault(JSON.parse(fs.readFileSync(repo.bundle,'utf8')),password))===JSON.stringify(repo.original)).toBe(true);
  await expect(page.locator('#private-select-export')).toBeDisabled();
  await page.locator('#private-delivery summary').click();await page.locator('#private-delivery-status').click();await expect(page.locator('#private-delivery-message')).toContainText('已读取并确认');await expect(page.locator('#private-deliver')).toBeDisabled();expect(fs.readFileSync(repo.file).equals(master)).toBe(true);
});
test('M15 wrong source password refuses export before ciphertext upload and preserves the master and absent formal target',async({page,repo})=>{
  await open(page,repo);const path=join(repo.file,'..','wrong-password.json'),before=fs.readFileSync(repo.file);await repo.choose(page,'export',path);await page.locator('#private-export').click();await expect(page.locator('#private-password-dialog')).toBeVisible();for(const id of ['private-password','private-password-confirm'])await page.locator('#'+id).fill('NON_SENSITIVE_WRONG_SOURCE_PASSWORD');await page.locator('#private-password-dialog').getByRole('button',{name:'继续',exact:true}).click();await expect(page.locator('#private-state')).toContainText('PRIVATE_UNLOCK_FAILED');expect(fs.existsSync(path)||fs.existsSync(repo.bundle)).toBe(false);expect(fs.readFileSync(repo.file).equals(before)).toBe(true);
});
