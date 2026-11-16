// End-to-end checks for stage 3 pages (people, YouTube, user settings), against the
// mocked API in mock-api.ts.
import { expect, signedIn as test } from './fixtures';

test('podcast page shows its hosts and guests, linking to the person page', async ({ page }) => {
  await page.goto('/podcast/86');
  const hosts = page.locator('.pd-banner-hosts');
  await expect(hosts).toContainText('Roman Mars');
  await expect(page.locator('.pd-banner-guests')).toContainText('Guest Star');
  await hosts.getByRole('link', { name: 'Roman Mars' }).click();
  await expect(page).toHaveURL(/\/person\/7$/);
  await expect(page.locator('.pp-profile-name')).toHaveText('Roman Mars');
});

test('person page lists shows and library episodes, and elsewhere episodes on their tab', async ({ page }) => {
  await page.goto('/person/7');
  await expect(page.locator('.pp-show-name')).toHaveText(['Alpha Show', 'Outside Show']);
  await expect(page.locator('.pp-show-badge')).toHaveCount(1);
  await expect(page.locator('.ep-title')).toHaveText(['First Episode', 'Second Episode', 'Third Episode']);
  await page.getByRole('tab', { name: /Elsewhere/ }).click();
  await expect(page.locator('.ep-title')).toHaveText(['Guest Spot']);
});

test('following a person lists them on the followed-people page', async ({ page, api }) => {
  await page.goto('/person/7');
  await page.locator('.pp-profile-actions .pp-follow').click();
  await expect(page.locator('.pp-profile-actions .pp-follow')).toHaveClass(/is-following/);
  expect(api.calls.some((c) => c.method === 'POST' && c.path === '/api/data/people/7/follow')).toBe(true);
  await page.goto('/people_subs');
  await expect(page.locator('.pp-followed-name')).toHaveText(['Roman Mars']);
  await expect(page.locator('.ep-title')).toContainText(['Guest Spot']);
});

test('a PodPeopleDB host from Discover resolves to the canonical person URL', async ({ page }) => {
  await page.goto('/discover');
  await page.locator('.discover-host-card', { hasText: 'Roman Mars' }).click();
  await expect(page).toHaveURL(/\/person\/7$/);
  await expect(page.locator('.pp-profile-name')).toHaveText('Roman Mars');
});

test('an unknown person shows not found', async ({ page }) => {
  await page.goto('/person/pp-12345');
  await expect(page.locator('.page-subtitles')).toBeVisible();
});

test('YouTube search lists each channel once, and subscribing flips the button', async ({ page, api }) => {
  await page.goto('/home');
  await page.locator('.src-source').click();
  await page.locator('.src-dropdown-item', { hasText: 'YouTube' }).click();
  await page.getByPlaceholder('Search New Shows…').fill('tube');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/youtube_layout\?q=tube$/);
  await expect(page.locator('h3', { hasText: /^Tube/ })).toHaveText(['Tube One', 'Tube Two']);
  const one = page.locator('.search-item-container', { hasText: 'Tube One' });
  await one.getByRole('button', { name: 'Subscribe' }).click();
  await expect(one.getByRole('button', { name: 'Unsubscribe' })).toBeVisible();
  expect(api.called('youtube/subscribe')[0].query).toMatchObject({ channel_id: 'UC1', user_id: '3' });
});

test('settings: picking a theme saves it', async ({ page, api }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: /Show \d+ more/ }).click();
  await page.locator('.theme-card-item', { hasText: 'Dracula' }).click();
  await expect.poll(() => api.called('user/set_theme').at(-1)?.body).toMatchObject({ user_id: 3, new_theme: 'Dracula' });
});

test('settings: password change sends an Argon2id hash, never the password', async ({ page, api }) => {
  await page.goto('/settings');
  await page.getByLabel('New Password').fill('hunter22');
  await page.getByLabel('Confirm Password').fill('hunter22');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect.poll(() => api.called('set_password/3').length).toBe(1);
  const hash = api.called('set_password/3')[0].body.hash_pw as string;
  expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  expect(JSON.stringify(api.calls)).not.toContain('hunter22');
});

test('settings: mismatched passwords are caught before anything is sent', async ({ page, api }) => {
  await page.goto('/settings');
  await page.getByLabel('New Password').fill('hunter22');
  await page.getByLabel('Confirm Password').fill('hunter23');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('.error-text')).toBeVisible();
  expect(api.called('set_password/3')).toHaveLength(0);
});

test('settings: turning on the gpodder server shows the app login details', async ({ page }) => {
  await page.goto('/settings');
  await page.locator('label.toggle').filter({ has: page.getByLabel('Enable the gpodder server') }).click();
  await expect(page.getByLabel('Enable the gpodder server')).toBeChecked();
  await expect(page.locator('code.sync-code', { hasText: 'https://pods.example' })).toBeVisible();
});

test('settings: ?section= scrolls to feed problems', async ({ page }) => {
  await page.goto('/settings?section=feed_problems');
  await expect(page.locator('#settings-feed_problems')).toBeInViewport();
});
