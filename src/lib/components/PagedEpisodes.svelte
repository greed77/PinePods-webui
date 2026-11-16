<script lang="ts">
  // A server-paged episode list with infinite scroll: the shared core of upstream's
  // EpisodeListView as used by Feed, History, Saved/collections and Downloads.
  // `load(offset)` fetches the next page; changing `key` reloads from the start.
  import type { Episode, Page } from '$lib/api/endpoints';
  import { episodeStatus } from '$lib/stores/app.svelte';
  import EpisodeListItem from './EpisodeListItem.svelte';
  import EmptyMessage from './EmptyMessage.svelte';
  import Loading from './Loading.svelte';
  import type { PageType } from './ContextMenu.svelte';

  let {
    load,
    key,
    filter,
    pageType = 'default',
    emptyHeader,
    emptyText,
    episodes = $bindable([]),
    selectMode = false,
    selected,
    onselect
  }: {
    load: (offset: number) => Promise<Page>;
    key: unknown;
    /** Client-side filter applied to what's loaded (search box, favorites). */
    filter?: (e: Episode) => boolean;
    pageType?: PageType;
    emptyHeader: string;
    emptyText: string;
    episodes?: Episode[];
    selectMode?: boolean;
    selected?: Set<number>;
    onselect?: (id: number) => void;
  } = $props();

  let total = $state(0);
  let loading = $state(true);
  let loadingMore = $state(false);
  let generation = 0;

  $effect(() => {
    key;
    const gen = ++generation;
    loading = true;
    episodes = [];
    load(0)
      .then((p) => {
        if (gen !== generation) return;
        episodes = p.episodes;
        total = p.total;
        episodeStatus.absorb(p.episodes);
      })
      .catch((e) => console.warn('Failed to load episodes', e))
      .finally(() => gen === generation && (loading = false));
  });

  async function more() {
    if (loading || loadingMore || episodes.length >= total) return;
    loadingMore = true;
    const gen = generation;
    try {
      const p = await load(episodes.length);
      if (gen !== generation) return;
      episodes = [...episodes, ...p.episodes];
      total = p.total;
      episodeStatus.absorb(p.episodes);
    } finally {
      loadingMore = false;
    }
  }

  let sentinel: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && more(), { rootMargin: '600px' });
    io.observe(sentinel);
    return () => io.disconnect();
  });

  const shown = $derived(filter ? episodes.filter(filter) : episodes);
</script>

{#if loading}
  <Loading />
{:else if shown.length === 0}
  <EmptyMessage header={emptyHeader} paragraph={emptyText} />
{:else}
  <div class="flex-grow overflow-y-auto">
    {#each shown as ep (`${ep.episodeid}-${ep.episodeurl}`)}
      <EpisodeListItem episode={ep} {pageType} {selectMode} selected={selected?.has(ep.episodeid)} {onselect} />
    {/each}
    <div bind:this={sentinel}></div>
    {#if loadingMore}
      <div class="flex justify-center py-6"><div class="spinner"></div></div>
    {/if}
  </div>
{/if}
