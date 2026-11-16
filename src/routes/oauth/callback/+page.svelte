<script lang="ts">
  // The server finishes the OIDC exchange and redirects here with ?api_key=&state=.
  // Only accept a key for a login this browser started (upstream oauth_callback.rs).
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { completeLogin, loadUserSettings, OIDC_STATE_KEY, startPage } from '$lib/auth';
  import { t } from '$lib/i18n/index.svelte';
  import Loading from '$lib/components/Loading.svelte';

  let error = $state<string | null>(null);

  onMount(async () => {
    const params = page.url.searchParams;
    const serverError = params.get('error');
    if (serverError) {
      const known = ['username_conflict', 'authentication_failed', 'invalid_provider', 'no_access'];
      return (error = t(`oauth_callback.${known.includes(serverError) ? serverError : 'unexpected_error'}`));
    }
    const key = params.get('api_key');
    if (!key) return (error = t('oauth_callback.api_key_not_found'));
    let expected: string | null = null;
    try {
      expected = sessionStorage.getItem(OIDC_STATE_KEY);
      sessionStorage.removeItem(OIDC_STATE_KEY);
    } catch {
      /* ignore */
    }
    if (!expected || params.get('state') !== expected) return (error = t('oauth_callback.invalid_api_key'));
    try {
      await completeLogin(key, '');
      await loadUserSettings();
      goto(await startPage(), { replaceState: true });
    } catch {
      error = t('oauth_callback.invalid_api_key');
    }
  });
</script>

{#if error}
  <div class="flex justify-center items-start pt-[10vh] h-screen">
    <div class="login-card">
      <p class="item_container-text text-center">{error}</p>
      <a href="/" class="modal-button w-full text-center">{t('auth.login')}</a>
    </div>
  </div>
{:else}
  <Loading />
{/if}
