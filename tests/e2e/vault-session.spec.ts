import { test, expect } from '@playwright/test';
test('public modules remain browsable with JavaScript disabled',async({browser,baseURL})=>{
  const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
  await page.goto(baseURL!);await page.getByRole('link',{name:'Think, 2 entries',exact:true}).click();
  await expect(page.locator('.thought-heading h1')).toHaveText('想法不必一开始就有答案。');
  await page.getByRole('link',{name:'Home',exact:true}).click();await expect(page).toHaveURL(baseURL!);
  await context.close();
});
