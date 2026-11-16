<script lang="ts">
  // The podcast page header from upstream episode_layout.rs: a banner on desktop,
  // a compact header with an icon bar on phones (< 768px). Shared by subscribed
  // podcasts and previews of podcasts found in search.
  import { onMount } from 'svelte';
  import { sanitize } from '$lib/util/format';
  import { t } from '$lib/i18n/index.svelte';
  import FallbackImage from './FallbackImage.svelte';

  interface HeaderPodcast {
    podcastname: string;
    artworkurl: string;
    author: string;
    episodecount: number;
    explicit: boolean;
    description: string;
    websiteurl: string;
    categories: Record<string, string> | null;
  }

  let {
    podcast: d,
    subscribed,
    busy = false,
    isVideo = false,
    ontoggle,
    ondownload
  }: { podcast: HeaderPodcast; subscribed: boolean; busy?: boolean; isVideo?: boolean; ontoggle: () => void; ondownload?: () => void } = $props();

  let isMobile = $state(false);
  let descExpanded = $state(false);

  onMount(() => {
    const check = () => (isMobile = innerWidth < 768);
    check();
    addEventListener('resize', check);
    return () => removeEventListener('resize', check);
  });

  // Unique, non-blank names in key order (upstream visible_categories).
  const categories = $derived.by(() => {
    const seen = new Set<string>();
    return Object.entries(d.categories ?? {})
      .sort(([a], [b]) => (isNaN(+a) || isNaN(+b) ? a.localeCompare(b) : +a - +b))
      .map(([, n]) => n.trim())
      .filter((n) => n && !seen.has(n.toLowerCase()) && !!seen.add(n.toLowerCase()));
  });

  const openUrl = (u?: string) => u && window.open(u, '_blank', 'noopener');
  const subIcon = $derived(busy ? 'ph-spinner animate-spin' : subscribed ? 'ph-trash' : 'ph-plus-circle');
  const explicitText = $derived(`${t('episodes_layout.explicit')}${d.explicit ? t('episodes_layout.yes') : t('episodes_layout.no')}`);
</script>

{#snippet description(extra: string)}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="item-header-description {descExpanded ? 'desc-expanded' : 'desc-collapsed'} {extra}" onclick={() => (descExpanded = !descExpanded)}>
    {@html sanitize(d.description)}
    <button class="toggle-desc-btn" aria-label="Toggle description"></button>
  </div>
{/snippet}

{#if isMobile}
  <div class="mobile-layout ep-mobile-pod-header">
    <div class="ep-mobile-header">
      <FallbackImage src={d.artworkurl} alt="Cover for {d.podcastname}" class="ep-mobile-art rounded-corners" />
      <div class="ep-mobile-meta">
        <div class="flex items-center gap-2">
          <h2 class="ep-mobile-title">{d.podcastname}</h2>
          {#if isVideo}
            <span class="inline-flex items-center gap-1 bg-opacity-80 bg-gray-700 text-white text-xs px-1.5 py-0.5 rounded-full">
              <i class="ph ph-television"></i>{t('episodes_layout.video')}
            </span>
          {/if}
        </div>
        <p class="ep-mobile-podcast-name">{d.author}</p>
        <p class="ep-mobile-subinfo">{t('episodes_layout.episode_count')}{d.episodecount} · {explicitText}</p>
      </div>
    </div>
    <div class={subscribed ? 'ep-mobile-actions' : 'ep-mobile-actions ep-mobile-actions-sparse'}>
      <button onclick={ontoggle} title="Add or remove podcast" class="ep-mobile-action-btn ep-mobile-action-play"><i class="ph {subIcon} text-2xl"></i></button>
      <button onclick={() => openUrl(d.websiteurl)} title="Visit podcast website" class="ep-mobile-action-btn"><i class="ph ph-globe text-2xl"></i></button>
      {#if subscribed && ondownload}
        <button onclick={ondownload} title="Download all episodes" class="ep-mobile-action-btn"><i class="ph ph-download text-2xl"></i></button>
      {/if}
    </div>
    <div class="ep-mobile-desc-section">{@render description('')}</div>
    {#if categories.length}
      <div class="ep-mobile-categories">
        {#each categories as c}<span class="category-box">{c}</span>{/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="pd-banner">
    <div class="pd-banner-backdrop" style="background-image: url('{d.artworkurl}');"></div>
    <div class="pd-banner-scrim"></div>
    <div class="pd-banner-inner">
      <div class="pd-banner-top">
        <FallbackImage src={d.artworkurl} alt="Cover for {d.podcastname}" class="pd-banner-cover" />
        <div class="pd-banner-head">
          <div class="pd-eyebrow">
            <i class="ph ph-microphone-stage"></i>
            <span>{categories[0] ? `${t('episodes_layout.podcast')} · ${categories[0]}` : t('episodes_layout.podcast')}</span>
          </div>
          <div class="pd-banner-title-row">
            <h2 class="pd-banner-title">{d.podcastname}</h2>
            {#if isVideo}
              <span class="inline-flex items-center gap-1 bg-opacity-80 bg-gray-700 text-white text-xs px-2 py-1 rounded-full self-center">
                <i class="ph ph-television"></i>{t('episodes_layout.video')}
              </span>
            {/if}
          </div>
          <div class="pd-banner-meta">
            <span class="pd-author">{t('episodes_layout.authors')}<strong>{d.author}</strong></span>
            <span class="pd-dot">•</span>
            <span class="pd-stat"><i class="ph ph-stack"></i>{t('episodes_layout.episode_count')}{d.episodecount}</span>
            <span class="pd-dot">•</span>
            <span class="pd-stat">{explicitText}</span>
          </div>
          <div class="pd-banner-actions">
            <button onclick={ontoggle} title={t('episodes_layout.add_remove_podcast')} class={subscribed ? 'pd-btn-primary is-subscribed' : 'pd-btn-primary'}>
              <i class="ph {subIcon} text-2xl"></i>
              <span>{busy ? t('episodes_layout.subscribing') : subscribed ? t('episodes_layout.subscribed') : t('episodes_layout.subscribe')}</span>
            </button>
            {#if subscribed && ondownload}
              <button onclick={ondownload} title={t('episodes_layout.download_all_episodes')} class="pd-icon-btn"><i class="ph ph-download text-2xl"></i></button>
            {/if}
            <button onclick={() => openUrl(d.websiteurl)} title="Visit external podcast website" class="pd-icon-btn"><i class="ph ph-globe text-2xl"></i></button>
          </div>
        </div>
      </div>
      {@render description('pd-banner-desc')}
      {#if categories.length}
        <div class="pd-banner-cats">
          {#each categories as c}<span class="category-box">{c}</span>{/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
