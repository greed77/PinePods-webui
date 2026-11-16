// Login flow, ported from upstream requests/login_requests.rs and pages/login.rs.
import * as E from '$lib/api/endpoints';
import { session } from '$lib/stores/session.svelte';
import { prefs, ui } from '$lib/stores/app.svelte';
import { changeTheme } from '$lib/theme/themes.js';
import { applyThemeByName, isBuiltinTheme } from '$lib/theme/custom';
import { setLanguage } from '$lib/i18n/index.svelte';
import { md5 } from 'hash-wasm';

export type LoginResult = { kind: 'success' } | { kind: 'mfa'; userId: number; token: string };

/** Username/password login. Returns `mfa` when a second factor is needed. */
export async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  const check = await E.pinepodsCheck();
  if (!check.pinepods_instance) throw new Error('Pinepods instance not found at specified server');
  const res = await E.getKey(username, password);
  if (res.status === 'mfa_required' && res.mfa_required) {
    return { kind: 'mfa', userId: res.user_id!, token: res.mfa_session_token! };
  }
  if (!res.retrieved_key) throw new Error('No API key returned from server');
  await completeLogin(res.retrieved_key, username);
  return { kind: 'success' };
}

export async function loginWithMfa(token: string, code: string) {
  const res = await E.verifyMfaAndGetKey(token, code);
  if (!res.verified || res.status !== 'success' || !res.retrieved_key) throw new Error('MFA verification failed');
  await completeLogin(res.retrieved_key, '');
}

/** Verify a key and load everything a session needs (upstream `complete_login_flow`). */
export async function completeLogin(apiKey: string, username: string) {
  const v = await E.verifyKey(apiKey);
  if (v.status !== 'success') throw new Error('API key verification failed');
  const idRes = await E.getUserId(apiKey);
  if (idRes.status !== 'success' || !idRes.retrieved_id) throw new Error('Failed to get user ID');
  const user = await E.getUserDetails(apiKey, idRes.retrieved_id);
  if (!user?.Username) throw new Error('Failed to get user details');
  const server = await E.getApiConfig(apiKey);
  session.set(
    { UserID: user.UserID, Fullname: user.Fullname, Username: user.Username, Email: user.Email, UseGravatar: !!user.UseGravatar },
    { server_name: session.serverName, username: username || user.Username, api_key: apiKey },
    server
  );
  try {
    sessionStorage.setItem('isAuthenticated', 'true');
  } catch {
    /* ignore */
  }
}

/** Theme, time settings, language and avatar for a signed-in user. */
export async function loadUserSettings() {
  const tasks: Promise<unknown>[] = [
    E.getTheme().then(async ({ theme }) => {
      // A custom theme's colors live on the server (upstream only applies them when picked).
      if (isBuiltinTheme(theme)) changeTheme(theme);
      else applyThemeByName(theme, await E.getCustomThemes().catch(() => []));
      try {
        localStorage.setItem('selected_theme', theme);
      } catch {
        /* ignore */
      }
    }),
    E.getTimeInfo().then((tz) => {
      prefs.timezone = tz.timezone || 'UTC';
      prefs.hourPref = tz.hour_pref || 24;
      prefs.dateFormat = tz.date_format || 'ISO';
    }),
    E.getUserLanguage()
      .then((r) => setLanguage(r.language))
      .catch(() => E.getServerDefaultLanguage().then((r) => setLanguage(r.default_language))),
    E.getPinepodsVersion().then((v) => (ui.pinepodsVersion = v.data))
  ];
  const email = (session.user?.Email ?? '').trim().toLowerCase();
  tasks.push(md5(email).then((h) => (prefs.gravatarUrl = `https://gravatar.com/avatar/${h}?s=80`)));
  await Promise.allSettled(tasks);
}

/** Where to go after login: a route saved before a redirect to login, the
 *  user's configured start page, or home. */
export async function startPage(): Promise<string> {
  try {
    const requested = sessionStorage.getItem('requested_route');
    if (requested) {
      sessionStorage.removeItem('requested_route');
      return requested;
    }
  } catch {
    /* ignore */
  }
  try {
    const { StartPage } = await E.getStartPage();
    if (StartPage) return '/' + StartPage.replace(/^\/+/, '');
  } catch {
    /* default */
  }
  return '/home';
}

/** Begin an OIDC login: remember state, register it with the server, go to the IdP. */
export async function startOidc(provider: { authorization_url: string; client_id: string; scope: string }) {
  const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
  const state = Array.from(rand(16), (b) => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(OIDC_STATE_KEY, state);
  const verifier = b64url(rand(32));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const origin = location.origin;
  const redirect_uri = `${session.serverName}/api/auth/callback`;
  await E.storeOidcState({ state, client_id: provider.client_id, origin_url: origin, code_verifier: verifier, redirect_uri });
  const sep = provider.authorization_url.includes('?') ? '&' : '?';
  const q = new URLSearchParams({
    client_id: provider.client_id,
    redirect_uri,
    scope: provider.scope,
    response_type: 'code',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  location.href = provider.authorization_url + sep + q.toString();
}

export const OIDC_STATE_KEY = 'pinepods_oidc_state';

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function logout() {
  session.clear();
}
