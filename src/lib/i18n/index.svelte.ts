// Translations come straight from upstream (web/src/translations/*.json) so
// every key the Rust UI uses resolves here too. English is bundled; the rest
// load on demand. Missing keys fall back to English, then to the key itself.
import en from './translations/en.json';

type Dict = Record<string, unknown>;

const loaders = import.meta.glob<{ default: Dict }>('./translations/*.json');

let current = $state<{ lang: string; dict: Dict }>({ lang: 'en', dict: en as Dict });

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Dict)) node = (node as Dict)[part];
    else return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

/** Translate `key`, replacing `{name}` placeholders from `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = lookup(current.dict, key) ?? lookup(en as Dict, key) ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function currentLanguage() {
  return current.lang;
}

export async function setLanguage(lang: string) {
  if (!lang || lang === current.lang) return;
  if (lang === 'en') {
    current = { lang, dict: en as Dict };
    return;
  }
  const load = loaders[`./translations/${lang}.json`];
  if (!load) return;
  const mod = await load();
  current = { lang, dict: mod.default };
  document.documentElement.lang = lang;
}
