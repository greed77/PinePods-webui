<script lang="ts">
  // Port of upstream pages/queue.rs: the queue with drag-to-reorder.
  import * as E from '$lib/api/endpoints';
  import { queue } from '$lib/stores/queue.svelte';
  import { ui } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import EpisodeListItem from '$lib/components/EpisodeListItem.svelte';

  let loading = $state(true);
  let favorites = $state(new Set<number>());
  let dragging: number | null = null;
  let list: HTMLDivElement | undefined = $state();

  $effect(() => {
    ui.queueVersion;
    queue.refresh().finally(() => (loading = false));
  });
  E.getPodcasts()
    .then((p) => (favorites = new Set(p.filter((x) => x.is_favorite).map((x) => x.podcastid))))
    .catch(() => {});

  const shown = $derived(ui.favoritesOnly ? queue.episodes.filter((e) => favorites.has(e.podcastid)) : queue.episodes);

  const idOf = (e: Event) => Number((e.target as Element).closest('[data-id]')?.getAttribute('data-id'));

  const drag = {
    start: (e: DragEvent) => {
      dragging = idOf(e);
      e.dataTransfer?.setData('text/plain', String(dragging));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    },
    enter: (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    },
    over: (e: DragEvent) => {
      e.preventDefault();
      // Scroll the page when dragging near the top or bottom edge.
      if (e.clientY < 80) scrollBy(0, -20);
      else if (e.clientY > innerHeight - 120) scrollBy(0, 20);
    },
    drop: (e: DragEvent) => {
      e.preventDefault();
      const to = idOf(e);
      if (dragging != null && to && to !== dragging) queue.move(dragging, to);
      dragging = null;
    }
  };
</script>

<div class="main-container">
  <TopBar />
  {#if loading && !queue.loaded}
    <Loading />
  {:else}
    <div class="mb-2">
      <div class="page-tab-indicator"><i class="ph ph-queue tab-icon"></i>{t('queue.queue')}</div>
    </div>
    {#if shown.length === 0}
      <EmptyMessage header={t('queue.no_queued_episodes_found')} paragraph={t('queue.queue_episodes_instructions')} />
    {:else}
      <div bind:this={list} class="queue-list-container flex-grow overflow-y-auto">
        {#each shown as ep (ep.episodeid)}
          <EpisodeListItem episode={ep} pageType="queue" {drag} />
        {/each}
      </div>
    {/if}
  {/if}
</div>
