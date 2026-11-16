<script lang="ts">
  // Port of upstream pages/discover.rs: "For You" recommendations grouped by reason,
  // trending podcasts filterable by category, and hosts from PodPeopleDB.
  import { goto } from '$app/navigation';
  import * as E from '$lib/api/endpoints';
  import type { SearchPodcast } from '$lib/api/endpoints';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import PodcastCard from '$lib/components/PodcastCard.svelte';
  import FallbackImage from '$lib/components/FallbackImage.svelte';

  let loading = $state(true);
  let groups = $state<[string, SearchPodcast[]][]>([]);
  let categories = $state<{ id: number; name: string }[]>([]);
  let trending = $state<SearchPodcast[]>([]);
  let category = $state<string | null>(null);
  let trendingLoading = $state(false);
  let topHosts = $state<E.DiscoverHost[]>([]);
  let recentHosts = $state<E.DiscoverHost[]>([]);
  let popular = $state<E.DiscoverPodcast[]>([]);
  let stats = $state<E.DiscoverStats | null>(null);

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

  // Host discovery loads on its own so a slow PodPeopleDB doesn't hold up the page.
  E.discoverTopHosts(24).then((v) => (topHosts = v), () => {});
  E.discoverRecentHosts(12).then((v) => (recentHosts = v), () => {});
  E.discoverPopularPodcasts(12).then((v) => (popular = v), () => {});
  E.discoverStats().then((v) => (stats = v), () => {});

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

{#snippet host(h: E.DiscoverHost)}
  <!-- Discover hosts are PodPeopleDB ids; the person page resolves them. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="discover-host-card flex flex-col items-center text-center p-3 cursor-pointer" onclick={() => goto(`/person/pp-${h.id}`)}>
    <div class="w-20 h-20 rounded-full overflow-hidden mb-2">
      <FallbackImage src={h.img} alt={h.name} class="w-full h-full object-cover" />
    </div>
    <p class="item_container-text text-sm font-semibold">{h.name}</p>
    {#if h.podcast_count > 0}
      <p class="text-xs item_container-text opacity-70">{t('discover.shows_count').replace('{count}', String(h.podcast_count))}</p>
    {/if}
  </div>
{/snippet}

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
      {#if topHosts.length || recentHosts.length || popular.length}
        <div class="mb-4" data-testid="discover-hosts">
          <h2 class="item_container-text text-xl font-semibold mb-2">{t('discover.hosts_section')}</h2>
          {#if stats}
            <p class="item_container-text opacity-70 mb-4">
              {t('discover.stats_summary').replace('{hosts}', String(stats.total_hosts)).replace('{podcasts}', String(stats.total_podcasts))}
            </p>
          {/if}
          {#if topHosts.length}
            <div class="mb-8">
              <h3 class="item_container-text text-lg font-medium mb-4">{t('discover.top_hosts')}</h3>
              <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
                {#each topHosts as h (h.id)}{@render host(h)}{/each}
              </div>
            </div>
          {/if}
          {#if recentHosts.length}
            <div class="mb-8">
              <h3 class="item_container-text text-lg font-medium mb-4">{t('discover.recently_added')}</h3>
              <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
                {#each recentHosts as h (h.id)}{@render host(h)}{/each}
              </div>
            </div>
          {/if}
          {#if popular.length}
            <div class="mb-8">
              <h3 class="item_container-text text-lg font-medium mb-4">{t('discover.popular_podcasts')}</h3>
              <div class="flex flex-col gap-2">
                {#each popular as p (p.podcast_id)}
                  <div class="item-container border-solid border p-3 rounded-lg">
                    <p class="item_container-text font-semibold">{p.title}</p>
                    <p class="item_container-text text-sm opacity-70">{t('discover.hosts_count').replace('{count}', String(p.host_count))}</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
