// End-to-end checks for stage 1, run against the mocked API in mock-api.ts.
import { expect, login, signedIn, test } from './fixtures';
import { mockApi } from './mock-api';

test.describe('login', () => {
  test('password login lands on home and stores an upstream-compatible session', async ({ page }) => {
    await mockApi(page);
    await login(page);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: 'Top Podcasts' })).toBeVisible();
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('userAuthState')!).auth_details);
    expect(auth.api_key).toBe('test-api-key');
    expect(auth.password).toBeNull();
  });

  test('wrong password shows an error and stays on login', async ({ page }) => {
    await mockApi(page);
    await login(page, 'wrong');
    await expect(page.locator('.toast-error')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('MFA prompt completes the login', async ({ page }) => {
    const api = await mockApi(page, { mfa: true });
    await login(page);
    await page.getByPlaceholder(/MFA/i).fill('123456');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page).toHaveURL(/\/home$/);
    expect(api.called('verify_mfa_and_get_key')[0].body).toEqual({ mfa_session_token: 'mfa-token', mfa_code: '123456' });
  });

  test('first login asks for preferences and saves them', async ({ page }) => {
    const api = await mockApi(page, { firstLoginDone: false });
    await login(page);
    await page.locator('#time_zone').selectOption('Europe/Berlin');
    await page.locator('#hour_format').selectOption('12');
    await page.getByRole('button', { name: /Save Preferences/ }).click();
    await expect(page).toHaveURL(/\/home$/);
    expect(api.called('setup_time_info')[0].body).toMatchObject({ user_id: 3, timezone: 'Europe/Berlin', hour_pref: 12 });
  });

  test('a signed-out deep link returns to that page after login', async ({ page }) => {
    await mockApi(page);
    await page.goto('/podcasts');
    await expect(page).toHaveURL(/\/$/);
    await login(page);
    await expect(page).toHaveURL(/\/podcasts$/);
  });

  test('sign out clears the session', async ({ page }) => {
    await mockApi(page);
    await login(page);
    await expect(page).toHaveURL(/\/home$/);
    await page.goto('/sign_out');
    await expect(page.locator('#username')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('userAuthState'))).toBeNull();
  });
});

signedIn.describe('signed in', () => {
  const test = signedIn;

  test('home shows weekly stats and recent episodes', async ({ page }) => {
    await expect(page.getByText('1h 5m')).toBeVisible();
    await expect(page.locator('.ep-title', { hasText: 'First Episode' })).toBeVisible();
  });

  test('podcasts page lists, filters and opens a podcast', async ({ page }) => {
    await page.goto('/podcasts');
    await expect(page.locator('.podcast-title-grid')).toHaveText(['Alpha Show', 'Beta Cast']);
    await page.getByPlaceholder(/Search podcasts/i).fill('beta');
    await expect(page.locator('.podcast-title-grid')).toHaveText(['Beta Cast']);
    await page.locator('.podcast-grid-item').first().click();
    await expect(page).toHaveURL(/\/podcast\/87$/);
    await expect(page.locator('.ep-title')).toHaveText(['Beta One']);
  });

  test('podcast page completed filter asks the server for completed episodes', async ({ page }) => {
    await page.goto('/podcast/86');
    await expect(page.locator('.ep-title')).toHaveCount(3);
    // Second chip: the 3-way completed filter (All -> Show only -> Hide).
    await page.locator('.pfb-chips .sp-chip').nth(1).click();
    await expect(page.locator('.ep-title')).toHaveText(['Second Episode']);
  });

  test('context menu queues an episode and the badge updates', async ({ page }) => {
    await page.goto('/podcast/86');
    await page.locator('.ep-row', { hasText: 'Third Episode' }).getByRole('button', { name: 'Episode actions' }).click();
    await page.locator('.dropdown-option', { hasText: 'Queue Episode' }).first().click();
    await expect(page.locator('.toast-info')).toContainText('Episode queued');
    await page.locator('.topbar-queue-btn').click();
    await expect(page.locator('.queue-item-title')).toHaveText(['Third Episode']);
  });

  test('playing records history, bumps the queue and shows the player', async ({ page, api }) => {
    await page.goto('/episode/101');
    await page.locator('.ep-hero-play').click();
    await expect(page.locator('.player-title')).toHaveText('First Episode');
    await expect(page.locator('.ep-hero-play')).toContainText('Pause');
    await expect.poll(() => api.called('queue_bump').length).toBe(1);
    expect(api.called('record_podcast_history')[0].body).toMatchObject({ episode_id: 101, user_id: 3 });
    expect(api.called('increment_played/3')).toHaveLength(1);
    expect(api.queue).toEqual([101]);
  });

  test('finishing an episode marks it complete and plays the next in the queue', async ({ page, api }) => {
    api.queue.push(103);
    await page.goto('/episode/101');
    await page.locator('.ep-hero-play').click();
    // The test audio is 3 seconds long.
    await expect(page.locator('.player-title')).toHaveText('Third Episode', { timeout: 15_000 });
    expect(api.called('mark_episode_completed')[0].body).toMatchObject({ episode_id: 101 });
  });

  test('playback keeps going across navigation (home icon, drawer, back)', async ({ page }) => {
    await page.goto('/episode/101');
    await page.locator('.ep-hero-play').click();
    await expect(page.locator('.player-title')).toHaveText('First Episode');
    await page.evaluate(() => ((window as any).__sameDocument = true));

    const stillPlaying = async () => {
      expect(await page.evaluate(() => (window as any).__sameDocument)).toBe(true);
      await expect(page.locator('.player-title')).toHaveText('First Episode');
    };

    await page.locator('.drawer-icon a[href="/home"]').click();
    await expect(page).toHaveURL(/\/home$/);
    await stillPlaying();

    await page.getByRole('button', { name: 'Menu' }).click();
    await page.locator('.sb-item', { hasText: 'Podcasts' }).click();
    await expect(page).toHaveURL(/\/podcasts$/);
    await stillPlaying();

    await page.locator('.podcast-grid-item').first().click();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/podcasts$/);
    await stillPlaying();
  });
});
