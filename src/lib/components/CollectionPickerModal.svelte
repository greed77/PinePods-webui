<script lang="ts">
  // Port of upstream components/collection_picker_modal.rs.
  import * as E from '$lib/api/endpoints';
  import type { Collection } from '$lib/api/endpoints';
  import { collectionPicker as cp } from '$lib/stores/collectionPicker.svelte';
  import { episodeStatus, toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let collections = $state<Collection[]>([]);
  let members = $state(new Set<number>());
  let loading = $state(true);
  let search = $state('');
  let showNew = $state(false);
  let newName = $state('');
  let removedN = 0;

  const isBulk = $derived(cp.bulk.length > 0);

  $effect(() => {
    if (!cp.open) return;
    loading = true;
    search = '';
    showNew = false;
    newName = '';
    const ep = cp.episode;
    Promise.all([E.getCollections(), ep ? E.getEpisodeCollections(ep) : Promise.resolve([])])
      .then(([cols, ids]) => {
        collections = cols;
        members = new Set(ids);
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => (loading = false));
  });

  const filtered = $derived(collections.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())));

  async function toggle(c: Collection) {
    try {
      if (isBulk) {
        await E.bulkAddToCollection(c.collection_id, cp.bulk);
        toast.info(t('collections.bulk_added', { count: cp.bulk.length, name: c.name }));
        cp.close();
        return;
      }
      const ep = cp.episode!;
      if (members.has(c.collection_id)) {
        await E.removeFromCollection(c.collection_id, ep);
        members.delete(c.collection_id);
        members = new Set(members);
        if (c.is_default) episodeStatus.set('saved', ep.episodeid, false);
        cp.lastRemoved = { episodeId: ep.episodeid, collectionId: c.collection_id, n: ++removedN };
      } else {
        await E.addToCollection(c.collection_id, ep);
        members = new Set([...members, c.collection_id]);
        if (c.is_default) episodeStatus.set('saved', ep.episodeid, true);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function createNew() {
    const name = newName.trim();
    if (!name) return;
    try {
      const r = await E.createCollection({ name, icon: 'ph-bookmark-simple' });
      collections = await E.getCollections();
      showNew = false;
      newName = '';
      const created = collections.find((c) => c.collection_id === r.collection_id);
      if (created) await toggle(created);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
</script>

{#if cp.open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
  <div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-25" onclick={() => cp.close()}>
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="modal-container relative w-full max-w-md rounded-lg shadow" onclick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
          <h3 class="text-xl font-semibold">
            {isBulk ? t('collections.add_episodes_count', { count: cp.bulk.length }) : t('collections.add_to_collection')}
          </h3>
          <button onclick={() => cp.close()} class="text-gray-400 bg-transparent rounded-lg text-sm w-8 h-8 inline-flex justify-center items-center" aria-label="Close">
            <i class="ph ph-x text-xl"></i>
          </button>
        </div>
        <div class="p-4 md:p-5">
          {#if loading}
            <div class="flex justify-center p-4"><i class="ph ph-spinner text-2xl"></i></div>
          {:else}
            <div class="sp-input mb-3">
              <i class="ph ph-magnifying-glass sp-search-ico"></i>
              <input type="text" placeholder={t('collections.search_collections')} bind:value={search} />
            </div>
            <ul class="max-h-64 overflow-y-auto mb-2">
              {#each filtered as c (c.collection_id)}
                <li class="dropdown-option flex items-center gap-2" onclick={() => toggle(c)}>
                  {#if !isBulk}<i class="ph {members.has(c.collection_id) ? 'ph-check-square' : 'ph-square'} text-xl"></i>{/if}
                  <i class="ph {c.icon}"></i>
                  <span>{c.name}</span>
                  {#if c.is_default}<span class="text-secondary text-sm"> ({t('collections.default')})</span>{/if}
                </li>
              {/each}
            </ul>
            {#if showNew}
              <div class="flex items-center gap-2">
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  type="text"
                  class="search-bar-input border text-sm rounded-lg block w-full p-2.5"
                  placeholder={t('collections.collection_name')}
                  bind:value={newName}
                  autofocus
                  onkeydown={(e) => e.key === 'Enter' && createNew()}
                />
                <button onclick={createNew} class="download-button">{t('collections.create')}</button>
              </div>
            {:else}
              <button class="dropdown-option flex items-center gap-2 w-full" onclick={() => (showNew = true)}>
                <i class="ph ph-plus"></i><span>{t('collections.new_collection')}</span>
              </button>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
