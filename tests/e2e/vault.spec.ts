import { test,expect } from '@playwright/test';
import { encryptVault } from '../../src/core/vault/crypto.ts';
const password='phase4-nonsensitive-acceptance';
const panel=(page:import('@playwright/test').Page)=>page.locator('[data-vault-dialog]');
async function configured(page:import('@playwright/test').Page) {
  const envelope=await encryptVault({version:1,modules:{},assets:{}},password);
  await page.route('**/vault/bundle.json',route=>route.fulfill({json:envelope}));
}
async function open(page:import('@playwright/test').Page) {
  await page.goto('./');await page.locator('[data-vault-entrance]').focus();await page.keyboard.press('Enter');await expect(panel(page)).toBeVisible();
}
test('passphrase input rejects unsupported and oversized values before derivation without silently altering them',async({page})=>{
  await configured(page);await open(page);
  const input=page.getByLabel('私人空间口令',{exact:true});
  await expect(input).toHaveAttribute('autocapitalize','off');
  await expect(input).toHaveAttribute('autocorrect','off');
  await page.evaluate(()=>{
    const probe=window as unknown as {vaultDerivations:number};probe.vaultDerivations=0;
    const derive=crypto.subtle.deriveKey.bind(crypto.subtle);
    crypto.subtle.deriveKey=(...args)=>{probe.vaultDerivations++;return derive(...args);};
  });
  for(const value of ['safe\ttext','hidden\u200btext','a'.repeat(1025),'界'.repeat(342)]){
    await input.fill(value);await page.getByRole('button',{name:'解锁',exact:true}).click();
    await expect(input).toHaveValue(value);await expect(input).toHaveAttribute('aria-invalid','true');
    await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
    expect(await page.evaluate(()=>(window as unknown as {vaultDerivations:number}).vaultDerivations)).toBe(0);
  }
  await input.fill('unchanged');
  for(const pasted of ['line\r\nbreak','\u200b','a'.repeat(1025)]){
    expect(await input.evaluate((node,text)=>{
      const clipboardData=new DataTransfer();clipboardData.setData('text/plain',text);
      return node.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));
    },pasted)).toBe(false);
    await expect(input).toHaveValue('unchanged');
  }
  await input.fill(password);await expect(input).not.toHaveAttribute('aria-invalid');await input.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');
});

test('literal markup and punctuation in a valid passphrase are data, never executable HTML or a changed password',async({page})=>{
  const literal='  <script>window.vaultInjected=true</script>!字面  ';
  const envelope=await encryptVault({version:1,modules:{},assets:{}},literal);
  await page.route('**/vault/bundle.json',route=>route.fulfill({json:envelope}));await open(page);
  const input=page.getByLabel('私人空间口令',{exact:true});await input.fill(literal);await expect(input).toHaveValue(literal);await input.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');
  expect(await page.evaluate(()=>(window as unknown as {vaultInjected?:boolean}).vaultInjected)).toBeUndefined();
  expect(await page.locator('body').textContent()).not.toContain(literal);
  await expect(input).toHaveValue('');
});
test('center stays visually quiet during long press; cancelled gestures and keyboard open unconfigured Vault correctly',async({page})=>{
  // This negative case remains meaningful when the author publishes a real encrypted bundle.
  await page.route('**/vault/bundle.json',route=>route.fulfill({status:404,body:'Not configured'}));
  await page.goto('./');const center=page.locator('[data-vault-entrance]');await center.click();await expect(panel(page)).not.toBeVisible();
  const bounds=await center.boundingBox();await page.mouse.move(bounds!.x+22,bounds!.y+22);await page.mouse.down();await page.mouse.move(bounds!.x+70,bounds!.y+22);await page.mouse.up();await page.waitForTimeout(1550);await expect(panel(page)).not.toBeVisible();
  await page.mouse.move(bounds!.x+22,bounds!.y+22);
  await page.locator('.compass-radar').evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished));});
  const appearance=()=>page.locator('.compass-radar, [data-compass-link]').evaluateAll(elements=>elements.map(element=>{const style=getComputedStyle(element);return {transform:style.transform,opacity:style.opacity};}));
  const before=await appearance();await expect(center).not.toHaveAttribute('title');
  await page.mouse.down();await page.waitForTimeout(700);expect(await appearance()).toEqual(before);await expect(panel(page)).not.toBeVisible();
  await expect(panel(page)).toBeVisible({timeout:2000});await page.mouse.up();
  await expect(panel(page)).toHaveCSS('animation-name','none');await expect(panel(page)).toHaveCSS('transform','none');
  expect(await panel(page).evaluate(element=>getComputedStyle(element,'::backdrop').animationName)).toBe('none');
  await expect(panel(page).getByRole('status')).toHaveText('尚未配置私人内容。');await page.keyboard.press('Escape');await expect(panel(page)).not.toBeVisible();await expect(center).toBeFocused();
  await center.press('Enter');await expect(panel(page)).toBeVisible();await page.getByRole('button',{name:'关闭私人空间'}).click();expect(await panel(page).evaluate(element=>(element as HTMLDialogElement).open)).toBe(false);await expect(center).toBeFocused();
});
test('wrong password remains locked; real decryption unlocks, clear inputs, navigates and actively locks',async({page})=>{
  await configured(page);await open(page);const input=page.getByLabel('私人空间口令',{exact:true});
  await expect(input).toBeFocused();await input.fill('wrong-passphrase');await page.evaluate(()=>document.dispatchEvent(new Event('astro:page-load')));await expect(input).toHaveValue('wrong-passphrase');await expect(panel(page)).toBeVisible();await page.getByRole('button',{name:'解锁',exact:true}).click();await expect(panel(page).getByRole('status')).toHaveText('口令或内容校验失败。');await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');await expect(input).toHaveValue('');
  await input.fill(password);await input.press('Enter');await expect(panel(page)).not.toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');await expect(input).toHaveValue('');
  await page.getByRole('link',{name:'Think, 2 entries',exact:true}).click();await expect(page.locator('.thought-heading h1')).toHaveText('想法不必一开始就有答案。');await expect(page.locator('html')).toHaveAttribute('data-vault-unlocked','');
  await page.getByRole('button',{name:'锁定私人空间'}).click();await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');await expect(page.getByRole('link',{name:'Home',exact:true})).toBeFocused();expect(await page.evaluate(()=>localStorage.length+sessionStorage.length)).toBe(0);
});
test('dialog focus, reduced motion and Spotlight exclusivity stay coherent',async({page})=>{
  await configured(page);await open(page);const input=page.getByLabel('私人空间口令',{exact:true});await expect(input).toBeFocused();
  await page.getByRole('button',{name:'关闭私人空间'}).focus();await page.keyboard.press('Control+k');await expect(page.locator('dialog[open]')).toHaveCount(1);await expect(page.locator('[data-spotlight]')).not.toBeVisible();
  await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'解锁',exact:true})).toBeFocused();
  await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('Escape');expect(await panel(page).evaluate(element=>(element as HTMLDialogElement).open)).toBe(false);
  await page.getByRole('button',{name:'Search my space',exact:true}).click();await expect(page.getByRole('combobox')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('[data-spotlight]')).not.toBeVisible();
});
test('late request and late decrypt cannot reopen a cancelled or backgrounded Vault',async({page})=>{
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**/vault/bundle.json',async route=>{await gate;try{await route.fulfill({json:await encryptVault({version:1,modules:{},assets:{}},password)});}catch{ /* Request was cancelled by the tested UI. */ }});
  await open(page);await page.keyboard.press('Escape');release();await expect(panel(page)).not.toBeVisible();await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
  await page.unroute('**/vault/bundle.json');await configured(page);await open(page);await page.getByLabel('私人空间口令',{exact:true}).fill(password);await page.getByRole('button',{name:'解锁',exact:true}).click();await page.keyboard.press('Escape');await expect(panel(page)).not.toBeVisible();await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
});
test('request and protocol failures have a retry; unsupported secure API stays locked',async({page})=>{
  await page.route('**/vault/bundle.json',route=>route.fulfill({status:503,body:'unavailable'}));await open(page);await expect(page.getByRole('button',{name:'重试',exact:true})).toBeVisible();
  await page.unroute('**/vault/bundle.json');await configured(page);await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.getByLabel('私人空间口令',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(panel(page)).not.toBeVisible();
  await page.addInitScript(()=>Object.defineProperty(window,'crypto',{value:undefined,configurable:true}));await open(page);await expect(panel(page).getByRole('status')).toContainText('当前浏览器无法打开私人空间');await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');
});
test('leaving during a pending decrypt cancels the core session as well as the dialog',async({page})=>{
  await configured(page);await open(page);
  await page.evaluate(()=>{
    const native=crypto.subtle.decrypt.bind(crypto.subtle),probe=window as unknown as {releaseDecrypt?:()=>void;decryptCompleted?:boolean};
    crypto.subtle.decrypt=async(...args)=>{await new Promise<void>(resolve=>{probe.releaseDecrypt=resolve;});const result=await native(...args);probe.decryptCompleted=true;return result;};
  });
  await page.getByLabel('私人空间口令',{exact:true}).fill(password);await page.getByRole('button',{name:'解锁',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof (window as unknown as {releaseDecrypt?:unknown}).releaseDecrypt)).toBe('function');
  await page.evaluate(()=>{document.dispatchEvent(new Event('astro:before-swap'));(window as unknown as {releaseDecrypt:()=>void}).releaseDecrypt();});
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {decryptCompleted?:boolean}).decryptCompleted)).toBe(true);
  await expect(page.locator('html')).not.toHaveAttribute('data-vault-unlocked');await expect(panel(page)).not.toBeVisible();
});
for(const theme of ['light','dark'] as const)test(`Unlock ${theme}: narrow/short viewport stays readable and usable`,async({page},info)=>{
  await configured(page);await page.setViewportSize({width:320,height:568});await page.emulateMedia({colorScheme:theme});await open(page);await expect(page.getByLabel('私人空间口令',{exact:true})).toBeVisible();
  await page.setViewportSize({width:320,height:320});await expect(page.getByRole('button',{name:'关闭私人空间'})).toBeVisible();await expect(page.getByRole('button',{name:'解锁',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(panel(page)).toHaveCSS('opacity','1');await page.screenshot({path:info.outputPath(`unlock-${theme}-320.png`)});
  await page.setViewportSize({width:1280,height:800});await expect(panel(page)).toHaveCSS('opacity','1');await page.screenshot({path:info.outputPath(`unlock-${theme}-desktop.png`)});
});
