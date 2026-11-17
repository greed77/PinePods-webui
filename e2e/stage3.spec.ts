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

// Regression: any failed key check (a server hiccup, or a reload aborting the request)
// used to clear the stored session and sign the user out.
test('a server error while checking the key on reload keeps the user signed in', async ({ page, api }) => {
  api.state.verifyStatus = 503;
  await page.goto('/settings');
  await expect(page.locator('.screen-title')).toHaveText('Settings');
  expect(await page.evaluate(() => localStorage.getItem('userAuthState'))).not.toBeNull();
});

test('a rejected key on reload signs the user out', async ({ page, api }) => {
  api.state.verifyStatus = 401;
  await page.goto('/settings');
  await expect(page.locator('#username')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('userAuthState'))).toBeNull();
});

// --- Admin tab ---

test('the Admin tab is hidden from non-admins', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('.settings-tab', { hasText: 'User Settings' })).toBeVisible();
  await expect(page.locator('.settings-tab', { hasText: 'Admin Settings' })).toHaveCount(0);
});

test.describe('as an admin', () => {
  test.beforeEach(async ({ page, api }) => {
    api.state.admin = true;
    await page.goto('/settings');
    await page.locator('.settings-tab', { hasText: 'Admin Settings' }).click();
  });

  test('creating a user sends an Argon2id hash and lists them', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Create New User' }).last().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Username').fill('newbie');
    await dialog.getByLabel('Full Name').fill('New Person');
    await dialog.getByLabel('Email').fill('new@test.com');
    await dialog.getByLabel('Password').fill('secret123');
    await dialog.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('td', { hasText: 'newbie' })).toBeVisible();
    const body = api.called('add_user')[0].body;
    expect(body).toMatchObject({ username: 'newbie', email: 'new@test.com' });
    expect(body.hash_pw).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(body)).not.toContain('secret123');
  });

  test('the last admin cannot lose admin rights; others can', async ({ page, api }) => {
    await page.locator('tr', { hasText: 'test_dev' }).click();
    await page.getByRole('dialog').locator('label.toggle').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Unable to remove admin status from final administrator')).toBeVisible();
    expect(api.called('user/set_isadmin')).toHaveLength(0);

    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).last().click();
    await page.locator('tr', { hasText: 'other@test.com' }).click();
    await page.getByRole('dialog').locator('label.toggle').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('tr', { hasText: 'other@test.com' })).toContainText('Yes');
    expect(api.called('user/set_isadmin')[0].body).toEqual({ user_id: 4, isadmin: true });
  });

  test('the background_tasks user cannot be edited', async ({ page }) => {
    await page.locator('tr', { hasText: 'background_tasks' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('adding an OIDC provider sends the default scopes', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Add Provider' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Provider Name').fill('Authentik');
    await dialog.getByLabel('Client ID').fill('cid');
    await dialog.getByLabel(/Client Secret/).fill('csecret');
    await dialog.getByLabel('Authorization URL').fill('https://auth.example.com/authorize');
    await dialog.getByLabel('Token URL').fill('https://auth.example.com/token');
    await dialog.getByLabel('User Info URL').fill('https://auth.example.com/userinfo');
    await dialog.getByLabel('Button Text', { exact: true }).fill('Login with Authentik');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Authentik', { exact: true })).toBeVisible();
    expect(api.called('add_oidc_provider')[0].body).toMatchObject({ provider_name: 'Authentik', scope: 'openid email profile' });
  });

  test('restoring a server backup asks first', async ({ page, api }) => {
    await page.getByLabel('Select from server backups').check();
    await page.getByText('backup_1.sql').last().click();
    await page.getByRole('button', { name: /Restore from selected/i }).click();
    await expect(page.getByRole('heading', { name: 'Restore Server' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(api.called('restore_backup_file')).toHaveLength(0);
  });
});
