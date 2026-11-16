<script lang="ts">
  // Port of upstream setting_components/shared_links.rs: episode share links the user
  // made, with extend-expiry and delete.
  import * as E from '$lib/api/endpoints';
  import type { SharedLink } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';

  let links = $state<SharedLink[]>([]);
  let deleting = $state<string | null>(null);
  let extending = $state<string | null>(null);
  let days = $state(30);

  function load() {
    E.getSharedLinks().then((v) => (links = v), (e) => toast.error(`Error loading shared links: ${(e as Error).message}`));
  }
  load();

  async function remove(code: string) {
    deleting = null;
    try {
      await E.deleteSharedLink(code);
      toast.info('Shared link deleted.');
      load();
    } catch (e) {
      toast.error(`Error deleting link: ${(e as Error).message}`);
    }
  }

  async function extend(code: string) {
    extending = null;
    const d = Math.max(1, Math.min(365, Math.round(days || 30)));
    try {
      await E.extendSharedLink(code, d);
      toast.info(`Shared link extended by ${d} days.`);
      load();
    } catch (e) {
      toast.error(`Error extending link: ${(e as Error).message}`);
    }
  }
</script>

{#if deleting}
  {@const code = deleting}
  <ConfirmModal
    title={t('shared_links.delete_link')}
    text={t('shared_links.delete_link_confirm')}
    yes={t('shared_links.delete')}
    no={t('shared_links.cancel')}
    onyes={() => remove(code)}
    onclose={() => (deleting = null)}
  />
{/if}

{#if extending}
  {@const code = extending}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-full max-h-full bg-black bg-opacity-25"
    onclick={(e) => e.target === e.currentTarget && (extending = null)}
  >
    <div class="modal-container relative p-4 w-full max-w-md max-h-full rounded-lg shadow" role="dialog" aria-modal="true" aria-label={t('shared_links.extend_link')}>
      <div class="flex flex-col items-start justify-between p-4 md:p-5 border-b rounded-t">
        <h3 class="text-xl font-semibold item_container-text">{t('shared_links.extend_link')}</h3>
        <p class="text-m font-semibold">{t('shared_links.extend_link_description')}</p>
        <div class="mt-4 w-full">
          <label class="block mb-2 text-sm font-medium" for="extend-days">{t('shared_links.days_to_extend')}</label>
          <input id="extend-days" type="number" min="1" max="365" bind:value={days} class="form-input w-full" />
        </div>
        <div class="flex justify-between space-x-4">
          <button onclick={() => extend(code)} class="mt-4 settings-button font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">{t('shared_links.extend')}</button>
          <button onclick={() => (extending = null)} class="mt-4 download-button font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">{t('shared_links.cancel')}</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<div class="relative overflow-x-auto">
  <table class="w-full text-sm text-left rtl:text-right">
    <thead class="text-xs uppercase table-header">
      <tr>
        <th scope="col" class="px-6 py-3">{t('shared_links.episode')}</th>
        <th scope="col" class="px-6 py-3">{t('shared_links.podcast')}</th>
        <th scope="col" class="px-6 py-3">{t('shared_links.expires')}</th>
        <th scope="col" class="px-6 py-3">{t('shared_links.actions')}</th>
      </tr>
    </thead>
    <tbody>
      {#if links.length === 0}
        <tr class="table-row border-b"><td colspan="4" class="px-6 py-4 text-center">{t('shared_links.no_links')}</td></tr>
      {:else}
        {#each links as link (link.share_code)}
          <tr class="table-row border-b">
            <td class="px-6 py-4">{link.episode_title}</td>
            <td class="px-6 py-4">{link.podcast_name}</td>
            <td class="px-6 py-4">{link.expiration_date}</td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <button
                  onclick={() => {
                    days = 30;
                    extending = link.share_code;
                  }}
                  class="settings-button text-xs font-bold h-8 px-3 rounded"
                  style="margin-top:0;margin-bottom:0;">{t('shared_links.extend')}</button
                >
                <button onclick={() => (deleting = link.share_code)} class="download-button text-xs font-bold h-8 px-3 rounded" style="margin-bottom:0;"
                  >{t('shared_links.delete')}</button
                >
              </div>
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
