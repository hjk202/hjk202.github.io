import { expect, type APIRequestContext } from '@playwright/test';

/** Count individual public index entries; don't echo the Compass count under test. */
export async function thinkCount(request: APIRequestContext) {
  const response = await request.get('./search-index.json');
  expect(response.ok()).toBe(true);
  const index = await response.json();
  const articles = index.results.filter((row: { module: string }) => row.module === 'think');
  expect(articles.length).toBeGreaterThanOrEqual(2);
  return articles.length as number;
}
