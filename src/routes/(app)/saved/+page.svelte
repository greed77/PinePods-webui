<script lang="ts">
  // Port of upstream pages/saved.rs: collection tabs (Saved is the pinned default),
  // create/edit/delete collections with auto-add categories, and the episode list.
  import * as E from '$lib/api/endpoints';
  import type { Collection, Episode } from '$lib/api/endpoints';
  import { episodeStatus, toast } from '$lib/stores/app.svelte';
  import { favorites } from '$lib/stores/favorites.svelte';
  import { collectionPicker } from '$lib/stores/collectionPicker.svelte';
  import { getPref, setPref } from '$lib/util/prefs';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import PagedEpisodes from '$lib/components/PagedEpisodes.svelte';
  import SortSelect from '$lib/components/SortSelect.svelte';
  import IconSelector from '$lib/components/IconSelector.svelte';

  favorites.ensure();

  let collections = $state<Collection[] | null>(null);
  let active = $state<Collection | null>(null);
  let categories = $state<string[]>([]);
  let sort = $state(getPref('saved', 'newest'));
  let filter = $state(getPref('saved_filter', 'all'));
  let search = $state('');
  let episodes = $state<Episode[]>([]);
  let reload = $state(0);

  // Collection form (new / edit)
  let modal = $state<'new' | 'edit' | null>(null);
  let form = $state({ name: '', description: '', icon: 'ph-bookmark-simple', categories: [] as string[], backfill: false });
  let saving = $state(false);

  async function loadCollections(selectId?: number) {
    const cols = await E.getCollections();
    collections = cols;
    active = cols.find((c) => c.collection_id === selectId) ?? cols.find((c) => c.is_default) ?? cols[0] ?? null;
  }
  loadCollections().catch(() => (collections = []));
  E.getCollectionCategories()
    .then((c) => (categories = c))
    .catch(() => {});

  // Drop a card when the picker removes it from the collection on screen.
  $effect(() => {
    const r = collectionPicker.lastRemoved;
    if (r && r.collectionId === active?.collection_id) episodes = episodes.filter((e) => e.episodeid !== r.episodeId);
  });

  // On the Saved tab, unsaving an episode (context menu) removes its card.
  $effect(() => {
    if (active?.is_default && episodes.some((e) => !episodeStatus.saved.has(e.episodeid)))
      episodes = episodes.filter((e) => episodeStatus.saved.has(e.episodeid));
  });

  function setFilter(next: string) {
    filter = filter === next ? 'all' : next;
    setPref('saved_filter', filter);
  }

  function openNew() {
    form = { name: '', description: '', icon: 'ph-bookmark-simple', categories: [], backfill: false };
    modal = 'new';
  }
  function openEdit() {
    if (!active) return;
    form = { name: active.name, description: active.description ?? '', icon: active.icon, categories: [...(active.auto_add_categories ?? [])], backfill: false };
    modal = 'edit';
  }
  function toggleCategory(c: string) {
    form.categories = form.categories.includes(c) ? form.categories.filter((x) => x !== c) : [...form.categories, c];
  }

  async function submit() {
    const name = form.name.trim();
    if (!name) return toast.error('Collection name is required');
    const body = {
      name,
      description: form.description.trim() || null,
      icon: form.icon,
      auto_add_categories: form.categories,
      backfill: form.backfill && form.categories.length > 0
    };
    saving = true;
    try {
      if (modal === 'new') {
        const r = await E.createCollection(body);
        await loadCollections(r.collection_id);
        toast.info('Collection created');
      } else if (active) {
        const id = active.collection_id;
        await E.updateCollection(id, { ...body, description: body.description ?? '' });
        await loadCollections(id);
        reload++;
        toast.info('Collection updated');
      }
      modal = null;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!active) return;
    try {
      await E.deleteCollection(active.collection_id);
      await loadCollections();
      modal = null;
      toast.info('Collection deleted');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const load = (offset: number) =>
    !active || active.is_default ? E.getSavedEpisodes(50, offset, sort, filter) : E.getCollectionEpisodes(active.collection_id, 50, offset, sort, filter);

  const matches = (e: Episode) => {
    const q = search.toLowerCase();
    return favorites.allows(e.podcastid) && (!q || e.episodetitle.toLowerCase().includes(q) || e.episodedescription.toLowerCase().includes(q));
  };
</script>

<div class="main-container">
  <TopBar />
  {#if collections === null}
    <Loading />
  {:else}
    <div class="pfb-section">
      <div class="sp-chips pfb-chips collections-tabs">
        {#each collections as c (c.collection_id)}
          <button class="sp-chip {c.collection_id === active?.collection_id ? 'is-active' : ''}" onclick={() => (active = c)}>
            <i class="ph {c.icon}"></i><span>{c.name}</span>
          </button>
        {/each}
        <button class="sp-chip" onclick={openNew} title={t('collections.new_collection')} aria-label={t('collections.new_collection')}>
          <i class="ph ph-plus"></i>
        </button>
      </div>
      <div class="pfb-bar">
        <div class="sp-input">
          <i class="ph {active?.icon ?? 'ph-bookmark'} sp-search-ico"></i>
          <input type="text" placeholder={t('collections.search_placeholder', { name: active?.name ?? 'Saved' })} bind:value={search} />
        </div>
        <SortSelect bind:value={sort} ns="saved" onchange={(v) => setPref('saved', v)} />
      </div>
      <div class="sp-chips pfb-chips">
        {#if active && !active.is_default}
          <button class="sp-chip" onclick={openEdit} title={t('collections.edit_collection')}>
            <i class="ph ph-pencil-simple"></i><span>{t('collections.edit_collection')}</span>
          </button>
        {/if}
        <button
          class="sp-chip"
          onclick={() => {
            filter = 'all';
            setPref('saved_filter', 'all');
          }}><i class="ph ph-broom"></i><span>{t('saved.clear_all')}</span></button
        >
        <button class="sp-chip {filter === 'completed' ? 'is-active' : ''}" onclick={() => setFilter('completed')}>
          <i class="ph ph-check-circle"></i><span>{t('saved.completed')}</span>
        </button>
        <button class="sp-chip {filter === 'in_progress' ? 'is-active' : ''}" onclick={() => setFilter('in_progress')}>
          <i class="ph ph-hourglass-medium"></i><span>{t('saved.in_progress')}</span>
        </button>
      </div>
    </div>

    <PagedEpisodes
      bind:episodes
      {load}
      key={`${active?.collection_id}|${sort}|${filter}|${reload}`}
      filter={matches}
      pageType="saved"
      emptyHeader={active && !active.is_default ? t('collections.empty_title') : t('saved.no_saved_episodes')}
      emptyText={active && !active.is_default ? t('collections.empty_instructions') : t('saved.save_episodes_instructions')}
    />
  {/if}
</div>

{#if modal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-25" onclick={() => (modal = null)}>
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="modal-container relative w-full max-w-md rounded-lg shadow" onclick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
          <h3 class="text-xl font-semibold">{modal === 'new' ? t('collections.new_collection') : t('collections.edit_collection')}</h3>
          <button onclick={() => (modal = null)} class="text-gray-400 bg-transparent rounded-lg text-sm w-8 h-8 inline-flex justify-center items-center" aria-label="Close">
            <i class="ph ph-x text-xl"></i>
          </button>
        </div>
        <div class="p-4 md:p-5">
          <div class="space-y-4">
            <div>
              <label class="block mb-2 text-sm font-medium" for="col-name">{t('collections.collection_name')}</label>
              <input id="col-name" type="text" class="search-bar-input border text-sm rounded-lg block w-full p-2.5" placeholder={t('collections.collection_name')} bind:value={form.name} />
            </div>
            <div>
              <span class="block mb-2 text-sm font-medium">{t('collections.icon')}</span>
              <IconSelector value={form.icon} onselect={(i) => (form.icon = i)} />
            </div>
            <div>
              <label class="block mb-2 text-sm font-medium" for="col-desc">{t('collections.description')}</label>
              <textarea id="col-desc" class="search-bar-input border text-sm rounded-lg block w-full p-2.5" bind:value={form.description}></textarea>
            </div>
            <div>
              <span class="block mb-1 text-sm font-medium">{t('collections.auto_add_categories')}</span>
              <p class="text-xs opacity-70 mb-2">{t('collections.auto_add_help')}</p>
              {#if categories.length === 0}
                <p class="text-xs opacity-70">{t('collections.no_categories')}</p>
              {:else}
                <div class="sp-chips" style="justify-content: flex-start; margin: 0;">
                  {#each categories as c}
                    <button type="button" class="sp-chip {form.categories.includes(c) ? 'is-active' : ''}" onclick={() => toggleCategory(c)}><span>{c}</span></button>
                  {/each}
                </div>
              {/if}
              {#if form.categories.length}
                <label class="flex items-center gap-2 mt-3 text-sm cursor-pointer">
                  <input type="checkbox" bind:checked={form.backfill} />
                  <span>{t('collections.backfill_existing')}</span>
                </label>
              {/if}
            </div>
            <div class="flex items-center justify-between gap-2 pt-2">
              {#if modal === 'edit'}
                <button onclick={remove} class="text-sm font-medium text-red-500 hover:underline">{t('collections.delete_collection')}</button>
              {:else}
                <span></span>
              {/if}
              <button onclick={submit} disabled={saving} class="download-button">
                {saving ? t('collections.saving') : modal === 'edit' ? t('collections.save') : t('collections.create')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
