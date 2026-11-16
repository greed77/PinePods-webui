<script lang="ts">
  // Port of upstream components/audio.rs AudioPlayer markup: the bottom bar, the
  // full-screen sheet, the chapter list and the show-notes modal.
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { player } from './player.svelte';
  import { createSheetDrag } from './sheetDrag';
  import SeekBar from './SeekBar.svelte';
  import ProgressLine from './ProgressLine.svelte';
  import SpeedControl from './SpeedControl.svelte';
  import VolumeControl from './VolumeControl.svelte';
  import FallbackImage, { DEFAULT_EPISODE_ART } from '$lib/components/FallbackImage.svelte';
  import EpisodeModal from '$lib/components/EpisodeModal.svelte';
  import { ui } from '$lib/stores/app.svelte';
  import { formatDateTime, formatTimeRmHour } from '$lib/util/format';
  import { t } from '$lib/i18n/index.svelte';

  let sheet: HTMLDivElement | undefined = $state();
  let videoMount: HTMLDivElement | undefined = $state();
  let showNotes = $state(false);
  let showChapters = $state(false);

  const drag = createSheetDrag(
    () => sheet,
    () => player.expanded,
    (v) => (player.expanded = v)
  );
  onDestroy(drag.destroy);

  const cur = $derived(player.current);
  const playing = $derived(player.playing);
  const chapterMarks = $derived<[number, string][]>(
    (player.chapters ?? []).filter((c) => c.startTime != null).map((c) => [Number(c.startTime), c.title])
  );
  const podcastName = $derived(cur?.episode.podcastname.trim() ?? '');
  const playLabel = $derived(playing ? t('episode.pause') : t('episode.play'));

  // Chapter artwork replaces the cover while that chapter plays.
  const art = $derived.by(() => {
    if (!cur) return '';
    const now = player.currentTime;
    const ch = [...(player.chapters ?? [])].reverse().find((c) => c.startTime != null && Number(c.startTime) <= now);
    return ch?.img || cur.artworkUrl;
  });

  // Pages pad their bottom so the bar doesn't cover content.
  $effect(() => {
    document.body.classList.toggle('audio-player-active', !!cur);
    return () => document.body.classList.remove('audio-player-active');
  });

  // Show the video element in the full player.
  $effect(() => {
    if (player.expanded && cur?.isVideo && videoMount && player.media instanceof HTMLVideoElement) {
      const v = player.media;
      v.controls = true;
      v.style.cssText = 'width: 100%; max-height: 400px;';
      videoMount.replaceChildren(v);
    }
  });

  onMount(() => {
    // Space plays/pauses, arrows skip 15s, Escape closes the full player.
    const onKey = (e: KeyboardEvent) => {
      if (!player.current || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (el && (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable)) return;
      if (e.key === ' ') {
        e.preventDefault();
        player.toggle();
      } else if (e.key === 'ArrowRight' && !e.shiftKey) {
        e.preventDefault();
        player.seekBy(15);
      } else if (e.key === 'ArrowLeft' && !e.shiftKey) {
        e.preventDefault();
        player.seekBy(-15);
      } else if (e.key === 'Escape' && player.expanded) player.expanded = false;
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  function toggleExpanded() {
    player.expanded = !player.expanded;
    sheet?.scrollIntoView();
  }

  function openPodcast(e: MouseEvent) {
    e.stopPropagation();
    if (!cur?.episode.podcastid) return;
    player.expanded = false;
    goto(`/podcast/${cur.episode.podcastid}`);
  }

  function goToEpisode() {
    if (!cur) return;
    showNotes = false;
    player.expanded = false;
    goto(`/episode/${cur.episode.episodeid}${cur.isYoutube ? '?youtube=true' : ''}`);
  }

  // Line-for-line port of the chapter list's progress logic.
  function chapterRows() {
    const chs = player.chapters ?? [];
    const now = player.currentTime;
    return chs.map((c, i) => {
      const start = Number(c.startTime ?? 0);
      const end = i < chs.length - 1 ? Number(chs[i + 1].startTime ?? 0) : (cur?.durationSec ?? 0);
      const isCurrent = now >= start && now < end;
      const progress = isCurrent ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : now >= end ? 100 : 0;
      return { title: c.title, start, isCurrent, progress };
    });
  }
</script>

{#snippet playIcon(on: boolean)}
  {#if on}
    <svg class="pp-play-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
    </svg>
  {:else}
    <svg class="pp-play-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.6v12.8c0 .9 1 1.5 1.8 1l10-6.4a1.2 1.2 0 0 0 0-2l-10-6.4C9 4.1 8 4.7 8 5.6z" />
    </svg>
  {/if}
{/snippet}

{#if cur}
  {#if showChapters}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="chapter-select-modal fixed top-0 right-0 left-0 flex justify-center items-center w-full h-[calc(100%-1rem)] max-h-full bg-black bg-opacity-25"
      onclick={() => (showChapters = false)}
    >
      <div class="modal-container relative p-4 w-full max-w-md max-h-full rounded-lg shadow" onclick={(e) => e.stopPropagation()}>
        <div class="modal-container relative rounded-lg shadow">
          <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
            <h3 class="text-xl font-semibold">{t('audio.chapters')}</h3>
            <button
              onclick={() => (showChapters = false)}
              class="end-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center"
            >
              <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
              </svg>
              <span class="sr-only">{t('common.close_modal')}</span>
            </button>
          </div>
          <div class="p-4 md:p-5 max-h-[70vh] overflow-y-auto">
            {#if player.chapters?.length}
              {#each chapterRows() as row}
                {@const go = (e: MouseEvent) => {
                  e.stopPropagation();
                  if (row.isCurrent) player.toggle();
                  else player.seekTo(row.start);
                }}
                <div class="chapter-item {row.isCurrent ? 'current-chapter' : ''}" onclick={go}>
                  <button class="chapter-play-button" onclick={go}>
                    <i class="ph {row.isCurrent && playing ? 'ph-pause' : 'ph-play'} text-xl"></i>
                  </button>
                  <div class="chapter-info">
                    <span class="chapter-title">{row.title}</span>
                    <span class="chapter-time">{formatTimeRmHour(row.start)}</span>
                    <div class="chapter-progress-container">
                      <div class="chapter-progress-bar" style="width: {row.progress}%"></div>
                    </div>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="text-center p-4">{t('audio.no_chapters_available')}</div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <div
    bind:this={sheet}
    class="audio-player border border-solid border-color fixed bottom-0 z-50 w-full {player.expanded ? 'expanded' : ''} {playing ? 'is-playing' : ''}"
  >
    <div class="player-fs-backdrop" style="background-image: url('{cur.artworkUrl}');"></div>
    <div class="player-fs-overlay"></div>

    <div class="player-fs">
      <div class="player-fs-topbar pp-drag-zone" {...drag.handlers}>
        <span class="pp-grabber" aria-hidden="true"></span>
        <button onclick={toggleExpanded} class="player-btn" title="Close player">
          <i class="ph ph-caret-down" style="font-size:24px;"></i>
        </button>
        <span class="player-fs-eyebrow">{t('audio.now_playing')}</span>
        <div class="player-fs-topbar-right">
          <button onclick={() => (ui.queuePanelOpen = !ui.queuePanelOpen)} class="player-btn" title="Queue">
            <i class="ph ph-queue" style="font-size:22px;"></i>
          </button>
        </div>
      </div>

      <div class="player-fs-main">
        {#if cur.isVideo}
          <div class="player-fs-cover-slot player-fs-cover-slot--video">
            <div
              bind:this={videoMount}
              id="video-player-mount"
              style="width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;"
            ></div>
          </div>
        {:else}
          <div class="player-fs-cover-slot pp-drag-zone {!playing ? 'is-paused' : ''}" {...drag.handlers}>
            <img src={art} alt="Album art" class="player-fs-art" draggable="false" />
          </div>
        {/if}

        <div class="player-fs-meta">
          {#if podcastName}
            {#if cur.episode.podcastid}
              <button type="button" class="player-fs-podcast pp-podcast-link" onclick={openPodcast} title="Go to podcast">{podcastName}</button>
            {:else}
              <div class="player-fs-podcast">{podcastName}</div>
            {/if}
          {/if}
          <div class="player-fs-title">{cur.title}</div>
        </div>

        <SeekBar duration={cur.durationSec} chapters={chapterMarks} stacked class="player-fs-seek" />

        <div class="player-fs-controls">
          <div class="player-fs-side-btns player-fs-side-btns--left">
            <button onclick={() => player.seekBy(-15)} class="player-fs-ctrl pp-skip" title="Back 15 seconds">
              <i class="ph ph-arrow-counter-clockwise"></i><span>15</span>
            </button>
          </div>
          <button onclick={() => player.toggle()} class="player-fs-ctrl player-fs-ctrl-big pp-play" title={playLabel} aria-label={playLabel}>
            {@render playIcon(playing)}
          </button>
          <div class="player-fs-side-btns">
            <button onclick={() => player.seekBy(15)} class="player-fs-ctrl pp-skip" title="Forward 15 seconds">
              <i class="ph ph-arrow-clockwise"></i><span>15</span>
            </button>
            <button onclick={() => player.skipToNext()} class="player-fs-ctrl" title="Next episode">
              <i class="ph ph-skip-forward"></i>
            </button>
          </div>
        </div>

        <div class="player-fs-footer">
          <SpeedControl speed={player.speed} onchange={(v) => player.setSpeed(v)} />
          <VolumeControl volume={player.volume} onchange={(v) => player.setVolume(v)} class="pp-hover-only" />
          {#if player.episodeInDb}
            <button onclick={() => (showNotes = true)} class="player-btn" title="Show notes"><i class="ph ph-article"></i></button>
            {#if chapterMarks.length}
              <button onclick={() => (showChapters = true)} class="player-btn" title="Chapters"><i class="ph ph-list-numbers"></i></button>
            {/if}
          {/if}
        </div>
      </div>
    </div>

    <div class="player-bar pp-drag-zone" {...drag.handlers}>
      <ProgressLine />
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="player-left" onclick={toggleExpanded} title="Open player">
        <div class="artwork-container">
          <FallbackImage src={cur.artworkUrl} fallback={DEFAULT_EPISODE_ART} alt="Cover for audio" class="artwork {playing ? 'playing' : ''}" />
        </div>
        <div class="player-info">
          <div class="player-title">{cur.title}</div>
          {#if podcastName}<div class="player-subtitle">{podcastName}</div>{/if}
        </div>
      </div>
      <div class="player-center">
        <div class="player-buttons">
          <button onclick={() => player.seekBy(-15)} class="player-btn pp-skip-sm" title="Back 15 seconds"><i class="ph ph-arrow-counter-clockwise"></i></button>
          <button onclick={() => player.toggle()} class="player-btn pp-play pp-play--sm" title={playLabel} aria-label={playLabel}>
            {@render playIcon(playing)}
          </button>
          <button onclick={() => player.seekBy(15)} class="player-btn pp-skip-sm" title="Forward 15 seconds"><i class="ph ph-arrow-clockwise"></i></button>
          <button onclick={() => player.skipToNext()} class="player-btn" title="Next episode"><i class="ph ph-skip-forward"></i></button>
        </div>
        <SeekBar duration={cur.durationSec} chapters={chapterMarks} class="player-bar-seek" />
      </div>
      <div class="player-right">
        <VolumeControl volume={player.volume} onchange={(v) => player.setVolume(v)} class="pp-hover-only pp-bar-volume" />
        <button onclick={() => player.toggle()} class="player-btn pp-play pp-play--sm pp-phone-only" title={playLabel} aria-label={playLabel}>
          {@render playIcon(playing)}
        </button>
        <button onclick={toggleExpanded} class="player-btn pp-expand" title="Open player"><i class="ph ph-caret-up"></i></button>
      </div>
    </div>
  </div>

  {#if showNotes}
    <EpisodeModal
      artwork={cur.artworkUrl}
      title={cur.title}
      description={cur.description}
      release={formatDateTime(cur.releaseDate)}
      duration={cur.durationSec}
      progress={cur.durationSec > 0 ? Math.round((player.currentTime / cur.durationSec) * 100) : 0}
      onclose={() => (showNotes = false)}
      onshownotes={goToEpisode}
    />
  {/if}
{/if}
