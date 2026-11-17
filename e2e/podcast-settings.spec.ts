// End-to-end checks for the podcast page's settings window and its edit/merge
// window, against the mocked API in mock-api.ts.
import { expect, signedIn as test } from './fixtures';
import type { Page } from '@playwright/test';

async function openSettings(page: Page) {
  await page.goto('/podcast/86');
  await page.getByTitle('Click to setup podcast specific settings').click();
  const dialog = page.getByRole('dialog', { name: 'Podcast Options' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('toggles save at once with the podcast and user ids', async ({ page, api }) => {
  const dialog = await openSettings(page);
  await dialog.locator('label', { has: page.getByLabel('Download Future Episodes Automatically:') }).click();
  await expect.poll(() => api.called('enable_auto_download').map((c) => c.body)).toEqual([{ user_id: 3, podcast_id: 86, auto_download: true }]);
  await expect(dialog.getByLabel('Download Future Episodes Automatically:')).toBeChecked();
});

test('playback speed saves as a custom value, and reset goes back to the global default', async ({ page, api }) => {
  const dialog = await openSettings(page);
  await expect(dialog.getByText('Global default').first()).toBeVisible();
  await dialog.locator('#playback-speed').fill('3');
  await dialog.locator('#playback-speed').locator('..').getByRole('button', { name: 'Save' }).click();
  // Out-of-range speeds are clamped to the 0.5x-2.0x the server accepts.
  await expect.poll(() => api.called('podcast/set_playback_speed').map((c) => c.body.playback_speed)).toEqual([2]);
  await expect(dialog.locator('#playback-speed')).toHaveValue('2.0');
  await expect(dialog.getByText('Custom speed')).toBeVisible();
  await dialog.locator('#playback-speed').locator('..').getByRole('button', { name: 'Reset' }).click();
  await expect.poll(() => api.called('clear_podcast_playback_speed').length).toBe(1);
  await expect(dialog.locator('#playback-speed')).toHaveValue('1.0');
  await expect(dialog.getByText('Custom speed')).toHaveCount(0);
});

test('delete-when-finished sends true for on and null for the default', async ({ page, api }) => {
  const dialog = await openSettings(page);
  const select = dialog.locator('#delete-on-complete');
  await expect(select.locator('option').first()).toHaveText('Use my default (off)');
  await select.selectOption('on');
  await select.selectOption('default');
  await expect.poll(() => api.called('podcast/set_auto_delete_on_complete').map((c) => c.body.enabled)).toEqual([true, null]);
});

test('categories can be added and removed, and the header follows', async ({ page, api }) => {
  const dialog = await openSettings(page);
  await dialog.getByLabel('New category').fill('Design');
  await dialog.getByRole('button', { name: 'Add category' }).click();
  await expect(dialog.locator('.category-tag')).toHaveText(['Arts', 'Design']);
  await dialog.getByRole('button', { name: 'Remove Arts' }).click();
  await expect(dialog.locator('.category-tag')).toHaveText(['Design']);
  expect(api.called('add_category')[0].body).toEqual({ user_id: 3, podcast_id: 86, category: 'Design' });
  expect(api.called('remove_category')[0].body).toEqual({ user_id: 3, podcast_id: 86, category: 'Arts' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.pd-banner-cats .category-box')).toHaveText(['Design']);
});

test('editing podcast info sends only the changed fields', async ({ page, api }) => {
  const dialog = await openSettings(page);
  await dialog.getByRole('button', { name: 'Edit Podcast Info' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Podcast Info' });
  await expect(edit.locator('#edit_podcast_name')).toHaveValue('Alpha Show');
  await edit.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('No changes to save')).toBeVisible();
  expect(api.called('update_podcast_info')).toHaveLength(0);

  await edit.locator('#edit_podcast_name').fill('Alpha Renamed');
  await edit.getByRole('button', { name: 'Save Changes' }).click();
  await expect(edit).toHaveCount(0);
  expect(api.called('update_podcast_info').map((c) => c.body)).toEqual([{ user_id: 3, podcast_id: 86, podcast_name: 'Alpha Renamed' }]);
  await expect(page.locator('.pd-banner-title')).toHaveText('Alpha Renamed');
});

test('another podcast can be merged in and unmerged again', async ({ page, api }) => {
  const dialog = await openSettings(page);
  await dialog.getByRole('button', { name: 'Edit Podcast Info' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Podcast Info' });
  await edit.getByRole('button', { name: 'Select Podcasts to Merge' }).click();
  // The podcast itself isn't offered.
  await expect(edit.locator('.max-h-\\[400px\\] span')).toHaveText(['Beta Cast']);
  await edit.getByText('Beta Cast').click();
  await edit.getByRole('button', { name: '1 podcast selected' }).click(); // close the dropdown
  await edit.getByRole('button', { name: 'Merge Podcasts (1)' }).click();
  await expect(edit.locator('.merged-podcast-name')).toHaveText(['Beta Cast']);
  expect(api.called('86/merge')[0].body).toEqual({ secondary_podcast_ids: [87] });

  await edit.getByRole('button', { name: 'Unmerge' }).click();
  await expect(edit.locator('.merged-podcast-item')).toHaveCount(0);
  expect(api.called('86/unmerge/87')).toHaveLength(1);
});
