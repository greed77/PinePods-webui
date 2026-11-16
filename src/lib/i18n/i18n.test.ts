import { describe, expect, it } from 'vitest';
import { setLanguage, t } from './index.svelte';

describe('translations', () => {
  it('looks up nested English keys', () => {
    expect(t('navigation.home')).toBe('Home');
  });

  it('returns the key itself when missing', () => {
    expect(t('nope.not_a_key')).toBe('nope.not_a_key');
  });

  it('fills {placeholders}', () => {
    expect(t('navigation.unmatched_podcasts_notification', { count: 4 })).toContain('4 podcast(s)');
  });

  it('switches language and falls back to English for missing keys', async () => {
    await setLanguage('de');
    expect(t('navigation.home')).not.toBe('Home');
    expect(t('nope.not_a_key')).toBe('nope.not_a_key');
    await setLanguage('en');
    expect(t('navigation.home')).toBe('Home');
  });
});
