<script lang="ts">
  // Port of upstream pages/podcasts.rs. The "custom feed" modal comes in stage 2.
  import { goto } from '$app/navigation';
  import * as E from '$lib/api/endpoints';
  import type { Podcast } from '$lib/api/endpoints';
  import { toast, ui } from '$lib/stores/app.svelte';
  import { sanitize } from '$lib/util/format';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import FallbackImage from '$lib/components/FallbackImage.svelte';

  const SORT_KEY = 'podcasts_sort';
  const LAYOUT_KEY = 'podcast_layout';
  const stored = (k: string, d: string) => {
    try {
      return localStorage.getItem(k) || d;
    } catch {
      return d;
    }
  };
  const store = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  };

  let podcasts = $state<Podcast[] | null>(null);
  let search = $state('');
  let sort = $state(stored(SORT_KEY, 'alpha_asc'));
  let layout = $state<'grid' | 'list'>(stored(LAYOUT_KEY, 'grid') as 'grid' | 'list');
  let category = $state<string | null>(null);
  let expanded = $state(new Set<number>());
  let toDelete = $state<Podcast | null>(null);

  async function load() {
    try {
      podcasts = await E.getPodcasts();
    } catch (e) {
      console.warn('Unable to load podcasts', e);
      podcasts = [];
    }
  }
  load();

  const categories = $derived([...new Set((podcasts ?? []).flatMap((p) => Object.values(p.categories ?? {}).map((c) => c.trim())))]);

  const filtered = $derived.by(() => {
    const q = search.toLowerCase();
    const list = (podcasts ?? []).filter(
      (p) =>
        (!q || p.podcastname.toLowerCase().includes(q)) &&
        (!category || Object.values(p.categories ?? {}).some((c) => c.trim() === category)) &&
        (!ui.favoritesOnly || p.is_favorite)
    );
    const byDate = (a?: string | null, b?: string | null, dir = 1) =>
      a && b ? (a < b ? -dir : a > b ? dir : 0) : Number(!a) - Number(!b);
    const cmp: Record<string, (a: Podcast, b: Podcast) => number> = {
      alpha_asc: (a, b) => a.podcastname.toLowerCase().localeCompare(b.podcastname.toLowerCase()),
      alpha_desc: (a, b) => b.podcastname.toLowerCase().localeCompare(a.podcastname.toLowerCase()),
      episodes_high: (a, b) => (b.episodecount ?? 0) - (a.episodecount ?? 0),
      episodes_low: (a, b) => (a.episodecount ?? 0) - (b.episodecount ?? 0),
      oldest: (a, b) => byDate(a.newest_episode_date, b.newest_episode_date, 1),
      newest: (a, b) => byDate(a.newest_episode_date, b.newest_episode_date, -1),
      most_played: (a, b) => (b.play_count ?? 0) - (a.play_count ?? 0),
      least_played: (a, b) => (a.play_count ?? 0) - (b.play_count ?? 0)
    };
    return [...list].sort(cmp[sort] ?? cmp.alpha_asc);
  });

  const sorts = [
    ['alpha_asc', 'podcasts.sort_a_to_z_up'],
    ['alpha_desc', 'podcasts.sort_z_to_a_down'],
    ['episodes_high', 'podcasts.sort_most_episodes'],
    ['episodes_low', 'podcasts.sort_least_episodes'],
    ['oldest', 'podcasts.sort_oldest_first'],
    ['newest', 'podcasts.sort_newest_first'],
    ['most_played', 'podcasts.sort_most_played'],
    ['least_played', 'podcasts.sort_least_played']
  ];

  function reset() {
    category = null;
    search = '';
    sort = 'alpha_asc';
    store(SORT_KEY, sort);
  }

  async function toggleFavorite(p: Podcast) {
    const next = !p.is_favorite;
    try {
      await E.togglePodcastFavorite(p.podcastid, next);
      p.is_favorite = next;
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  }

  async function remove() {
    const p = toDelete;
    toDelete = null;
    if (!p) return;
    const yt = p.feedurl?.startsWith('https://www.youtube.com');
    try {
      const { success } = await E.removePodcast(p.podcastid);
      if (success) {
        podcasts = (podcasts ?? []).filter((x) => x.podcastid !== p.podcastid);
        toast.info(t(yt ? 'podcasts.youtube_channel_removed' : 'podcasts.podcast_removed'));
      } else toast.error(t(yt ? 'podcasts.youtube_channel_remove_failed' : 'podcasts.podcast_remove_failed'));
    } catch (e) {
      toast.error(`${t('podcasts.error_removing_content')}${(e as Error).message}`);
    }
  }

  const open = (p: Podcast) => goto(`/podcast/${p.podcastid}`);
</script>

<div class="main-container">
  <TopBar />

  {#if toDelete}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-[calc(100%-1rem)] max-h-full bg-black bg-opacity-25"
      onclick={() => (toDelete = null)}
    >
      <div class="modal-container relative p-4 w-full max-w-md max-h-full rounded-lg shadow" onclick={(e) => e.stopPropagation()}>
        <div class="modal-container relative rounded-lg shadow">
          <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
            <h3 class="text-xl font-semibold">{t('podcasts.delete_podcast')}</h3>
            <button
              onclick={() => (toDelete = null)}
              class="end-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
            >
              <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
              </svg>
              <span class="sr-only">{t('podcasts.close_modal')}</span>
            </button>
          </div>
          <div class="p-4 md:p-5">
            <p class="block mb-2 text-sm font-medium">{t('podcasts.delete_confirmation_text')}</p>
            <div class="flex justify-between space-x-4">
              <button onclick={remove} class="mt-4 download-button font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                {t('podcasts.yes_delete_podcast')}
              </button>
              <button onclick={() => (toDelete = null)} class="mt-4 download-button font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                {t('podcasts.no_take_me_back')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <div>
    <div class="pfb-section">
      <div class="pfb-bar">
        <div class="sp-input">
          <i class="ph ph-microphone sp-search-ico"></i>
          <input type="text" placeholder={t('podcasts.search_podcasts_placeholder')} bind:value={search} />
        </div>
        <div class="pfb-sort">
          <i class="ph ph-funnel pfb-sort-icon-mobile"></i>
          <select class="pfb-sort-select" bind:value={sort} onchange={() => store(SORT_KEY, sort)}>
            {#each sorts as [v, k]}<option value={v}>{t(k)}</option>{/each}
          </select>
          <i class="ph ph-caret-down pfb-sort-arrow"></i>
        </div>
        <div class="flex gap-2 items-center flex-shrink-0">
          <button
            class="sp-chip"
            onclick={() => {
              layout = layout === 'grid' ? 'list' : 'grid';
              store(LAYOUT_KEY, layout);
            }}
          >
            <i class={layout === 'list' ? 'ph ph-squares-four' : 'ph ph-list-dashes'}></i>
            <span class="pfb-chip-text">{layout === 'list' ? t('podcasts.grid_view') : t('podcasts.list_view')}</span>
          </button>
        </div>
      </div>
      <div class="sp-chips pfb-chips">
        <button onclick={reset} class="sp-chip"><i class="ph ph-broom"></i><span>{t('podcasts.clear_all')}</span></button>
        {#each categories as c}
          <button onclick={() => (category = c)} class="sp-chip {category === c ? 'is-active' : ''}"><span>{c}</span></button>
        {/each}
      </div>
    </div>
  </div>

  {#if podcasts === null}
    <Loading />
  {:else if filtered.length === 0}
    <EmptyMessage header={t('podcasts.no_podcasts_found')} paragraph={t('podcasts.no_podcasts_found_description')} />
  {:else if layout === 'list'}
    <div>
      {#each filtered as p (p.podcastid)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="ep-row">
          <div class="ep-art-wrap" onclick={() => open(p)}>
            <FallbackImage src={p.artworkurl} alt="{t('podcasts.cover_alt_text')}{p.podcastname}" class="ep-art-img" />
          </div>
          <div class="ep-body">
            <div class="ep-title cursor-pointer" onclick={() => open(p)}>{p.podcastname}</div>
            <hr class="ep-divider" />
            <div
              class="ep-desc {expanded.has(p.podcastid) ? 'desc-expanded' : 'desc-collapsed'}"
              onclick={() => {
                const next = new Set(expanded);
                if (next.has(p.podcastid)) next.delete(p.podcastid);
                else next.add(p.podcastid);
                expanded = next;
              }}
            >
              {@html sanitize(p.description)}
            </div>
            <div class="ep-meta">
              <i class={p.is_video ? 'ph ph-television' : 'ph ph-broadcast'}></i>
              <span>{t('podcasts.episode_count')}{p.episodecount ?? 0}</span>
            </div>
          </div>
          <div class="ep-actions">
            <button class="ico" onclick={() => (toDelete = p)} aria-label={t('podcasts.delete_podcast')}><i class="ph ph-trash"></i></button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="podcast-grid">
      {#each filtered as p (p.podcastid)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="podcast-grid-item relative" onclick={() => open(p)}>
          <div class="absolute top-1 right-1 z-10 bg-opacity-80 bg-gray-800 text-white rounded-full px-2 py-1 text-xs font-bold">
            <i class="ph {p.is_video ? 'ph-television' : 'ph-broadcast'} inline-block mr-1"></i>{p.episodecount ?? 0}
          </div>
          <div
            class="absolute top-1 left-1 z-10 cursor-pointer bg-opacity-80 bg-gray-800 text-white rounded-full px-2 py-1 text-xs font-bold"
            onclick={(e) => {
              e.stopPropagation();
              toggleFavorite(p);
            }}
          >
            <i class="ph ph-star text-xl {p.is_favorite ? 'text-yellow-400' : 'text-white'}"></i>
          </div>
          <div class="podcast-image-container">
            <FallbackImage src={p.artworkurl} alt="{t('podcasts.cover_alt_text')}{p.podcastname}" class="podcast-image" />
          </div>
          <div class="podcast-info"><h3 class="podcast-title-grid">{p.podcastname}</h3></div>
        </div>
      {/each}
    </div>
  {/if}
</div>
