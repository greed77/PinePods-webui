// Shared Playwright fixtures: every test fails on an uncaught page error (e.g. a
// Svelte effect loop), and `signedIn` tests start logged in against the mock API.
import { test as base, expect, type Page } from '@playwright/test';
import { mockApi } from './mock-api';

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await use(errors);
      expect(errors, 'uncaught errors in the page').toEqual([]);
    },
    { auto: true }
  ]
});

export async function login(page: Page, password = 'secret') {
  await page.goto('/');
  await page.locator('#username').fill('test_dev');
  await page.locator('#current-password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

export const signedIn = test.extend<{ api: Awaited<ReturnType<typeof mockApi>> }>({
  api: [
    async ({ page }, use) => {
      const api = await mockApi(page);
      await login(page);
      await expect(page).toHaveURL(/\/home$/);
      await use(api);
    },
    { auto: true }
  ]
});

export { expect };
