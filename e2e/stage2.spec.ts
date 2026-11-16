// End-to-end checks for stage 2 pages, against the mocked API in mock-api.ts.
import { expect, signedIn as test } from './fixtures';

test('feed lists recent episodes', async ({ page }) => {
  await page.goto('/feed');
  await expect(page.locator('.ep-title')).toHaveText(['First Episode', 'Second Episode', 'Third Episode', 'Beta One']);
});

test('history filters to completed on the server', async ({ page, api }) => {
  await page.goto('/history');
  await expect(page.locator('.ep-title')).toHaveCount(2);
  await page.locator('.pfb-chips .sp-chip', { hasText: 'Completed' }).click();
  await expect(page.locator('.ep-title')).toHaveText(['Second Episode']);
  expect(api.calls.some((c) => c.path.endsWith('/user_history/3') && c.query.filter === 'completed')).toBe(true);
});

test('saving from the menu shows the episode on Saved, and unsaving removes it', async ({ page }) => {
  await page.goto('/podcast/86');
  await page.locator('.ep-row', { hasText: 'Third Episode' }).getByRole('button', { name: 'Episode actions' }).click();
  await page.locator('.dropdown-option', { hasText: 'Save Episode' }).click();
  await page.goto('/saved');
  await expect(page.locator('.ep-title')).toHaveText(['Third Episode']);
  await page.getByRole('button', { name: 'Episode actions' }).click();
  await page.locator('.dropdown-option', { hasText: 'Remove from Saved' }).click();
  await expect(page.locator('.ep-title')).toHaveCount(0);
});

test('a new collection appears as a tab', async ({ page }) => {
  await page.goto('/saved');
  await page.getByRole('button', { name: 'New Collection' }).click();
  await page.locator('#col-name').fill('Road trip');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.collections-tabs .sp-chip.is-active')).toContainText('Road trip');
});

test('add to collection from the episode menu opens the picker', async ({ page }) => {
  await page.goto('/podcast/86');
  await page.locator('.ep-row', { hasText: 'First Episode' }).getByRole('button', { name: 'Episode actions' }).click();
  await page.locator('.dropdown-option', { hasText: 'Add to Collection' }).click();
  await expect(page.locator('li.dropdown-option', { hasText: 'Saved' })).toBeVisible();
});

test('create a playlist and open it', async ({ page, api }) => {
  await page.goto('/playlists');
  await page.getByRole('button', { name: 'Create Playlist' }).click();
  await page.locator('#pl-name').fill('Short stuff');
  await page.getByPlaceholder('Max', { exact: true }).fill('20');
  await page.locator('form').getByRole('button', { name: 'Create Playlist' }).click();
  await expect(page.locator('.playlist-title')).toContainText(['Short stuff']);
  // Durations are sent in minutes; the server converts to seconds.
  expect(api.playlists[0]).toMatchObject({ name: 'Short stuff', max_duration: 20, user_id: 3 });
  await page.locator('.playlist-card-stack').first().click();
  await expect(page.locator('h1', { hasText: 'Short stuff' })).toBeVisible();
  await expect(page.locator('.ep-title')).toHaveCount(2);
});

test('library search finds episodes and remembers the term', async ({ page }) => {
  await page.goto('/search');
  await page.getByPlaceholder(/Search episodes/i).fill('third');
  await page.keyboard.press('Enter');
  await expect(page.locator('.ep-title')).toHaveText(['Third Episode']);
  await page.locator('.sp-clear').click();
  await expect(page.locator('.sp-recent-pill')).toContainText(['third']);
});

test('top-bar search shows results; a new podcast opens as a preview with its feed', async ({ page }) => {
  await page.goto('/home');
  await page.getByPlaceholder('Search New Shows…').fill('gamma');
  await page.getByPlaceholder('Search New Shows…').press('Enter');
  await expect(page).toHaveURL(/\/search_results\?q=gamma/);
  await page.locator('.podcast-card__title', { hasText: 'Gamma Radio' }).click();
  await expect(page).toHaveURL(/\/podcast\/preview\?feed=/);
  await expect(page.locator('.pd-banner-title')).toHaveText('Gamma Radio');
  await expect(page.locator('.ep-title')).toHaveText(['Gamma Ep 1', 'Gamma Ep 2']);
  // Subscribing moves to the real podcast page.
  await page.locator('.pd-btn-primary').click();
  await expect(page).toHaveURL(/\/podcast\/99$/);
});

test('discover shows the For You section and trending categories', async ({ page }) => {
  await page.goto('/discover');
  await expect(page.locator('h1.text-2xl', { hasText: 'Discover' })).toBeVisible();
  await expect(page.locator('h2', { hasText: 'For You' })).toBeVisible();
  await expect(page.locator('.sp-chip', { hasText: 'Arts' })).toBeVisible();
});
