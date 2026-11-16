<script lang="ts">
  // Port of upstream pages/downloads.rs: server downloads grouped by podcast, each
  // expandable with "load more", server-side search/filter, and select-to-delete.
  import * as E from '$lib/api/endpoints';
  import type { DownloadSummary, Episode } from '$lib/api/endpoints';
  import { episodeStatus, toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import FallbackImage from '$lib/components/FallbackImage.svelte';
  import EpisodeListItem from '$lib/components/EpisodeListItem.svelte';

  const PAGE = 50;
  interface PodState {
    episodes: Episode[];
    total: number;
    loadingMore: boolean;
  }

  let summaries = $state<DownloadSummary[] | null>(null);
  let expanded = $state(new Set<number>());
  let pods = $state<Record<number, PodState>>({});
  let search = $state('');
  let debounced = $state('');
  let completed = $state(false);
  let inProgress = $state(false);
  let selecting = $state(false);
  let selected = $state(new Set<number>());
  let confirming = $state(false);

  const filter = $derived(completed ? 'completed' : inProgress ? 'in_progress' : 'all');

  $effect(() => {
    const s = search;
    const timer = setTimeout(() => (debounced = s), 300);
    return () => clearTimeout(timer);
  });

  // Reload the podcast list (and any open podcasts) when search/filter change.
  $effect(() => {
    const s = debounced,
      f = filter;
    E.getDownloadSummary(s, f)
      .then((list) => {
        summaries = list;
        pods = {};
        for (const id of expanded) loadPodcast(id, true);
      })
      .catch(() => (summaries = []));
  });

  async function loadPodcast(id: number, reset = false) {
    const cur = pods[id];
    const offset = reset || !cur ? 0 : cur.episodes.length;
    pods[id] = { episodes: cur && !reset ? cur.episodes : [], total: cur?.total ?? 0, loadingMore: true };
    try {
      const p = await E.getPodcastDownloads(id, PAGE, offset, 'newest', filter, debounced);
      episodeStatus.absorb(p.episodes);
      pods[id] = { episodes: [...pods[id].episodes, ...p.episodes], total: p.total, loadingMore: false };
    } catch {
      pods[id] = { ...pods[id], loadingMore: false };
    }
  }

  function toggleExpanded(id: number) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      if (!pods[id]) loadPodcast(id);
    }
    expanded = next;
  }

  function toggleSel(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function togglePodcastSel(id: number, on: boolean) {
    const next = new Set(selected);
    for (const e of pods[id]?.episodes ?? []) {
      if (on) next.add(e.episodeid);
      else next.delete(e.episodeid);
    }
    selected = next;
  }

  async function deleteSelected() {
    confirming = false;
    const ids = [...selected];
    try {
      const r = await E.bulkDeleteDownloads(ids);
      toast.info(r.message);
      for (const id of ids) episodeStatus.set('downloaded', id, false);
      for (const key of Object.keys(pods)) {
        const p = pods[+key];
        const kept = p.episodes.filter((e) => !selected.has(e.episodeid));
        pods[+key] = { ...p, episodes: kept, total: p.total - (p.episodes.length - kept.length) };
      }
      summaries = (summaries ?? []).filter((s) => (pods[s.podcastid]?.total ?? Number(s.episode_count)) > 0);
      selected = new Set();
      selecting = false;
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // Removing a download from the context menu drops its card.
  $effect(() => {
    for (const key of Object.keys(pods)) {
      const p = pods[+key];
      if (p.episodes.some((e) => !episodeStatus.downloaded.has(e.episodeid))) {
        const kept = p.episodes.filter((e) => episodeStatus.downloaded.has(e.episodeid));
        pods[+key] = { ...p, episodes: kept, total: p.total - (p.episodes.length - kept.length) };
      }
    }
  });
</script>

<div class="main-container">
  <TopBar />
  {#if summaries === null}
    <Loading />
  {:else}
    <div>
      <div class="relative mb-6">
        <div class="flex gap-2 justify-end">
          {#if !selecting}
            <button class="sp-chip" onclick={() => (selecting = true)}><i class="ph ph-lasso"></i><span>{t('downloads.select')}</span></button>
          {:else}
            <button
              class="sp-chip"
              onclick={() => {
                selecting = false;
                selected = new Set();
              }}><i class="ph ph-prohibit"></i><span>{t('common.cancel')}</span></button
            >
            <button class="sp-chip is-alert" onclick={() => selected.size && (confirming = true)}>
              <i class="ph ph-trash"></i><span>{t('common.delete')}</span>
            </button>
          {/if}
        </div>
      </div>
      <div class="pfb-section">
        <div class="pfb-bar">
          <div class="sp-input">
            <i class="ph ph-download-simple sp-search-ico"></i>
            <input type="text" placeholder={t('downloads.search_downloaded_episodes')} bind:value={search} />
          </div>
        </div>
        <div class="sp-chips pfb-chips">
          <button
            class="sp-chip"
            onclick={() => {
              completed = inProgress = false;
              search = '';
            }}><i class="ph ph-broom"></i><span>{t('downloads.clear_all')}</span></button
          >
          <button
            class="sp-chip {completed ? 'is-active' : ''}"
            onclick={() => {
              completed = !completed;
              inProgress = false;
            }}><i class="ph ph-check-circle"></i><span>{t('downloads.completed')}</span></button
          >
          <button
            class="sp-chip {inProgress ? 'is-active' : ''}"
            onclick={() => {
              inProgress = !inProgress;
              completed = false;
            }}><i class="ph ph-hourglass-medium"></i><span>{t('downloads.in_progress')}</span></button
          >
        </div>
      </div>
    </div>

    {#if confirming}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-[calc(100%-1rem)] max-h-full bg-black bg-opacity-25" onclick={() => (confirming = false)}>
        <div class="modal-container relative p-4 w-full max-w-md max-h-full rounded-lg shadow" onclick={(e) => e.stopPropagation()}>
          <div class="modal-container relative rounded-lg shadow">
            <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
              <h3 class="text-xl font-semibold">{t('downloads.confirm_delete_title')}</h3>
            </div>
            <div class="p-4 md:p-5">
              <p class="mb-4 text-sm font-medium">{t('downloads.confirm_delete_message', { count: selected.size, plural: selected.size === 1 ? '' : 's' })}</p>
              <div class="flex justify-between space-x-4">
                <button onclick={deleteSelected} class="mt-4 download-button font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">{t('common.delete')}</button>
                <button onclick={() => (confirming = false)} class="mt-4 download-button font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if summaries.length === 0}
      <EmptyMessage header={t('downloads.no_episode_downloads_found')} paragraph={t('downloads.no_downloaded_episodes_description')} />
    {:else}
      {#each summaries as s (s.podcastid)}
        {@const p = pods[s.podcastid]}
        {@const open = expanded.has(s.podcastid)}
        {@const total = p?.total ?? Number(s.episode_count)}
        <div>
          <div class="podcast-dropdown-header">
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="podcast-dropdown-content" onclick={() => toggleExpanded(s.podcastid)}>
              {#if selecting}
                <div onclick={(e) => e.stopPropagation()}>
                  <input type="checkbox" class="podcast-dropdown-checkbox" onchange={(e) => togglePodcastSel(s.podcastid, e.currentTarget.checked)} />
                </div>
              {/if}
              <FallbackImage src={s.artworkurl ?? ''} alt="Cover for {s.podcastname}" class="podcast-dropdown-image" />
              <div class="podcast-dropdown-info">
                <p class="podcast-dropdown-title item_container-text">{s.podcastname}</p>
                <p class="podcast-dropdown-count item_container-text">{total} Downloaded Episodes</p>
              </div>
              <div class="podcast-dropdown-arrow {open ? 'expanded' : ''}"><i class="ph ph-caret-down text-2xl"></i></div>
            </div>
          </div>
          {#if open}
            <div class="podcast-episodes-container expanded">
              <div class="podcast-episodes-inner">
                {#each p?.episodes ?? [] as ep (ep.episodeid)}
                  <EpisodeListItem episode={ep} pageType="downloads" selectMode={selecting} selected={selected.has(ep.episodeid)} onselect={toggleSel} />
                {/each}
                {#if p?.loadingMore}
                  <div class="flex justify-center py-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div></div>
                {:else if p && p.episodes.length < p.total}
                  <div class="flex justify-center py-4">
                    <button class="sp-chip" onclick={() => loadPodcast(s.podcastid)}><i class="ph ph-arrow-down"></i><span>{t('downloads.load_more')}</span></button>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  {/if}
</div>
