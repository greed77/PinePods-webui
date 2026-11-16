<script lang="ts">
  // Port of upstream setting_components/api_keys.rs: list the user's API keys, create
  // one (shown once), and delete one by clicking its row.
  import * as E from '$lib/api/endpoints';
  import type { ApiKeyInfo } from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';

  let keys = $state<ApiKeyInfo[]>([]);
  let created = $state<string | null>(null);
  let deleting = $state<ApiKeyInfo | null>(null);

  function load() {
    E.getApiInfo().then((v) => (keys = v), (e) => toast.error(`${t('api_keys.error_getting_api_info')}${(e as Error).message}`));
  }
  load();

  async function create() {
    try {
      created = await E.createApiKey();
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(k: ApiKeyInfo) {
    deleting = null;
    try {
      await E.deleteApiKey(k.apikeyid);
      toast.info(t('api_keys.api_key_deleted_successfully'));
      load();
    } catch (e) {
      toast.error(`${t('api_keys.error_deleting_api_key')}${(e as Error).message}`);
    }
  }

  // Deleting the key this browser signed in with would sign it out on the next call.
  const isCurrent = (k: ApiKeyInfo) => !!session.apiKey && session.apiKey.endsWith(k.lastfourdigits);
</script>

{#if created}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-full max-h-full bg-black bg-opacity-25"
    onclick={(e) => e.target === e.currentTarget && (created = null)}
  >
    <div class="modal-container relative p-4 w-full max-w-md max-h-full rounded-lg shadow" role="dialog" aria-modal="true">
      <div class="flex flex-col items-start justify-between p-4 md:p-5 border-b rounded-t">
        <h3 style="font-size:16px;font-weight:600;color:var(--text-color);margin-bottom:8px;">{t('api_keys.new_api_key_created')}</h3>
        <p style="font-size:13px;color:var(--text-secondary-color);">{t('api_keys.api_key_save_instructions')}</p>
        <div class="mfa-code-box mt-4 p-4 rounded-md overflow-x-auto whitespace-nowrap max-w-full">{created}</div>
        <button onclick={() => (created = null)} class="btn btn-primary" style="margin-top:16px;">{t('api_keys.ok')}</button>
      </div>
    </div>
  </div>
{/if}

{#if deleting}
  {@const k = deleting}
  <ConfirmModal
    title={t('api_keys.delete_api_key')}
    text={isCurrent(k) ? `${t('api_keys.delete_api_key_confirmation')} This is the key this browser is signed in with.` : t('api_keys.delete_api_key_confirmation')}
    yes={t('api_keys.delete')}
    no={t('api_keys.cancel')}
    onyes={() => remove(k)}
    onclose={() => (deleting = null)}
  />
{/if}

<div class="settings-row">
  <div><div class="settings-row-label">{t('api_keys.request_api_key')}</div></div>
  <div class="settings-row-control">
    <button onclick={create} class="btn btn-secondary" style="padding:6px 12px;"><i class="ph ph-key"></i><span>{t('api_keys.request_api_key')}</span></button>
  </div>
</div>
<div class="relative overflow-x-auto">
  <table class="w-full text-sm text-left rtl:text-right">
    <thead class="text-xs uppercase table-header">
      <tr>
        <th scope="col" class="px-6 py-3">{t('api_keys.api_id')}</th>
        <th scope="col" class="px-6 py-3">{t('api_keys.last_4_digits')}</th>
        <th scope="col" class="px-6 py-3">{t('api_keys.date_created')}</th>
        <th scope="col" class="px-6 py-3">{t('api_keys.user')}</th>
      </tr>
    </thead>
    <tbody>
      {#each keys as k (k.apikeyid)}
        <tr class="table-row border-b cursor-pointer" onclick={() => (deleting = k)}>
          <td class="px-6 py-4">{k.apikeyid}</td>
          <td class="px-6 py-4">{k.lastfourdigits}</td>
          <td class="px-6 py-4">{k.created}</td>
          <td class="px-6 py-4">{k.username}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
