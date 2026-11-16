<script lang="ts">
  // One channel in the YouTube results (upstream youtube_layout.rs YouTubeChannelItem).
  import * as E from '$lib/api/endpoints';
  import type { YouTubeChannel } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import FallbackImage from '$lib/components/FallbackImage.svelte';

  let { channel }: { channel: YouTubeChannel } = $props();

  let subscribed = $state(false);
  let busy = $state(false);
  let expanded = $state(false);
  const url = $derived(E.youtubeChannelUrl(channel.channelId));

  $effect(() => {
    const [name, u] = [channel.name, url];
    let cancelled = false;
    E.checkYouTubeChannel(name, u)
      .then((v) => !cancelled && (subscribed = v))
      .catch(() => {});
    return () => (cancelled = true);
  });

  async function toggle() {
    if (busy) return;
    busy = true;
    try {
      if (!subscribed) {
        await E.subscribeYouTubeChannel(channel.channelId);
        subscribed = true;
        toast.info(t('youtube_layout.successfully_subscribed'));
      } else {
        await E.removeYouTubeChannel(channel.name, url);
        subscribed = false;
        toast.info(t('youtube_layout.successfully_unsubscribed'));
      }
    } catch (e) {
      const msg = subscribed ? t('youtube_layout.failed_to_unsubscribe') : t('youtube_layout.failed_to_subscribe');
      toast.error(`${msg}: ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  const icon = $derived(busy ? 'ph-spinner-gap animate-spin' : subscribed ? 'ph-trash' : 'ph-plus-circle');
</script>

<div class="search-item-container border-solid border rounded-lg overflow-hidden shadow-md flex flex-col h-full">
  <div class="relative w-full search-podcast-image-container" style="aspect-ratio: 1/1; padding-bottom: 100%;">
    <FallbackImage
      src={channel.thumbnailUrl}
      alt="{channel.name} {t('youtube_layout.channel_thumbnail')}"
      class="absolute inset-0 w-full h-full object-cover transition-transform duration-200 hover:scale-105 cursor-pointer"
    />
  </div>
  <div class="p-4 flex flex-col flex-grow">
    <div class="flex justify-between items-start mb-2">
      <h3 class="item_container-text text-xl font-semibold line-clamp-2 hover:text-opacity-80 transition-colors">{channel.name}</h3>
      <button
        class="item-container-button selector-button flex items-center justify-center rounded-full ml-3 flex-shrink-0 transition-all duration-200 ease-in-out hover:bg-opacity-80"
        style="width: 40px; height: 40px;"
        aria-label={subscribed ? 'Unsubscribe' : 'Subscribe'}
        disabled={busy}
        onclick={toggle}
      >
        <i class="ph {icon} text-2xl"></i>
      </button>
    </div>
    {#if channel.description}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="item_container-text text-sm mb-3 {expanded ? '' : 'line-clamp-3'}" onclick={() => (expanded = !expanded)}>
        {channel.description}
      </div>
      {#if channel.description.length > 150}
        <button class="text-sm font-medium mb-3 text-left hover:underline item_container-text opacity-80" onclick={() => (expanded = !expanded)}>
          {expanded ? t('youtube_layout.show_less') : t('youtube_layout.show_more')}
        </button>
      {/if}
    {/if}
  </div>
</div>
