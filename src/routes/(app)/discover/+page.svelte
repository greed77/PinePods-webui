<script lang="ts">
  // Port of upstream pages/discover.rs (podcast sections): "For You" recommendations
  // grouped by reason, and trending podcasts filterable by category. The hosts
  // sections (PodPeopleDB) come with the people pages in stage 3.
  import * as E from '$lib/api/endpoints';
  import type { SearchPodcast } from '$lib/api/endpoints';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import PodcastCard from '$lib/components/PodcastCard.svelte';

  let loading = $state(true);
  let groups = $state<[string, SearchPodcast[]][]>([]);
  let categories = $state<{ id: number; name: string }[]>([]);
  let trending = $state<SearchPodcast[]>([]);
  let category = $state<string | null>(null);
  let trendingLoading = $state(false);

  const fromRec = (r: E.Recommendation): SearchPodcast => ({
    id: r.podcastindexid ?? 0,
    indexId: r.podcastindexid ?? 0,
    title: r.title,
    url: r.feedurl ?? '',
    author: r.author ?? '',
    description: r.description ?? '',
    image: r.image ?? '',
    link: '',
    categories: r.categories ?? {},
    explicit: false,
    episodeCount: 0
  });

  Promise.allSettled([E.getRecommendations(), E.getCategories(), E.getTrending(undefined, 24)]).then(([recs, cats, trend]) => {
    if (recs.status === 'fulfilled') {
      // Grouped by reason in score order, so the strongest reason leads.
      const map = new Map<string, SearchPodcast[]>();
      for (const r of recs.value) map.set(r.reason, [...(map.get(r.reason) ?? []), fromRec(r)]);
      groups = [...map.entries()];
    }
    if (cats.status === 'fulfilled') categories = [...cats.value].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    if (trend.status === 'fulfilled') trending = trend.value;
    loading = false;
  });

  async function pick(cat: string | null) {
    category = cat;
    trendingLoading = true;
    try {
      trending = await E.getTrending(cat ?? undefined, 24);
    } finally {
      trendingLoading = false;
    }
  }
</script>

{#snippet grid(list: SearchPodcast[])}
  <div class="podcast-flex-container" style="display: flex; flex-wrap: wrap; gap: 16px; padding: 0 12px 24px; width: 100%;">
    {#each list as p (p.url || p.title)}
      <div style="width: calc(25% - 16px); min-width: 220px; flex-grow: 1; margin-bottom: 16px;"><PodcastCard podcast={p} /></div>
    {/each}
  </div>
{/snippet}

<div class="main-container">
  <TopBar />
  {#if loading}
    <Loading />
  {:else}
    <div class="p-4">
      <h1 class="text-2xl item_container-text font-bold text-center mb-6">{t('discover.title')}</h1>
      <div class="mb-8">
        <h2 class="item_container-text text-xl font-semibold mb-4">{t('discover.for_you')}</h2>
        {#if groups.length === 0}
          <p class="item_container-text opacity-70">{t('discover.for_you_empty')}</p>
        {:else}
          {#each groups as [reason, items] (reason)}
            <div class="mb-6">
              <h3 class="item_container-text text-lg font-medium mb-3 opacity-90">{reason}</h3>
              {@render grid(items)}
            </div>
          {/each}
        {/if}
      </div>
      <div class="mb-8">
        <h2 class="item_container-text text-xl font-semibold mb-4">{t('discover.trending')}</h2>
        <div class="flex flex-wrap gap-2 mb-4">
          <button class="sp-chip {category === null ? 'is-active' : ''}" onclick={() => pick(null)}>{t('discover.all_categories')}</button>
          {#each categories as c (c.id)}
            <button class="sp-chip {category === c.name ? 'is-active' : ''}" onclick={() => pick(c.name)}>{c.name}</button>
          {/each}
        </div>
        {#if trendingLoading}
          <Loading />
        {:else if trending.length === 0}
          <EmptyMessage header={t('discover.empty_title')} paragraph={t('discover.empty_message')} />
        {:else}
          {@render grid(trending)}
        {/if}
      </div>
    </div>
  {/if}
</div>
