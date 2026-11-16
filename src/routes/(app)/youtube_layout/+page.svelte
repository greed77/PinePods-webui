<script lang="ts">
  // Port of upstream pages/youtube_layout.rs: YouTube channel search results with a
  // subscribe / unsubscribe button per channel. Upstream keeps the results in a store
  // filled by the top-bar search; here the query is in the URL (?q=) so reloads work.
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import * as E from '$lib/api/endpoints';
  import type { YouTubeChannel } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import YouTubeChannelCard from './YouTubeChannelCard.svelte';

  const query = $derived(page.url.searchParams.get('q')?.trim() ?? '');
  let results = $state<YouTubeChannel[] | null>(null);
  let loading = $state(false);
  let columns = $state(2);

  $effect(() => {
    const q = query;
    results = null;
    if (!q) return;
    let cancelled = false;
    loading = true;
    E.searchYouTube(q)
      .then((r) => !cancelled && (results = r))
      .catch((e) => {
        if (cancelled) return;
        results = [];
        toast.error(`YouTube search error: ${(e as Error).message}`);
      })
      .finally(() => !cancelled && (loading = false));
    return () => (cancelled = true);
  });

  onMount(() => {
    const update = () => (columns = innerWidth < 1024 ? 2 : innerWidth < 1280 ? 3 : 4);
    update();
    addEventListener('resize', update);
    return () => removeEventListener('resize', update);
  });
</script>

<div class="main-container">
  <TopBar />
  <h1 class="item_container-text text-2xl font-bold my-6 text-center">{t('youtube_layout.youtube_channels')}</h1>
  {#if loading}
    <Loading />
  {:else if results === null}
    <EmptyMessage header={t('youtube_layout.search_youtube_channels')} paragraph={t('youtube_layout.enter_channel_name')} />
  {:else if results.length === 0}
    <EmptyMessage header={t('youtube_layout.no_channels_found')} paragraph={t('youtube_layout.try_different_keywords')} />
  {:else}
    <div class="youtube-flex-container" style="display: flex; flex-wrap: wrap; gap: 16px; padding: 0 12px 24px; width: 100%;">
      {#each results as channel (channel.channelId)}
        <div style="width: calc({100 / columns}% - 16px); margin-bottom: 16px;">
          <YouTubeChannelCard {channel} />
        </div>
      {/each}
    </div>
  {/if}
</div>
