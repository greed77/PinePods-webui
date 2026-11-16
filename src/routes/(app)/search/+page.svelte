<script lang="ts">
  // Port of upstream pages/search.rs: search across your library's episodes, with
  // recent searches, a most-played shelf, category browsing, filter chips and
  // select mode with bulk actions. (Transcript search needs a newer server.)
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as E from '$lib/api/endpoints';
  import type { Episode, Podcast } from '$lib/api/endpoints';
  import { episodeStatus, toast, ui } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import FallbackImage from '$lib/components/FallbackImage.svelte';
  import EpisodeListItem from '$lib/components/EpisodeListItem.svelte';

  const PAGE = 50;
  const RECENTS_KEY = 'pp_search_recents';
  type Chip = 'all' | 'unplayed' | 'in_progress' | 'saved' | 'downloaded';
  const chips: [Chip, string, string | null][] = [
    ['all', 'search.filter_all', null],
    ['unplayed', 'search.filter_unplayed', 'ph ph-circle'],
    ['in_progress', 'search.filter_in_progress', 'ph ph-hourglass-medium'],
    ['saved', 'search.filter_saved', 'ph ph-star'],
    ['downloaded', 'search.filter_downloaded', 'ph ph-download-simple']
  ];

  let query = $state('');
  let currentTerm = $state('');
  let cats = $state<string[]>([]);
  let chip = $state<Chip>('all');
  let episodes = $state<Episode[]>([]);
  let total = $state(0);
  let searching = $state(false);
  let loadingMore = $state(false);
  let recents = $state<string[]>([]);
  let mostPlayed = $state<Podcast[]>([]);
  let categories = $state<string[]>([]);
  let isMobile = $state(false);
  let focused = $state(false);
  let selecting = $state(false);
  let selected = $state(new Set<number>());
  let input: HTMLInputElement;
  let gen = 0;

  const collapsed = $derived(!!query || cats.length > 0);

  onMount(() => {
    try {
      recents = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
    } catch {
      recents = [];
    }
    E.getPodcasts()
      .then((pods) => (categories = [...new Set(pods.flatMap((p) => Object.values(p.categories ?? {}).map((c) => c.trim())).filter(Boolean))].sort()))
      .catch(() => {});
    E.getHomeOverview()
      .then((o) => (mostPlayed = o.top_podcasts))
      .catch(() => {});
    const check = () => (isMobile = innerWidth <= 500);
    check();
    addEventListener('resize', check);
    // "/" focuses the search box.
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !/^(input|textarea|select)$/i.test(el.tagName)) {
        e.preventDefault();
        input.focus();
      }
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('resize', check);
      removeEventListener('keydown', onKey);
    };
  });

  function saveRecents(list: string[]) {
    recents = list;
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  async function fire(term: string) {
    const g = ++gen;
    currentTerm = term;
    searching = true;
    selected = new Set();
    try {
      const p = await E.searchLibrary(term, cats, PAGE, 0, chip);
      if (g !== gen) return;
      episodes = p.episodes;
      total = p.total;
      episodeStatus.absorb(p.episodes);
    } catch (e) {
      console.warn('Search error', e);
    } finally {
      if (g === gen) searching = false;
    }
  }

  function commit(term: string) {
    const tm = term.trim();
    if (!tm && cats.length === 0) return;
    query = tm;
    if (tm) saveRecents([tm, ...recents.filter((r) => r !== tm)].slice(0, 6));
    fire(tm);
  }

  let debounce: ReturnType<typeof setTimeout> | undefined;
  function onInput() {
    clearTimeout(debounce);
    const tm = query.trim();
    if (!tm) {
      if (cats.length) fire('');
      else {
        episodes = [];
        total = 0;
        currentTerm = '';
      }
      return;
    }
    debounce = setTimeout(() => tm !== currentTerm && query.trim() === tm && commit(tm), 400);
  }

  function clearAll() {
    query = currentTerm = '';
    episodes = [];
    total = 0;
    chip = 'all';
    cats = [];
    selecting = false;
    selected = new Set();
    input.focus();
  }

  function toggleCat(c: string) {
    cats = cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c];
    if (query.trim() || cats.length) fire(query.trim());
    else clearAll();
  }

  function setChip(c: Chip) {
    chip = c;
    if (query.trim() || cats.length) fire(query.trim());
  }

  async function more() {
    if (searching || loadingMore || episodes.length >= total) return;
    loadingMore = true;
    const g = gen;
    try {
      const p = await E.searchLibrary(currentTerm, cats, PAGE, episodes.length, chip);
      if (g !== gen) return;
      episodes = [...episodes, ...p.episodes];
      episodeStatus.absorb(p.episodes);
    } finally {
      loadingMore = false;
    }
  }

  let sentinel: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver((en) => en[0].isIntersecting && more(), { rootMargin: '600px' });
    io.observe(sentinel);
    return () => io.disconnect();
  });

  // ---- selection ----
  const ids = $derived(episodes.map((e) => e.episodeid));
  const allSelected = $derived(ids.length > 0 && ids.every((i) => selected.has(i)));
  const toggleSel = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  };
  const range = (id: number, above: boolean) => {
    const i = ids.indexOf(id);
    selected = new Set([...selected, ...(above ? ids.slice(0, i + 1) : ids.slice(i))]);
  };

  async function bulk(path: Parameters<typeof E.bulkAction>[0], after?: (ids: number[]) => void) {
    const chosen = ids.filter((i) => selected.has(i));
    try {
      const r = await E.bulkAction(path, chosen);
      toast.info(r.message);
      after?.(chosen);
      selected = new Set();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  }
</script>

<div class="search-page-container">
  <TopBar />

  <div class="sp-head {collapsed ? 'is-collapsed' : ''}">
    <div class="sp-head-titles">
      <h1 class="sp-title">{t('search.title')}</h1>
      <p class="sp-subtitle">{t('search.subtitle')}</p>
    </div>
    <div class="sp-input-row">
      <div class="sp-input {focused ? 'is-focused' : ''}">
        <i class="ph ph-magnifying-glass sp-search-ico"></i>
        <input
          bind:this={input}
          type="text"
          placeholder={isMobile ? t('search.mobile_placeholder') : t('search.desktop_placeholder')}
          bind:value={query}
          oninput={onInput}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              clearTimeout(debounce);
              commit(query);
            }
          }}
          onfocus={() => (focused = true)}
          onblur={() => (focused = false)}
        />
        {#if query || cats.length}
          <button class="sp-clear" onclick={clearAll} aria-label="Clear"><i class="ph ph-x"></i></button>
        {:else if !isMobile}
          <span class="sp-kbd">/</span>
        {/if}
      </div>
    </div>
    <div class="sp-chips">
      {#each chips as [c, key, icon]}
        <button class="sp-chip {chip === c ? 'is-active' : ''}" onclick={() => setChip(c)}>
          {#if icon}<i class={icon}></i>{/if}
          <span>{t(key)}</span>
          {#if chip === c}<span class="sp-chip-count">{total}</span>{/if}
        </button>
      {/each}
      {#if collapsed && episodes.length}
        <span class="sp-chip-sep" aria-hidden="true"></span>
        <button
          class="sp-chip {selecting ? 'is-active' : ''}"
          onclick={() => {
            selecting = !selecting;
            selected = new Set();
          }}
        >
          <i class={selecting ? 'ph ph-x-square' : 'ph ph-check-square'}></i>
          <span>{selecting ? t('search.exit_select') : t('search.select')}</span>
        </button>
      {/if}
    </div>
    {#if cats.length}
      <div class="sp-chips sp-active-cats">
        {#each cats as c (c)}
          <button class="sp-chip is-active" onclick={() => toggleCat(c)}>
            <i class="ph ph-tag"></i><span>{c}</span><i class="ph ph-x" style="font-size:11px; opacity:.7;"></i>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="sp-body">
    {#if !collapsed}
      {#if recents.length}
        <div class="sp-sec-head">
          <h3>{t('search.recent_searches')}</h3>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
          <a onclick={() => saveRecents([])}>{t('search.clear_all')}</a>
        </div>
        <div class="sp-recent">
          {#each recents as r (r)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="sp-recent-pill" onclick={() => commit(r)}>
              <i class="ph ph-clock-counter-clockwise"></i>
              <span>{r}</span>
              <span
                class="sp-recent-x"
                onclick={(e) => {
                  e.stopPropagation();
                  saveRecents(recents.filter((x) => x !== r));
                }}><i class="ph ph-x"></i></span
              >
            </div>
          {/each}
        </div>
      {/if}

      {#if mostPlayed.length}
        <div class="sp-sec-head"><h3>{t('search.most_played')}</h3></div>
        <div class="sp-shelf">
          {#each mostPlayed.slice(0, 8) as pod (pod.podcastid)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="sp-tile" onclick={() => goto(`/podcast/${pod.podcastid}`)}>
              <div class="sp-tile-cover"><FallbackImage src={pod.artworkurl} alt="Cover for {pod.podcastname}" class="sp-tile-cover-img" /></div>
              <div class="sp-tile-title">{pod.podcastname}</div>
              <div class="sp-tile-sub">{pod.episodecount ?? 0} {(pod.episodecount ?? 0) === 1 ? 'episode' : 'episodes'}</div>
            </div>
          {/each}
        </div>
      {/if}

      {#if categories.length}
        <div class="sp-sec-head"><h3>{t('search.browse_by_category')}</h3></div>
        <div class="sp-cat-grid">
          {#each categories as c (c)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="sp-cat {cats.includes(c) ? 'is-active' : ''}" onclick={() => toggleCat(c)}>
              <div class="sp-cat-name">{c}</div>
            </div>
          {/each}
        </div>
      {/if}

      {#if !recents.length && !mostPlayed.length && !categories.length}
        <div class="sp-noresults" style="padding-top: 80px;">
          <i class="ph ph-magnifying-glass"></i>
          <h4>{t('search.title')}</h4>
          <p>{t('search.subtitle')}</p>
        </div>
      {/if}
    {:else}
      <div class="sp-sec-head" style="margin-top: 8px;">
        <h3 style="text-transform: none; letter-spacing: 0;">
          <span class="sp-results-count">
            {searching && !episodes.length
              ? 'Searching…'
              : !episodes.length
                ? t('search.no_matches_header')
                : `${episodes.length} ${episodes.length === 1 ? 'match for' : 'matches for'} "${currentTerm}"`}
          </span>
        </h3>
      </div>

      {#if selecting && episodes.length}
        <div class="sp-select-controls">
          <button class="bulk-select-button" onclick={() => (selected = allSelected ? new Set() : new Set(ids))}>
            {allSelected ? t('search.deselect_all') : t('search.select_all')}
          </button>
          <button class="bulk-filter-button" onclick={() => (selected = new Set(episodes.filter((e) => !e.completed).map((e) => e.episodeid)))}>
            {t('search.select_unplayed')}
          </button>
          <button class="bulk-filter-button" onclick={() => (selected = new Set(episodes.filter((e) => !e.completed && e.listenduration > 0).map((e) => e.episodeid)))}>
            {t('search.select_in_progress')}
          </button>
        </div>
      {/if}

      {#if selecting && selected.size}
        <div class="bulk-actions-bar">
          <div class="bulk-actions-bar__count"><i class="ph ph-check-circle"></i>{selected.size} episode{selected.size === 1 ? '' : 's'} selected</div>
          <div class="bulk-actions-bar__actions">
            <button class="btn btn-secondary" onclick={() => bulk('/api/data/bulk_mark_episodes_completed', (x) => x.forEach((i) => episodeStatus.set('completed', i, true)))}>
              <i class="ph ph-check-circle"></i>{t('search.mark_complete')}
            </button>
            <button class="btn btn-secondary" onclick={() => bulk('/api/data/bulk_save_episodes', (x) => x.forEach((i) => episodeStatus.set('saved', i, true)))}>
              <i class="ph ph-star"></i>{t('search.save')}
            </button>
            <button
              class="btn btn-secondary"
              onclick={() =>
                bulk('/api/data/bulk_queue_episodes', (x) => {
                  x.forEach((i) => episodeStatus.set('queued', i, true));
                  ui.queueVersion++;
                })}
            >
              <i class="ph ph-list-plus"></i>{t('search.queue')}
            </button>
            <button class="btn btn-secondary" onclick={() => bulk('/api/data/bulk_download_episodes')}>
              <i class="ph ph-download-simple"></i>{t('search.download')}
            </button>
          </div>
        </div>
      {/if}

      {#if !episodes.length && !searching}
        <div class="sp-noresults">
          <i class="ph ph-binoculars"></i>
          <h4>{t('search.no_matches_header')}</h4>
          <p>{t('search.no_matches_body')}</p>
        </div>
      {:else if episodes.length}
        <div class="search-results-container">
          {#each episodes as ep (ep.episodeid)}
            <EpisodeListItem
              episode={ep}
              selectMode={selecting}
              selected={selected.has(ep.episodeid)}
              onselect={toggleSel}
              onselectabove={(i) => range(i, true)}
              onselectbelow={(i) => range(i, false)}
            />
          {/each}
          <div bind:this={sentinel}></div>
          {#if loadingMore}<div class="flex justify-center py-6"><div class="spinner"></div></div>{/if}
        </div>
      {/if}
    {/if}
  </div>
</div>
