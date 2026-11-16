<script lang="ts">
  // Port of upstream components/episode_list_item.rs.
  import { goto } from '$app/navigation';
  import type { Episode } from '$lib/api/endpoints';
  import { episodeStatus } from '$lib/stores/app.svelte';
  import { player } from '$lib/player/player.svelte';
  import { formatDateTime, formatTime, sanitizeNoImages } from '$lib/util/format';
  import { t } from '$lib/i18n/index.svelte';
  import FallbackImage, { DEFAULT_EPISODE_ART } from './FallbackImage.svelte';
  import ContextMenu, { type PageType } from './ContextMenu.svelte';
  import EpisodeModal from './EpisodeModal.svelte';

  let {
    episode,
    pageType = 'default',
    selectMode = false,
    selected = false,
    onselect,
    onselectabove,
    onselectbelow,
    drag
  }: {
    episode: Episode;
    pageType?: PageType;
    selectMode?: boolean;
    selected?: boolean;
    onselect?: (id: number) => void;
    onselectabove?: (id: number) => void;
    onselectbelow?: (id: number) => void;
    /** Drag-to-reorder handlers (queue page). */
    drag?: { start: (e: DragEvent) => void; enter: (e: DragEvent) => void; over: (e: DragEvent) => void; drop: (e: DragEvent) => void };
  } = $props();

  const id = $derived(episode.episodeid);
  const completed = $derived(episodeStatus.completed.has(id));
  const isCurrent = $derived(player.current?.episode.episodeid === id && id !== 0);
  const isPlaying = $derived(isCurrent && player.playing);
  const isLoading = $derived(player.loadingId === id && id !== 0);
  const narrow = typeof window !== 'undefined' && window.innerWidth < 500;

  const pubDate = $derived(formatDateTime(episode.episodepubdate));
  const description = $derived(sanitizeNoImages(episode.episodedescription));
  const progress = $derived(
    episode.listenduration > 0 && episode.episodeduration > 0
      ? Math.min(100, Math.floor((episode.listenduration * 100) / episode.episodeduration))
      : 0
  );
  const canMenu = $derived(id > 0);

  let showModal = $state(false);
  let pressAt = $state<{ x: number; y: number } | null>(null);
  let pressing = $state(false);
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let pressStart = { x: 0, y: 0 };

  function touchStart(e: TouchEvent) {
    if (!canMenu) return;
    const tch = e.touches[0];
    pressStart = { x: tch.clientX, y: tch.clientY };
    pressing = true;
    pressTimer = setTimeout(() => {
      pressing = false;
      pressAt = { x: pressStart.x, y: pressStart.y };
    }, 600);
  }
  function touchEnd() {
    clearTimeout(pressTimer);
    pressing = false;
  }
  function touchMove(e: TouchEvent) {
    const tch = e.touches[0];
    if (Math.abs(tch.clientX - pressStart.x) > 10 || Math.abs(tch.clientY - pressStart.y) > 10) touchEnd();
  }

  function openEpisodePage() {
    if (id > 0) goto(`/episode/${id}${episode.is_youtube ? '?youtube=true' : ''}`);
  }

  function playPause(e: MouseEvent) {
    e.stopPropagation();
    if (isCurrent) player.toggle();
    else player.play(episode);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div>
  <div
    class="ep-row {pressing ? 'ep-row--pressing' : ''} {selectMode ? 'ep-row--select' : ''}"
    style="user-select: {pressing ? 'none' : 'auto'};"
    ontouchstart={touchStart}
    ontouchend={touchEnd}
    ontouchmove={touchMove}
    draggable={drag ? 'true' : 'false'}
    ondragstart={drag?.start}
    ondragenter={drag?.enter}
    ondragover={drag?.over}
    ondrop={drag?.drop}
    data-id={id}
  >
    {#if drag}
      <div class="drag-handle-wrapper flex items-center justify-center w-10 h-full touch-none">
        <button class="drag-handle cursor-grab" aria-label="Drag to reorder"><i class="ph ph-dots-six-vertical"></i></button>
      </div>
    {/if}

    {#if selectMode}
      <div class="ep-select-col">
        <button class="ep-range-btn" onclick={() => onselectabove?.(id)} title="Select all above"><i class="ph ph-caret-up"></i></button>
        <input
          type="checkbox"
          checked={selected}
          class="podcast-dropdown-checkbox h-5 w-5 rounded border-2 cursor-pointer"
          onchange={() => onselect?.(id)}
        />
        <button class="ep-range-btn" onclick={() => onselectbelow?.(id)} title="Select all below"><i class="ph ph-caret-down"></i></button>
      </div>
    {/if}

    <div class="ep-art-wrap">
      <FallbackImage
        src={episode.episodeartwork || episode.artworkurl}
        fallback={DEFAULT_EPISODE_ART}
        alt="Cover for {episode.episodetitle}"
        class="ep-art-img"
      />
      {#if completed}
        <div class="ep-art-badge"><i class="ph ph-check-circle"></i></div>
      {/if}
    </div>

    <div class="ep-body">
      <div class="ep-title cursor-pointer" onclick={openEpisodePage}>{episode.episodetitle}</div>
      <hr class="ep-divider" />
      <div
        class="ep-desc cursor-pointer"
        onclick={(e) => {
          e.preventDefault();
          showModal = true;
        }}
      >
        {@html description}
      </div>
      <div class="ep-meta">
        <span>{pubDate}</span>
        {#if completed}
          <span>{narrow ? t('episode_list_item.completed') : `${formatTime(episode.episodeduration)} — ${t('episode_list_item.completed')}`}</span>
        {:else if episode.listenduration > 0}
          <div class="ep-progress"><div class="ep-progress-fill" style="width: {progress}%;"></div></div>
          <span>{formatTime(episode.episodeduration)}</span>
        {:else}
          <span>{formatTime(episode.episodeduration)}</span>
        {/if}
      </div>
    </div>

    {#if episode.episodeurl}
      <div class="ep-actions">
        <button class="ico" onclick={playPause} title="Play / Pause">
          {#if isLoading}
            <i class="ph ph-spinner" style="animation: spin 1s linear infinite;"></i>
          {:else if isPlaying}
            <i class="ph ph-pause"></i>
          {:else}
            <i class="ph ph-play"></i>
          {/if}
        </button>
        {#if canMenu}
          <ContextMenu {episode} {pageType} />
        {/if}
      </div>
    {/if}
  </div>

  {#if pressAt && canMenu}
    <ContextMenu {episode} {pageType} at={pressAt} onclose={() => (pressAt = null)} />
  {/if}

  {#if showModal}
    <EpisodeModal
      artwork={episode.episodeartwork}
      title={episode.episodetitle}
      description={description}
      release={pubDate}
      duration={episode.episodeduration}
      {progress}
      onclose={() => (showModal = false)}
      onshownotes={() => {
        showModal = false;
        openEpisodePage();
      }}
    />
  {/if}
</div>
