<script lang="ts">
  // Port of upstream components/queue_panel.rs (the slide-out "Up next" panel).
  // The "manage queue" modal comes in a later stage.
  import { goto } from '$app/navigation';
  import { ui } from '$lib/stores/app.svelte';
  import { queue } from '$lib/stores/queue.svelte';
  import { player } from '$lib/player/player.svelte';
  import { formatTime } from '$lib/util/format';
  import { t } from '$lib/i18n/index.svelte';
  import FallbackImage, { DEFAULT_EPISODE_ART } from './FallbackImage.svelte';
  import type { Episode } from '$lib/api/endpoints';

  const open = $derived(ui.queuePanelOpen);
  let dragging = $state<number | null>(null);

  $effect(() => {
    ui.queueVersion;
    if (open) queue.refresh();
  });

  const close = () => (ui.queuePanelOpen = false);
  const n = $derived(queue.episodes.length);

  function artClick(e: MouseEvent, ep: Episode) {
    e.stopPropagation();
    const isCurrent = player.current?.episode.episodeid === ep.episodeid;
    if (!isCurrent) close();
    if (isCurrent) player.toggle();
    else player.play(ep);
  }

  function titleClick(e: MouseEvent, ep: Episode) {
    e.stopPropagation();
    close();
    goto(`/episode/${ep.episodeid}${ep.is_youtube ? '?youtube=true' : ''}`);
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    const from = dragging;
    dragging = null;
    const target = (e.target as Element).closest('[data-id]');
    const to = Number(target?.getAttribute('data-id'));
    if (from != null && to && to !== from) queue.move(from, to);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="queue-scrim {open ? 'is-open' : ''}" onclick={close}></div>
<aside class="queue-panel {open ? 'is-open' : ''}" aria-label="Queue">
  <div class="queue-head">
    <div>
      <div class="queue-title">{t('queue_panel.up_next')}</div>
      <div class="queue-sub">{n} episode{n === 1 ? '' : 's'} · {queue.totalLabel}</div>
    </div>
    <div class="queue-head-actions">
      <button class="player-btn" onclick={() => queue.clear()} title="Clear queue"><i class="ph ph-broom"></i></button>
      <button class="player-btn" onclick={close} title="Close"><i class="ph ph-x"></i></button>
    </div>
  </div>

  {#if player.current}
    <div class="queue-nowplaying">
      <FallbackImage src={player.current.artworkUrl} fallback={DEFAULT_EPISODE_ART} alt="Now playing art" class="queue-nowplaying-art" />
      <div style="min-width: 0; flex: 1;">
        <div class="queue-now-eyebrow">{t('queue_panel.now_playing')}</div>
        <div class="queue-now-title">{player.current.title}</div>
      </div>
      {#if player.playing}
        <div class="queue-now-equalizer" aria-hidden="true"><span></span><span></span><span></span></div>
      {/if}
    </div>
  {/if}

  <div class="queue-list">
    {#if n === 0}
      <div class="queue-empty">
        <i class="ph ph-queue"></i>
        <div class="queue-empty-title">{t('queue_panel.queue_is_empty')}</div>
        <div class="queue-empty-sub">{t('queue_panel.add_episodes_hint')}</div>
      </div>
    {:else}
      {#each queue.episodes as ep (ep.episodeid)}
        {@const thisPlaying = player.current?.episode.episodeid === ep.episodeid && player.playing}
        <div
          class="queue-item {dragging === ep.episodeid ? 'is-dragging' : ''}"
          data-id={ep.episodeid}
          draggable="true"
          ondragstart={(e) => {
            dragging = ep.episodeid;
            e.dataTransfer?.setData('text/plain', String(ep.episodeid));
          }}
          ondragover={(e) => e.preventDefault()}
          ondragend={() => (dragging = null)}
          ondrop={drop}
        >
          <div class="queue-drag-handle"><i class="ph ph-dots-six-vertical"></i></div>
          <div class="queue-item-art-wrap" onclick={(e) => artClick(e, ep)}>
            <FallbackImage src={ep.episodeartwork} fallback={DEFAULT_EPISODE_ART} alt="Episode art" class="queue-item-art" />
            <div class="queue-item-art-overlay {thisPlaying ? 'is-playing' : ''}">
              <i class="ph {thisPlaying ? 'ph-pause' : 'ph-play'}"></i>
            </div>
          </div>
          <div class="queue-item-body">
            <div class="queue-item-title queue-item-title-link" onclick={(e) => titleClick(e, ep)}>{ep.episodetitle}</div>
            <div class="queue-item-sub"><span>{formatTime(ep.episodeduration)}</span></div>
          </div>
          <button
            class="queue-item-remove"
            onclick={(e) => {
              e.stopPropagation();
              queue.remove(ep);
            }}
            title="Remove"><i class="ph ph-x"></i></button
          >
        </div>
      {/each}
    {/if}
  </div>
</aside>
