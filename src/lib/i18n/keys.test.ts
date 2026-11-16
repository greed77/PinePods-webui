// Every translation key the UI uses must exist in en.json (otherwise the raw key
// shows on screen). Scans the source for 'namespace.key' strings in known namespaces.
import { describe, expect, it } from 'vitest';
import en from './translations/en.json';

const sources = import.meta.glob(['/src/**/*.svelte', '/src/**/*.ts', '!/src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

const get = (key: string) => key.split('.').reduce<any>((o, p) => (o && typeof o === 'object' ? o[p] : undefined), en);

describe('translation keys', () => {
  it('all exist in en.json', () => {
    const namespaces = Object.keys(en).join('|');
    const pattern = new RegExp(`['\`]((?:${namespaces})\\.[a-z0-9_]+)['\`]`, 'g');
    const missing: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      for (const m of text.matchAll(pattern)) if (typeof get(m[1]) !== 'string') missing.push(`${m[1]} (${file})`);
    }
    expect(missing).toEqual([]);
  });
});
