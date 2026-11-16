<script lang="ts">
  // Port of upstream pages/playlists.rs: smart playlist cards, create, delete
  // and multi-select delete.
  import { goto } from '$app/navigation';
  import * as E from '$lib/api/endpoints';
  import type { PlaylistFull } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import PlaylistFormModal, { draftToForm, emptyDraft } from '$lib/components/PlaylistFormModal.svelte';

  let playlists = $state<PlaylistFull[] | null>(null);
  let selecting = $state(false);
  let selected = $state(new Set<number>());
  let modal = $state<'create' | 'delete' | 'bulk' | null>(null);
  let toDelete = $state<number | null>(null);
  let draft = $state(emptyDraft());
  let busy = $state(false);

  const load = () =>
    E.getPlaylistsFull()
      .then((p) => (playlists = p))
      .catch(() => (playlists = []));
  load();

  async function create() {
    busy = true;
    try {
      await E.createPlaylist(draftToForm(draft) as E.PlaylistForm);
      await load();
      toast.info(t('playlists.create_success'));
      modal = null;
    } catch (e) {
      toast.error(`${t('playlists.create_failed')}: ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  async function remove(ids: number[]) {
    busy = true;
    try {
      for (const id of ids) await E.deletePlaylist(id);
      await load();
      toast.info(t('playlists.delete_success'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      busy = false;
      modal = null;
      selected = new Set();
      selecting = false;
    }
  }

  function toggleSel(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }
</script>

<div class="main-container">
  <TopBar />
  <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
    <h1 class="text-2xl font-bold item_container-text">{t('playlists.smart_playlists')}</h1>
    <div class="flex flex-wrap gap-2">
      {#if selecting}
        <button
          class="item-container-button py-2 px-4 rounded flex items-center"
          onclick={() => {
            selecting = false;
            selected = new Set();
          }}><i class="ph ph-x text-xl mr-2"></i>{t('playlists.cancel')}</button
        >
        <button class="item-container-button py-2 px-4 rounded flex items-center" disabled={selected.size === 0} onclick={() => (modal = 'bulk')}>
          <i class="ph ph-trash text-xl mr-2"></i>{t('playlists.delete')} ({selected.size})
        </button>
      {:else}
        <button class="item-container-button py-2 px-4 rounded flex items-center" onclick={() => (selecting = true)}>
          <i class="ph ph-selection-plus text-xl mr-2"></i>{t('playlists.select')}
        </button>
        <button
          class="item-container-button py-2 px-4 rounded flex items-center"
          onclick={() => {
            draft = emptyDraft();
            modal = 'create';
          }}><i class="ph ph-plus text-xl mr-2"></i>{t('playlists.create_playlist')}</button
        >
      {/if}
    </div>
  </div>

  {#if playlists === null}
    <Loading />
  {:else if playlists.length === 0}
    <EmptyMessage header={t('playlists.no_playlists')} paragraph={t('playlists.create_new_playlist_to_start')} />
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each playlists as pl (pl.playlist_id)}
        <div class="playlist-card {selected.has(pl.playlist_id) ? 'playlist-card-selected' : ''} {pl.is_system_playlist ? 'system-playlist' : ''}">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="playlist-card-stack" onclick={() => (selecting ? toggleSel(pl.playlist_id) : goto(`/playlist/${pl.playlist_id}`))}>
            <div class="playlist-card-content">
              {#if selecting}
                <div class="absolute top-2 left-2 z-10" onclick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(pl.playlist_id)} onchange={() => toggleSel(pl.playlist_id)} class="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                </div>
              {/if}
              <i class="ph {pl.icon_name} playlist-icon"></i>
              <div class="playlist-info">
                <h3 class="playlist-title">
                  {pl.name}
                  {#if pl.is_system_playlist}<span class="text-xs ml-2 text-gray-400">{t('playlists.system')}</span>{/if}
                </h3>
                <span class="playlist-count">{pl.episode_count ?? 0} {t('playlists.episodes')}</span>
                {#if pl.description}<p class="playlist-description">{pl.description}</p>{/if}
              </div>
            </div>
          </div>
          {#if !selecting}
            <button
              onclick={(e) => {
                e.stopPropagation();
                toDelete = pl.playlist_id;
                modal = 'delete';
              }}
              class="delete-button absolute top-2 right-2 item-container-button selector-button rounded-full p-2"
              aria-label={t('playlists.delete_playlist')}><i class="ph ph-trash text-xl"></i></button
            >
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if modal === 'create'}
  <PlaylistFormModal bind:draft mode="create" saving={busy} onsubmit={create} onclose={() => (modal = null)} />
{:else if modal === 'delete' || modal === 'bulk'}
  {@const count = modal === 'bulk' ? selected.size : 1}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="modal-background fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick={() => (modal = null)}>
    <div class="modal-container relative rounded-lg shadow-lg max-w-md w-full mx-4" onclick={(e) => e.stopPropagation()}>
      <div class="item-container rounded-lg p-6">
        <h2 class="text-2xl font-bold mb-4 item_container-text">{modal === 'bulk' ? t('playlists.delete_playlists') : t('playlists.delete_playlist')}</h2>
        <p class="item_container-text mb-6">
          {modal === 'bulk'
            ? `${t('playlists.are_you_sure_delete')} ${count} ${t('playlists.selected')} ${count === 1 ? t('playlists.playlist') : t('playlists.playlists')}?`
            : t('playlists.delete_confirmation')}
        </p>
        <div class="flex justify-end space-x-4">
          <button class="item-container-button py-2 px-4 rounded" onclick={() => (modal = null)} disabled={busy}>{t('playlists.cancel')}</button>
          <button
            class="item-container-button py-2 px-4 rounded"
            disabled={busy}
            onclick={() => remove(modal === 'bulk' ? [...selected] : [toDelete!])}
          >
            {busy ? t('playlists.deleting') : t('playlists.delete')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
