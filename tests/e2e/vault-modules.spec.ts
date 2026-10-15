import { test,expect } from '@playwright/test';
import { encryptVault } from '../../src/core/vault/crypto.ts';
import { allVaultFixture,vaultPassword,projectId,supplementId } from '../fixtures/vault.ts';
async function setup(page:import('@playwright/test').Page,value:unknown=allVaultFixture) {
  const envelope=await encryptVault(value,vaultPassword);await page.route('**/vault/bundle.json',route=>route.fulfill({json:envelope}));await page.goto('./');await page.locator('[data-vault-entrance]').press('Enter');await page.getByLabel('私人空间口令',{exact:true}).fill(vaultPassword);await page.getByRole('button',{name:'解锁',exact:true}).click();
}
test('Keep private categories/detail/source and Me personal supplement stay module-owned and clear on lock',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await setup(page);await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');await expect(page.locator('[data-vault-dialog]')).not.toBeVisible();
  await page.getByRole('link',{name:'Keep, 2 entries',exact:true}).click();await expect(page.locator('.private-bookmarks')).toContainText('私人工具');await page.getByRole('button',{name:'私人工具',exact:true}).click();expect(new URL(page.url()).search).toBe('');
  await page.getByRole('link',{name:'安全验收样本：私人收藏',exact:true}).click();await expect(page.locator('h1:visible')).toHaveText('安全验收样本：私人收藏');const source=page.getByRole('link',{name:'打开来源',exact:false});await expect(source).toHaveAttribute('href','https://example.com/resource');await expect(source).toHaveAttribute('target','_blank');await expect(source).toHaveAttribute('rel','noopener noreferrer');
  await page.getByRole('link',{name:'返回收藏夹',exact:false}).click();await page.getByRole('link',{name:'Home',exact:true}).click();await expect(page.locator('[data-compass]')).toBeVisible();
  await page.getByRole('link',{name:/^Me, average/}).click();await expect(page.locator('h1:visible')).toHaveText('韩江恺');await expect(page.locator('.private-profile')).toContainText('CANARY_P4_ME_ONLY');
  await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('private-me-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'锁定私人空间'}).click();await expect(page.locator('.vault-view')).toHaveCount(0);expect(await page.locator('body').innerText()).not.toContain('CANARY_P4_ME_ONLY');await expect(page.locator('h1:visible')).toHaveText('韩江恺');
  expect(errors).toEqual([]);
});
test('Build private project records and public NEMU supplement have distinct progress and safe return paths',async({page},info)=>{
  await setup(page);await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');await expect(page.locator('[data-vault-dialog]')).not.toBeVisible();await page.getByRole('link',{name:'Build, 2 entries',exact:true}).click();
  await page.getByRole('link',{name:'安全验收样本：私人项目',exact:true}).click();await expect(page).toHaveURL(new RegExp(`#vault=${projectId}$`));await expect(page.locator('.private-project')).toContainText('验证阶段');await expect(page.locator('.private-project')).toContainText('非敏感问题');await page.getByText('一次非敏感更新',{exact:true}).click();await expect(page.locator('.private-project')).toContainText('验证记录');
  await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('private-build-mobile.png'),fullPage:true});
  await page.getByRole('link',{name:'返回项目',exact:false}).click();await page.getByRole('link',{name:'安全验收样本：NEMU私人补充',exact:true}).click();await expect(page).toHaveURL(new RegExp(`#vault=${supplementId}$`));await page.getByRole('link',{name:'查看公开项目档案',exact:false}).click();await expect(page.locator('h1:visible')).toHaveText('NEMU：从指令执行到分页与异常的 x86 模拟器');await expect(page.locator('.private-project-supplement')).toContainText('补充测试记录');
  await page.getByRole('button',{name:'锁定私人空间'}).click();await expect(page.locator('.private-project-supplement')).toHaveCount(0);await expect(page.locator('h1:visible')).toHaveText('NEMU：从指令执行到分页与异常的 x86 模拟器');
});
test('empty adapters render no placeholder; invalid public parent or payload rolls back all modules',async({page})=>{
  await setup(page,{version:1,modules:{keep:{bookmarks:[]},build:{projects:[],supplements:[]},me:{paragraphs:[]}},assets:{}});await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');await expect(page.locator('[data-vault-dialog]')).not.toBeVisible();await page.getByRole('link',{name:'Keep, 1 entry',exact:true}).click();await expect(page.locator('.vault-view')).toHaveCount(0);
  await page.unroute('**/vault/bundle.json');const invalid={...allVaultFixture,modules:{...allVaultFixture.modules,build:{...allVaultFixture.modules.build,supplements:[{...allVaultFixture.modules.build.supplements[0],publicSlug:'missing'}]}}};await setup(page,invalid);await expect(page.locator('#vault-status')).toHaveText('口令或内容校验失败。');await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');await expect(page.locator('.vault-view')).toHaveCount(0);
});
