<script lang="ts">
  // Port of upstream podcast_layout.rs PodcastItem: a search/discover result with
  // one-click subscribe/unsubscribe; clicking it opens the podcast or a preview.
  import { onMount } from 'svelte';
  import * as E from '$lib/api/endpoints';
  import type { SearchPodcast } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { fromSearch, openPodcast } from '$lib/podcastNav';
  import { sanitize } from '$lib/util/format';
  import { t } from '$lib/i18n/index.svelte';
  import FallbackImage from './FallbackImage.svelte';

  let { podcast: p }: { podcast: SearchPodcast } = $props();
  let added = $state(false);
  let busy = $state(false);

  onMount(() => {
    if (p.url)
      E.checkPodcast(p.title, p.url)
        .then((exists) => (added = exists))
        .catch(() => {});
  });

  async function toggle() {
    busy = true;
    try {
      if (added) {
        await E.removePodcastByName(p.title, p.url);
        added = false;
        toast.info(t('podcast_layout.podcast_removed'));
      } else {
        await E.addPodcast(fromSearch(p));
        added = true;
        toast.info(t('podcast_layout.podcast_added'));
      }
    } catch (e) {
      toast.error(`${t(added ? 'podcast_layout.remove_error' : 'podcast_layout.add_error')}: ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  const open = () => openPodcast(fromSearch(p));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div class="podcast-card">
  <div class="podcast-card__cover">
    <FallbackImage src={p.image} alt="Cover for {p.title}" class="podcast-card__img" onclick={open} />
    {#if p.explicit}<span class="podcast-card__explicit" title={t('podcast_layout.explicit')}>E</span>{/if}
    <button
      class="podcast-card__action"
      onclick={toggle}
      disabled={busy}
      title={added ? t('podcast_layout.remove') : t('podcast_layout.add')}
      aria-label={added ? t('podcast_layout.remove') : t('podcast_layout.add')}
    >
      <i class="ph {busy ? 'ph-spinner-gap animate-spin' : added ? 'ph-check' : 'ph-plus'}"></i>
    </button>
  </div>
  <div class="podcast-card__meta">
    <h3 class="podcast-card__title" onclick={open} title={p.title}>{p.title}</h3>
    {#if p.author}<p class="podcast-card__author">{t('podcast_layout.by')} {p.author}</p>{/if}
    <div class="podcast-card__desc">{@html sanitize(p.description)}</div>
    <div class="podcast-card__footer">
      <i class="ph ph-microphone"></i>
      <span>{p.episodeCount} {p.episodeCount === 1 ? t('podcast_layout.episode') : t('podcast_layout.episodes')}</span>
    </div>
  </div>
</div>
