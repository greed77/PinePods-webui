<script lang="ts">
  // Port of upstream pages/episode_layout.rs for a subscribed podcast: banner header
  // (or compact mobile header), server-side search/sort/filter with paging, select
  // mode with bulk actions, download-all, unsubscribe, hosts, and the per-podcast
  // settings and edit/merge windows, the RSS feed link and funding links.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import * as E from '$lib/api/endpoints';
  import type { Episode, PodcastDetails } from '$lib/api/endpoints';
  import { episodeStatus, toast, ui } from '$lib/stores/app.svelte';
  import { getPref, setPref } from '$lib/util/prefs';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import PodcastHeader from '$lib/components/PodcastHeader.svelte';
  import EpisodeListItem from '$lib/components/EpisodeListItem.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import PodcastSettingsModal from '$lib/components/podcast/PodcastSettingsModal.svelte';
  import PodcastEditModal from '$lib/components/podcast/PodcastEditModal.svelte';
  import RssFeedModal from '$lib/components/podcast/RssFeedModal.svelte';

  const PAGE = 50;
  const id = $derived(Number(page.params.id));

  let details = $state<PodcastDetails | null>(null);
  let people = $state<{ people: E.CreditedPerson[]; guests: E.CreditedPerson[] } | null>(null);
  let loading = $state(true);
  let episodes = $state<Episode[]>([]);
  let total = $state(0);
  let loadingMore = $state(false);
  let subscribed = $state(true);
  let busy = $state(false);
  let modal = $state<'delete' | 'download' | 'settings' | 'edit' | 'rss' | null>(null);
  let funding = $state<E.FundingLink[]>([]);

  // Filters, remembered per podcast like upstream (`podcast_{id}_sort_preference`).
  let sort = $state('newest');
  let completedFilter = $state<'show_all' | 'show_only' | 'hide'>('show_all');
  let inProgress = $state(false);
  let search = $state('');
  let debounced = $state('');
  let selecting = $state(false);
  let selected = $state(new Set<number>());

  // Load details whenever the podcast changes.
  $effect(() => {
    const pid = id;
    loading = true;
    details = null;
    sort = getPref(`podcast_${pid}`, 'newest');
    completedFilter = getPref(`podcast_${pid}_completed_filter`, 'show_all') as typeof completedFilter;
    inProgress = false;
    search = debounced = '';
    selecting = false;
    selected = new Set();
    people = null;
    funding = [];
    // Podcasting 2.0 funding links; most feeds have none.
    E.getPodcastFunding(pid)
      .then((f) => pid === id && (funding = f))
      .catch((e) => console.warn('Error loading funding links', e));
    E.getPodcastDetails(pid)
      .then((d) => {
        details = d;
        // Hosts and guests; YouTube channels have none.
        if (!d.isyoutubechannel)
          E.getPodcastPeople(pid)
            .then((p) => pid === id && (people = p))
            .catch(() => {});
      })
      .catch((e) => toast.error(`Error: ${(e as Error).message}`))
      .finally(() => (loading = false));
  });

  $effect(() => {
    const s = search;
    const timer = setTimeout(() => (debounced = s), 300);
    return () => clearTimeout(timer);
  });

  const filterParam = () =>
    inProgress ? 'in_progress' : completedFilter === 'show_only' ? 'completed' : completedFilter === 'hide' ? 'incomplete' : 'all';

  async function fetchPage(offset: number) {
    return E.getPodcastEpisodes(id, { limit: PAGE, offset, ...E.sortParams(sort), search: debounced, filter: filterParam() });
  }

  // Reload the list when the podcast or any filter changes, or after a feed refresh.
  $effect(() => {
    id;
    sort;
    completedFilter;
    inProgress;
    debounced;
    ui.feedVersion;
    let stale = false;
    fetchPage(0)
      .then((r) => {
        if (stale) return;
        episodes = r.episodes;
        total = r.total;
        episodeStatus.absorb(r.episodes);
      })
      .catch((e) => console.warn('Error loading podcast episodes', e));
    return () => (stale = true);
  });

  async function loadMore() {
    if (loadingMore || episodes.length >= total) return;
    loadingMore = true;
    try {
      const r = await fetchPage(episodes.length);
      episodes = [...episodes, ...r.episodes];
      total = r.total;
      episodeStatus.absorb(r.episodes);
    } finally {
      loadingMore = false;
    }
  }

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  let sentinel: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '600px' });
    io.observe(sentinel);
    return () => io.disconnect();
  });

  const isVideo = $derived(episodes.some((e) => e.is_video));
  const isYoutube = $derived(!!details?.isyoutubechannel);

  const completedUi = $derived(
    completedFilter === 'show_only'
      ? { icon: 'ph-check-circle', text: t('episodes_layout.show_only'), title: t('episodes_layout.showing_only_completed'), cls: 'is-active' }
      : completedFilter === 'hide'
        ? { icon: 'ph-x-circle', text: t('episodes_layout.hide'), title: t('episodes_layout.hiding_completed'), cls: 'is-alert' }
        : { icon: 'ph-circle', text: t('episodes_layout.all'), title: t('episodes_layout.showing_all_episodes'), cls: '' }
  );

  function cycleCompleted() {
    completedFilter = completedFilter === 'show_all' ? 'show_only' : completedFilter === 'show_only' ? 'hide' : 'show_all';
    setPref(`podcast_${id}_completed_filter`, completedFilter);
  }

  function clearFilters() {
    completedFilter = 'show_all';
    inProgress = false;
    search = '';
    setPref(`podcast_${id}_completed_filter`, 'show_all');
  }

  // ---- selection ----
  const toggleSel = (eid: number) => {
    const next = new Set(selected);
    if (next.has(eid)) next.delete(eid);
    else next.add(eid);
    selected = next;
  };
  const selectRange = (eid: number, newer: boolean) => {
    const i = episodes.findIndex((e) => e.episodeid === eid);
    const range = newer ? episodes.slice(0, i + 1) : episodes.slice(i);
    selected = new Set([...selected, ...range.map((e) => e.episodeid)]);
  };
  const allSelected = $derived(episodes.length > 0 && episodes.every((e) => selected.has(e.episodeid)));

  async function bulk(path: Parameters<typeof E.bulkAction>[0], after?: (ids: number[]) => void) {
    const ids = episodes.map((e) => e.episodeid).filter((x) => selected.has(x));
    try {
      const r = await E.bulkAction(path, ids);
      toast.info(r.message);
      after?.(ids);
      selected = new Set();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  }

  // ---- header actions ----
  async function toggleSubscription() {
    if (subscribed) modal = 'delete';
    else if (details) {
      busy = true;
      try {
        const r = await E.addPodcast(details);
        subscribed = true;
        if (r.podcast_id && r.podcast_id !== id) goto(`/podcast/${r.podcast_id}`, { replaceState: true });
        toast.info(t('podcasts.podcast_successfully_added'));
      } catch (e) {
        toast.error(`${t('podcasts.failed_to_add_podcast')}: ${(e as Error).message}`);
      } finally {
        busy = false;
      }
    }
  }

  async function unsubscribe() {
    try {
      const { success } = await E.removePodcast(id);
      if (success) {
        subscribed = false;
        toast.info(t('podcasts.podcast_removed'));
      } else toast.error(t('podcasts.podcast_remove_failed'));
    } catch (e) {
      toast.error(`${t('podcasts.error_removing_content')}${(e as Error).message}`);
    }
  }

  // After an edit in the settings windows: fetch the details again without the
  // loading screen or resetting the episode filters.
  async function reloadDetails() {
    const pid = id;
    try {
      const d = await E.getPodcastDetails(pid);
      if (pid === id) details = d;
    } catch (e) {
      console.warn('Error reloading podcast details', e);
    }
  }

  async function downloadAll() {
    try {
      const r: any = await E.downloadAllPodcast(id, isYoutube);
      toast.info(r?.detail ?? r?.message ?? 'Downloads queued');
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  }

</script>

<div class="main-container">
  <TopBar />

  {#if modal === 'delete'}
    <ConfirmModal
      title={t('podcasts.delete_podcast')}
      text={t('episodes_layout.delete_podcast_confirmation')}
      yes={t('episodes_layout.yes_delete_podcast')}
      no={t('episodes_layout.no_take_me_back')}
      onyes={unsubscribe}
      onclose={() => (modal = null)}
    />
  {:else if modal === 'download'}
    <ConfirmModal
      title={t('episodes_layout.download_all_title')}
      text={t('episodes_layout.download_all_confirmation')}
      yes={t('episodes_layout.yes_download_all')}
      no={t('episodes_layout.no_take_me_back')}
      onyes={downloadAll}
      onclose={() => (modal = null)}
    />
  {:else if modal === 'settings' && details}
    <PodcastSettingsModal podcast={details} onclose={() => (modal = null)} onedit={() => (modal = 'edit')} onchanged={reloadDetails} />
  {:else if modal === 'edit' && details}
    <PodcastEditModal podcast={details} onclose={() => (modal = null)} onchanged={reloadDetails} />
  {:else if modal === 'rss'}
    <RssFeedModal podcastId={id} onclose={() => (modal = null)} />
  {/if}

  {#if loading}
    <Loading />
  {:else if details}
    <PodcastHeader podcast={details} {subscribed} {busy} {isVideo} ontoggle={toggleSubscription} ondownload={() => (modal = 'download')}
      onsettings={() => (modal = 'settings')}
      onrss={() => (modal = 'rss')}
      {funding}
      {people}
    />

    <div class="pfb-section">
      <div class="pfb-bar">
        <div class="sp-input">
          <i class="ph ph-headphones sp-search-ico"></i>
          <input type="text" placeholder={t('episodes_layout.search_episodes_placeholder')} bind:value={search} />
        </div>
        <div class="pfb-sort">
          <i class="ph ph-funnel pfb-sort-icon-mobile"></i>
          <select class="pfb-sort-select" bind:value={sort} onchange={() => setPref(`podcast_${id}`, sort)}>
            <option value="newest">{t('episodes_layout.newest_first')}</option>
            <option value="oldest">{t('episodes_layout.oldest_first')}</option>
            <option value="shortest">{t('episodes_layout.shortest_first')}</option>
            <option value="longest">{t('episodes_layout.longest_first')}</option>
            <option value="title_az">{t('episodes_layout.title_az')}</option>
            <option value="title_za">{t('episodes_layout.title_za')}</option>
          </select>
          <i class="ph ph-caret-down pfb-sort-arrow"></i>
        </div>
      </div>
      <div class="sp-chips pfb-chips">
        <button onclick={clearFilters} class="sp-chip"><i class="ph ph-broom"></i><span>{t('episodes_layout.clear_all')}</span></button>
        <button onclick={cycleCompleted} title={completedUi.title} class="sp-chip {completedUi.cls}">
          <i class="ph {completedUi.icon}"></i><span>{completedUi.text}</span>
        </button>
        <button onclick={() => (inProgress = !inProgress)} class="sp-chip {inProgress ? 'is-active' : ''}">
          <i class="ph ph-hourglass-medium"></i><span>{t('episodes_layout.in_progress')}</span>
        </button>
        <button
          onclick={() => {
            if (selecting) selected = new Set();
            selecting = !selecting;
          }}
          class="sp-chip {selecting ? 'is-active' : ''}"
        >
          <i class="ph ph-check-square"></i><span>{selecting ? t('episodes_layout.exit_select') : t('episodes_layout.select')}</span>
        </button>
      </div>

      {#if selecting}
        <div class="flex gap-2 mt-4 flex-wrap">
          <button onclick={() => (selected = allSelected ? new Set() : new Set(episodes.map((e) => e.episodeid)))} class="bulk-select-button">
            {allSelected ? t('episodes_layout.deselect_all') : t('episodes_layout.select_all')}
          </button>
          <button onclick={() => (selected = new Set(episodes.filter((e) => !e.completed).map((e) => e.episodeid)))} class="bulk-filter-button">
            {t('episodes_layout.select_unplayed')}
          </button>
          <button
            onclick={() => (selected = new Set(episodes.filter((e) => !e.completed && e.listenduration > 0).map((e) => e.episodeid)))}
            class="bulk-filter-button"
          >
            {t('episodes_layout.select_in_progress')}
          </button>
        </div>
      {/if}
    </div>

    {#if selecting && selected.size > 0}
      <div class="bulk-actions-bar">
        <div class="bulk-actions-bar__count">
          <i class="ph ph-check-circle"></i>{selected.size} episode{selected.size === 1 ? '' : 's'} selected
        </div>
        <div class="bulk-actions-bar__actions">
          <button
            onclick={() => bulk('/api/data/bulk_mark_episodes_completed', (ids) => ids.forEach((x) => episodeStatus.set('completed', x, true)))}
            class="btn btn-secondary"
          >
            <i class="ph ph-check-circle"></i>{t('episodes_layout.mark_complete')}
          </button>
          <button onclick={() => bulk('/api/data/bulk_save_episodes', (ids) => ids.forEach((x) => episodeStatus.set('saved', x, true)))} class="btn btn-secondary">
            <i class="ph ph-star"></i>{t('episodes_layout.save')}
          </button>
          <button
            onclick={() =>
              bulk('/api/data/bulk_queue_episodes', (ids) => {
                ids.forEach((x) => episodeStatus.set('queued', x, true));
                ui.queueVersion++;
              })}
            class="btn btn-secondary"
          >
            <i class="ph ph-list-plus"></i>{t('episodes_layout.queue_episodes')}
          </button>
          <button onclick={() => bulk('/api/data/bulk_download_episodes')} class="btn btn-secondary">
            <i class="ph ph-download-simple"></i>{t('episodes_layout.download_episodes')}
          </button>
        </div>
      </div>
    {/if}

    {#if episodes.length}
      <div class="flex-grow overflow-y-auto">
        {#each episodes as ep (ep.episodeid)}
          <EpisodeListItem
            episode={ep}
            selectMode={selecting}
            selected={selected.has(ep.episodeid)}
            onselect={toggleSel}
            onselectabove={(x) => selectRange(x, true)}
            onselectbelow={(x) => selectRange(x, false)}
          />
        {/each}
        <div bind:this={sentinel}></div>
        {#if loadingMore}
          <div class="flex justify-center py-6"><div class="spinner"></div></div>
        {/if}
      </div>
    {:else}
      <div class="empty-episodes-container" id="episode-container">
        <img src="/static/assets/favicon.png" alt="Logo" class="logo" />
        <h1 class="page-subtitles">{t('episodes_layout.no_episodes_found')}</h1>
        <p class="page-paragraphs">{t('episodes_layout.no_episodes_description')}</p>
      </div>
    {/if}
  {/if}
</div>
