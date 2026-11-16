<script lang="ts">
  // Port of upstream pages/episode.rs: hero (or compact mobile header), actions,
  // and the notes / chapters tabs. Share links, transcripts, people and ad review
  // come in a later stage.
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import * as E from '$lib/api/endpoints';
  import type { Chapter, Episode } from '$lib/api/endpoints';
  import * as A from '$lib/episodeActions';
  import { episodeStatus, toast } from '$lib/stores/app.svelte';
  import { session } from '$lib/stores/session.svelte';
  import { player } from '$lib/player/player.svelte';
  import { formatDateTime, formatTime, sanitize } from '$lib/util/format';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import FallbackImage, { DEFAULT_EPISODE_ART } from '$lib/components/FallbackImage.svelte';

  const id = $derived(Number(page.params.id));
  const youtube = $derived(page.url.searchParams.get('youtube') === 'true');

  let episode = $state<Episode | null>(null);
  let error = $state<string | null>(null);
  let chapters = $state<Chapter[]>([]);
  let tab = $state<'notes' | 'chapters'>('notes');
  let isMobile = $state(false);
  let downloading = $state(false);

  onMount(() => {
    const check = () => (isMobile = innerWidth < 768);
    check();
    addEventListener('resize', check);
    return () => removeEventListener('resize', check);
  });

  $effect(() => {
    const eid = id,
      yt = youtube;
    episode = null;
    error = null;
    chapters = [];
    tab = 'notes';
    E.getEpisodeMetadata(eid, yt)
      .then((ep) => {
        episode = ep;
        episodeStatus.absorb([ep]);
      })
      .catch((e) => (error = (e as Error).message));
    if (!yt)
      E.getPodcasting2Data(eid)
        .then((d) => (chapters = d.chapters ?? []))
        .catch(() => {});
  });

  const ep = $derived(episode);
  const isLoaded = $derived(!!ep && player.current?.episode.episodeid === ep.episodeid);
  const isPlaying = $derived(isLoaded && player.playing);
  const queued = $derived(!!ep && episodeStatus.queued.has(ep.episodeid));
  const saved = $derived(!!ep && episodeStatus.saved.has(ep.episodeid));
  const downloaded = $derived(!!ep && episodeStatus.downloaded.has(ep.episodeid));
  const completed = $derived(!!ep && episodeStatus.completed.has(ep.episodeid));
  const inDb = $derived(!!ep && ep.episodeid > 0);
  const hasMedia = $derived(!!ep?.episodeurl);
  const release = $derived(ep ? formatDateTime(ep.episodepubdate) : '');
  const duration = $derived(ep ? formatTime(ep.episodeduration) : '');
  const pct = $derived(ep && ep.episodeduration > 0 ? Math.min(100, Math.round((ep.listenduration * 100) / ep.episodeduration)) : 0);

  function play() {
    if (!ep) return;
    if (isLoaded) player.toggle();
    else player.play(ep);
  }

  const openPodcast = () => ep?.podcastid && goto(`/podcast/${ep.podcastid}`);

  function jumpTo(start: number, isCurrentPlaying: boolean) {
    if (!ep) return;
    if (isCurrentPlaying) return player.media?.pause();
    if (isLoaded) {
      player.seekTo(start);
      player.media?.play();
    } else player.play({ ...ep, listenduration: start });
  }

  async function downloadFile() {
    if (!ep) return;
    downloading = true;
    try {
      const res = await fetch(`${session.serverName}/api/episodes/${ep.episodeid}/download?api_key=${encodeURIComponent(session.apiKey)}`);
      if (!res.ok) throw new Error(`Download request failed with status: ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const name = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(cd)?.[1] ?? `${ep.episodetitle}.mp3`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = decodeURIComponent(name);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      downloading = false;
    }
  }

  const chapterRows = $derived(
    chapters.map((c, i) => {
      const start = Number(c.startTime ?? 0);
      const end = chapters[i + 1]?.startTime != null ? Number(chapters[i + 1].startTime) : Infinity;
      const isCurrent = isLoaded && player.currentTime >= start && player.currentTime < end;
      return { c, i, start, isCurrent, isActivePlaying: isCurrent && player.playing };
    })
  );
</script>

{#snippet progressBar()}
  {#if ep && ep.listenduration > 0}
    <div class="flex flex-col space-y-1 mt-2">
      <div class="flex items-center space-x-2">
        <span class="item_container-text">{formatTime(ep.listenduration)}</span>
        <div class="progress-bar-container"><div class="progress-bar" style="width: {pct}%;"></div></div>
        <span class="item_container-text">{duration}</span>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet notes()}
  <div class="item_container-text episode-description-container">{@html sanitize(ep?.episodedescription ?? '')}</div>
{/snippet}

<div class="main-container">
  <TopBar />

  {#if error}
    <EmptyMessage header={t('episode.unable_to_display_episode')} paragraph={error} />
  {:else if !ep}
    <Loading />
  {:else if isMobile}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <div class="mobile-layout ep-mobile-page">
      <div class="ep-mobile-header">
        <FallbackImage src={ep.episodeartwork} fallback={DEFAULT_EPISODE_ART} alt="{t('episode.cover_alt_text')}{ep.episodeartwork}" class="ep-mobile-art rounded-corners" />
        <div class="ep-mobile-meta">
          <p class="ep-mobile-podcast-name" onclick={openPodcast}>{ep.podcastname}</p>
          <h2 class="ep-mobile-title">
            {ep.episodetitle}
            {#if completed}<i class="ph ph-check-circle ep-mobile-complete-badge"></i>{/if}
          </h2>
          <p class="ep-mobile-subinfo">{duration} · {release}</p>
        </div>
      </div>
      <div class="ep-mobile-progress">{@render progressBar()}</div>
      {#if hasMedia}
        <div class="ep-mobile-actions">
          <button onclick={play} class="ep-mobile-action-btn ep-mobile-action-play" title={isPlaying ? t('episode.pause') : t('episode.play')}>
            <i class="ph {isPlaying ? 'ph-pause' : 'ph-play'}"></i>
          </button>
          {#if inDb}
            <button
              onclick={() => A.toggleQueue(ep)}
              class="ep-mobile-action-btn {queued ? 'ep-mobile-active' : ''}"
              title={queued ? t('episode.remove_from_queue') : t('episode.add_to_queue')}><i class="ph ph-queue"></i></button
            >
            <button onclick={() => A.toggleSave(ep)} class="ep-mobile-action-btn {saved ? 'ep-mobile-active' : ''}" title={saved ? t('episode.unsave') : t('episode.save')}>
              <i class="ph {saved ? 'ph-heart-break' : 'ph-heart'}"></i>
            </button>
            <button
              onclick={() => A.toggleDownload(ep)}
              class="ep-mobile-action-btn {downloaded ? 'ep-mobile-active' : ''}"
              title={downloaded ? t('episode.remove_download') : t('episode.download')}
            >
              <i class="ph {downloaded ? 'ph-trash' : 'ph-download'}"></i>
            </button>
            <button
              onclick={() => A.toggleComplete(ep)}
              class="ep-mobile-action-btn {completed ? 'ep-mobile-active' : ''}"
              title={completed ? t('episode.mark_incomplete') : t('episode.mark_complete')}
            >
              <i class="ph {completed ? 'ph-x-circle' : 'ph-check-fat'}"></i>
            </button>
          {/if}
        </div>
      {:else}
        <div class="ep-mobile-actions"><p class="ep-mobile-no-media item_container-text">{t('episode.this_item_contains_no_media')}</p></div>
      {/if}
      <div class="ep-mobile-desc episode-single-desc episode-description">{@render notes()}</div>
    </div>
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="episode-layout-container">
      <div class="ep-hero">
        <div class="ep-hero-cover" onclick={openPodcast} title={ep.podcastname}>
          <FallbackImage src={ep.episodeartwork} fallback={DEFAULT_EPISODE_ART} alt="{t('episode.cover_alt_text')}{ep.episodeartwork}" class="ep-hero-cover-img" />
        </div>
        <div class="ep-hero-body">
          <div class="ep-hero-show" onclick={openPodcast}><i class="ph ph-microphone-stage"></i><span>{ep.podcastname}</span></div>
          <h1 class="ep-hero-title">{ep.episodetitle}</h1>
          <div class="ep-hero-meta">
            <span><i class="ph ph-calendar-blank"></i>{release}</span>
            <span class="ep-meta-dot">•</span>
            <span><i class="ph ph-clock"></i>{duration}</span>
            {#if completed}
              <span class="ep-meta-dot">•</span>
              <span class="ep-meta-played"><i class="ph ph-check-circle"></i>{t('episode.played')}</span>
            {/if}
          </div>
          {@render progressBar()}
          <div class="ep-hero-actions">
            {#if hasMedia}
              <button onclick={play} class="ep-hero-play" title={isPlaying ? t('episode.pause') : t('episode.play')}>
                <i class="ph {isPlaying ? 'ph-pause' : 'ph-play'}"></i>
                <span>{isPlaying ? t('episode.pause') : t('episode.play')}</span>
              </button>
              {#if inDb}
                <button
                  onclick={() => A.toggleQueue(ep)}
                  class="ep-action {queued ? 'is-active' : ''}"
                  title={queued ? t('episode.remove_from_queue') : t('episode.add_to_queue')}
                >
                  <i class="ph ph-queue"></i><span>{queued ? t('episode.remove_from_queue') : t('episode.add_to_queue')}</span>
                </button>
                <button onclick={() => A.toggleSave(ep)} class="ep-action {saved ? 'is-active' : ''}" title={saved ? t('episode.unsave') : t('episode.save')}>
                  <i class="ph {saved ? 'ph-heart-break' : 'ph-heart'}"></i><span>{saved ? t('episode.unsave') : t('episode.save')}</span>
                </button>
                <button
                  onclick={() => A.toggleDownload(ep)}
                  class="ep-action {downloaded ? 'is-active' : ''}"
                  title={downloaded ? t('episode.remove_download') : t('episode.download')}
                >
                  <i class="ph {downloaded ? 'ph-trash' : 'ph-download'}"></i><span>{downloaded ? t('episode.remove_download') : t('episode.download')}</span>
                </button>
                <button
                  onclick={() => A.toggleComplete(ep)}
                  class="ep-action {completed ? 'is-active' : ''}"
                  title={completed ? t('episode.mark_episode_incomplete') : t('episode.mark_episode_complete')}
                >
                  <i class="ph {completed ? 'ph-x-circle' : 'ph-check-fat'}"></i>
                  <span>{completed ? t('episode.mark_episode_incomplete') : t('episode.mark_episode_complete')}</span>
                </button>
              {:else}
                <span class="ep-actions-note item_container-text">{t('episode.add_podcast_to_enable_actions')}</span>
              {/if}
            {:else}
              <span class="ep-actions-note item_container-text">{t('episode.this_item_contains_no_media')}</span>
            {/if}
            <button class="ep-action" onclick={downloadFile} disabled={downloading} title={t('episode.download_episode')}>
              <i class="ph {downloading ? 'ph-spinner animate-spin' : 'ph-download-simple'}"></i>
              <span>{downloading ? t('episode.downloading') : t('episode.download_episode')}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="ep-tabs" role="tablist">
        <button class="ep-tab {tab === 'notes' ? 'is-active' : ''}" onclick={() => (tab = 'notes')}>
          <i class="ph ph-note"></i><span>{t('episode.episode_notes')}</span>
        </button>
        {#if chapters.length}
          <button class="ep-tab {tab === 'chapters' ? 'is-active' : ''}" onclick={() => (tab = 'chapters')}>
            <i class="ph ph-list-numbers"></i><span>{t('audio.chapters')}</span><span class="ep-tab-badge">{chapters.length}</span>
          </button>
        {/if}
      </div>

      {#if tab === 'chapters' && chapters.length}
        <div class="ep-pane">
          <ol class="ep-chapters">
            {#each chapterRows as row}
              <li class="ep-chapter {row.isCurrent ? 'is-current' : ''}" onclick={() => jumpTo(row.start, row.isActivePlaying)} title={row.c.title}>
                <span class="ep-chapter-play"><i class="ph {row.isActivePlaying ? 'ph-pause' : 'ph-play'}"></i></span>
                <span class="ep-chapter-num">{String(row.i + 1).padStart(2, '0')}</span>
                {#if row.c.img}<img src={E.proxiedImage(row.c.img)} class="ep-chapter-thumb" alt="" />{/if}
                <span class="ep-chapter-title">{row.c.title}</span>
                <span class="ep-chapter-time">{formatTime(row.start)}</span>
              </li>
            {/each}
          </ol>
        </div>
      {:else}
        <div class="ep-pane ep-about">{@render notes()}</div>
      {/if}
    </div>
  {/if}
</div>
