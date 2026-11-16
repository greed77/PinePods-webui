<script lang="ts">
  // A podcast that isn't in the library: header from the search result, episodes
  // parsed from its feed by the server (upstream episode_layout.rs, "not added" path).
  // Episodes can be played; subscribing moves to the real podcast page.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import * as E from '$lib/api/endpoints';
  import type { Episode, Podcast } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { getPreview } from '$lib/podcastNav';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import PodcastHeader from '$lib/components/PodcastHeader.svelte';
  import EpisodeListItem from '$lib/components/EpisodeListItem.svelte';
  import SortSelect from '$lib/components/SortSelect.svelte';

  const feed = $derived(page.url.searchParams.get('feed') ?? '');
  let info = $state<Podcast | null>(null);
  let episodes = $state<Episode[] | null>(null);
  let busy = $state(false);
  let search = $state('');
  let sort = $state('newest');
  let shown = $state(50);

  $effect(() => {
    const url = feed;
    // Work on a local copy: reading `info` back inside this effect would re-run it.
    const p: Podcast = getPreview(url) ?? {
      podcastid: 0,
      podcastname: url,
      artworkurl: '',
      description: '',
      episodecount: 0,
      websiteurl: '',
      feedurl: url,
      author: '',
      categories: {},
      explicit: false,
      podcastindexid: 0
    };
    info = p;
    episodes = null;
    E.fetchFeedEpisodes(url, p.podcastname)
      .then((eps) => {
        episodes = eps;
        info = { ...p, episodecount: p.episodecount || eps.length, artworkurl: p.artworkurl || (eps[0]?.episodeartwork ?? '') };
      })
      .catch((e) => {
        episodes = [];
        toast.error((e as Error).message);
      });
  });

  async function subscribe() {
    if (!info) return;
    busy = true;
    try {
      const r = await E.addPodcast(info);
      toast.info(t('podcasts.podcast_successfully_added'));
      if (r.podcast_id) goto(`/podcast/${r.podcast_id}`, { replaceState: true });
    } catch (e) {
      toast.error(`${t('podcasts.failed_to_add_podcast')}: ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  const sorted = $derived.by(() => {
    const q = search.toLowerCase();
    const list = (episodes ?? []).filter((e) => !q || e.episodetitle.toLowerCase().includes(q) || e.episodedescription.toLowerCase().includes(q));
    const date = (e: Episode) => Date.parse(e.episodepubdate) || 0;
    const cmp: Record<string, (a: Episode, b: Episode) => number> = {
      newest: (a, b) => date(b) - date(a),
      oldest: (a, b) => date(a) - date(b),
      shortest: (a, b) => a.episodeduration - b.episodeduration,
      longest: (a, b) => b.episodeduration - a.episodeduration,
      title_az: (a, b) => a.episodetitle.localeCompare(b.episodetitle),
      title_za: (a, b) => b.episodetitle.localeCompare(a.episodetitle)
    };
    return [...list].sort(cmp[sort]);
  });

  // Render progressively: feeds can have thousands of episodes.
  let sentinel: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver((en) => en[0].isIntersecting && (shown += 50), { rootMargin: '600px' });
    io.observe(sentinel);
    return () => io.disconnect();
  });
</script>

<div class="main-container">
  <TopBar />
  {#if info}
    <PodcastHeader podcast={info} subscribed={false} {busy} isVideo={!!episodes?.some((e) => e.is_video)} ontoggle={subscribe} />
    <div class="pfb-section">
      <div class="pfb-bar">
        <div class="sp-input">
          <i class="ph ph-headphones sp-search-ico"></i>
          <input type="text" placeholder={t('episodes_layout.search_episodes_placeholder')} bind:value={search} />
        </div>
        <SortSelect bind:value={sort} ns="episodes_layout" />
      </div>
    </div>
    {#if episodes === null}
      <Loading />
    {:else if sorted.length === 0}
      <EmptyMessage header={t('episodes_layout.no_episodes_found')} paragraph={t('episodes_layout.no_episodes_description')} />
    {:else}
      <div class="flex-grow overflow-y-auto">
        {#each sorted.slice(0, shown) as ep, i (`${i}-${ep.episodeurl}`)}
          <EpisodeListItem episode={ep} />
        {/each}
        <div bind:this={sentinel}></div>
      </div>
    {/if}
  {/if}
</div>
