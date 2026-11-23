import type { Page } from '@playwright/test';

export async function reveal(page: Page, id: string) {
  const disclosure = page.locator('#' + id);
  if (await disclosure.getAttribute('open') === null) await disclosure.locator(':scope > summary').click();
}

export async function clickDisclosed(page: Page, id: string, control: string) {
  await reveal(page, id);
  await page.locator(control).click();
}

export async function chooseWorkspace(page: Page, workspace: string) {
  await clickDisclosed(page, 'workspace-switcher', '#module-' + workspace);
}
