<script lang="ts">
  // Port of upstream pages/podcast_layout.rs: Podcast Index / iTunes search results.
  // Reached from the top bar's search box.
  import { page } from '$app/state';
  import * as E from '$lib/api/endpoints';
  import type { SearchPodcast } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import PodcastCard from '$lib/components/PodcastCard.svelte';

  const q = $derived(page.url.searchParams.get('q') ?? '');
  const index = $derived((page.url.searchParams.get('index') ?? 'podcast_index') as 'podcast_index' | 'itunes');
  let results = $state<SearchPodcast[] | null>(null);

  $effect(() => {
    const query = q,
      idx = index;
    results = null;
    if (!query) return void (results = []);
    E.searchPodcasts(query, idx)
      .then((r) => (results = r))
      .catch((e) => {
        results = [];
        toast.error(e.status === 502 || e.status === 503 ? t('update_services.search_unavailable') : `${t('update_services.search_failed')}: ${e.message}`);
      });
  });
</script>

<div class="main-container">
  <TopBar />
  <h1 class="item_container-text text-2xl font-bold my-6 text-center">{t('podcast_layout.search_results')}</h1>
  {#if results === null}
    <Loading />
  {:else if results.length === 0}
    <EmptyMessage header={t('podcast_layout.no_results_found')} paragraph={t('podcast_layout.try_different_keywords')} />
  {:else}
    <div class="podcast-search-grid">
      {#each results as p (p.url)}<PodcastCard podcast={p} />{/each}
    </div>
  {/if}
</div>
