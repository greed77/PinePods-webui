<script lang="ts">
  // Port of upstream pages/login.rs (server build): password login, MFA prompt,
  // OIDC provider buttons and the first-login preferences dialog. Self-service
  // sign-up, forgot-password and first-admin setup come in a later stage.
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as E from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { completeLogin, loadUserSettings, loginWithMfa, loginWithPassword, startOidc, startPage } from '$lib/auth';
  import { currentLanguage, setLanguage, t } from '$lib/i18n/index.svelte';

  type State = 'default' | 'mfa' | 'timezone';
  let view = $state<State>('default');
  let loading = $state(true);
  let busy = $state(false);
  let username = $state('');
  let password = $state('');
  let mfaCode = $state('');
  let mfaToken = '';
  let providers = $state<any[]>([]);
  let disableStandard = $state(false);
  let languages = $state<{ code: string; name: string }[]>([]);
  const background = `/static/assets/backgrounds/${1 + Math.floor(Math.random() * 9)}.webp`;

  // First-login preferences
  const zones: string[] = (Intl as any).supportedValuesOf?.('timeZone') ?? ['UTC'];
  let tz = $state(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  let hourPref = $state(24);
  let dateFormat = $state('ISO');
  let language = $state(currentLanguage());

  onMount(async () => {
    E.publicOidcProviders()
      .then((r) => {
        providers = r.providers ?? [];
        disableStandard = !!r.disable_standard_login;
      })
      .catch(() => {});
    E.availableLanguages()
      .then((r) => (languages = r.languages ?? []))
      .catch(() => {});

    // Stay signed in with a stored, still-valid key.
    if (session.loggedIn) {
      try {
        await E.verifyKey(session.apiKey);
        await loadUserSettings();
        return goto(await startPage(), { replaceState: true });
      } catch {
        session.clear();
      }
    }
    loading = false;
  });

  async function afterAuth() {
    try {
      const { FirstLogin } = await E.firstLoginDone();
      if (!FirstLogin) {
        view = 'timezone';
        return;
      }
    } catch {
      toast.error(t('login.error_checking_first_login_status'));
    }
    await finish();
  }

  async function finish() {
    await loadUserSettings();
    goto(await startPage());
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const res = await loginWithPassword(username, password);
      password = '';
      if (res.kind === 'mfa') {
        mfaToken = res.token;
        view = 'mfa';
      } else await afterAuth();
    } catch {
      toast.error(t('login.credentials_incorrect'));
    } finally {
      busy = false;
    }
  }

  async function submitMfa(e: Event) {
    e.preventDefault();
    try {
      await loginWithMfa(mfaToken, mfaCode.trim());
      view = 'default';
      await afterAuth();
    } catch (err) {
      view = 'default';
      toast.error(`MFA verification failed: ${(err as Error).message}`);
    }
  }

  async function submitPrefs(e: Event) {
    e.preventDefault();
    try {
      await E.setupTimeInfo(tz, hourPref, dateFormat);
      await E.updateUserLanguage(language).catch(() => {});
      await setLanguage(language);
      view = 'default';
      await finish();
    } catch (err) {
      toast.error(`Error setting up time zone: ${(err as Error).message}`);
    }
  }

  async function oidc(p: any) {
    try {
      await startOidc(p);
    } catch (err) {
      toast.error(`${t('login.oidc_login_failed')}: ${(err as Error).message}`);
    }
  }
</script>

{#if loading}
  <div class="loading-animation fixed inset-0 flex justify-center items-center bg-opacity-80 z-50">
    <div class="frame1"></div>
    <div class="frame2"></div>
    <div class="frame3"></div>
    <div class="frame4"></div>
    <div class="frame5"></div>
    <div class="frame6"></div>
  </div>
{:else}
  <div
    id="login-page"
    style="background-image: url('{background}'); background-repeat: no-repeat; background-attachment: fixed; background-size: cover;"
  >
    {#if view === 'mfa'}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-[calc(100%-1rem)] max-h-full bg-black bg-opacity-25"
        onclick={() => (view = 'default')}
      >
        <div class="modal-container relative p-4 w-full max-w-md max-h-full rounded-lg shadow" onclick={(e) => e.stopPropagation()}>
          <div class="modal-container relative rounded-lg shadow">
            <div class="modal-inner-header">
              <h3 class="text-xl font-semibold item_container-text">{t('login.mfa_login')}</h3>
              <button onclick={() => (view = 'default')} class="modal-close-btn" aria-label={t('common.close_modal')}>
                <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
                </svg>
              </button>
            </div>
            <div class="p-4 md:p-5">
              <form class="space-y-4" onsubmit={submitMfa}>
                <p class="text-m font-semibold item_container-text">{t('login.mfa_welcome')}</p>
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  bind:value={mfaCode}
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  autofocus
                  class="search-bar-input border text-sm rounded-lg block w-full p-2.5"
                  placeholder={t('auth.enter_mfa_code')}
                />
                <button type="submit" class="modal-button w-full">{t('common.submit')}</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    {:else if view === 'timezone'}
      <div class="modal-overlay">
        <div class="item_container-text modal-content">
          <div class="modal-header">
            <i class="ph ph-clock text-xl"></i>
            <h3 class="text-lg">{t('login.initial_setup')}</h3>
          </div>
          <div class="modal-body">
            <form onsubmit={submitPrefs}>
              <div class="modal-welcome">
                <i class="ph ph-hand-waving text-xl"></i>
                <p>{t('login.first_time_welcome')}</p>
              </div>
              <div class="modal-form-group">
                <label class="modal-label" for="language"><i class="ph ph-translate"></i><span>{t('common.language')}</span></label>
                <select id="language" class="modal-select" bind:value={language}>
                  {#each languages as l}<option value={l.code}>{l.name}</option>{/each}
                </select>
              </div>
              <div class="modal-form-group">
                <label class="modal-label" for="hour_format"><i class="ph ph-clock-clockwise"></i><span>{t('login.hour_format')}</span></label>
                <select id="hour_format" class="modal-select" bind:value={hourPref}>
                  <option value={12}>12 Hour</option>
                  <option value={24}>24 Hour</option>
                </select>
              </div>
              <div class="modal-form-group">
                <label class="modal-label" for="time_zone"><i class="ph ph-globe"></i><span>{t('login.time_zone')}</span></label>
                <select id="time_zone" class="modal-select" bind:value={tz}>
                  {#each zones as z}<option value={z}>{z}</option>{/each}
                </select>
              </div>
              <div class="modal-form-group">
                <label class="modal-label" for="date_format"><i class="ph ph-calendar"></i><span>{t('login.date_format')}</span></label>
                <select id="date_format" class="modal-select" bind:value={dateFormat}>
                  <option value="MDY">MM-DD-YYYY</option>
                  <option value="DMY">DD-MM-YYYY</option>
                  <option value="YMD">YYYY-MM-DD</option>
                  <option value="JUL">{t('login.date_format_julian')}</option>
                  <option value="ISO">{t('login.date_format_iso8601')}</option>
                  <option value="USA">MM/DD/YYYY</option>
                  <option value="EUR">DD.MM.YYYY</option>
                  <option value="JIS">YYYY-MM-DD</option>
                </select>
              </div>
              <button type="submit" class="modal-button">
                <i class="ph ph-check"></i>
                <span>{t('login.save_preferences')}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    {/if}

    <div class="flex justify-center items-start pt-[10vh] h-screen">
      <div class="login-card">
        <div class="flex justify-center items-center">
          <img class="object-scale-down h-20 w-66" src="/static/assets/favicon.png" alt="Pinepods Logo" />
        </div>
        <h1 class="item_container-text text-xl font-bold mb-2 text-center">{t('common.pinepods')}</h1>
        <p class="item_container-text text-center">{t('login.tagline')}</p>
        {#if !disableStandard}
          <form class="contents" onsubmit={submit}>
            <input
              type="text"
              id="username"
              name="username"
              autocomplete="username"
              placeholder={t('auth.username')}
              class="search-bar-input border text-sm rounded-lg block w-full p-2.5"
              bind:value={username}
            />
            <input
              type="password"
              id="current-password"
              name="current-password"
              autocomplete="current-password"
              placeholder={t('auth.password')}
              class="search-bar-input border text-sm rounded-lg block w-full p-2.5"
              bind:value={password}
            />
            <button type="submit" class="modal-button w-full" disabled={busy}>{t('auth.login')}</button>
          </form>
        {/if}

        {#if providers.length}
          {#if !disableStandard}
            <div class="oidc-divider">
              <div class="oidc-divider-line"></div>
              <div class="relative flex justify-center">
                <span class="oidc-divider-text item_container-text">{t('login.or_continue_with')}</span>
              </div>
            </div>
          {/if}
          <div class="flex flex-col space-y-2">
            {#each providers as p}
              <button class="oidc-button" style="background-color: {p.button_color}" onclick={() => oidc(p)}>
                {#if p.icon_svg}<div class="oidc-icon">{@html p.icon_svg}</div>{/if}
                <span style="color: {p.button_text_color}">{p.button_text}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
