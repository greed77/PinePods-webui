<script lang="ts" module>
  // Only one episode menu is open at a time across the page.
  let openId = $state<symbol | null>(null);
</script>

<script lang="ts">
  // Port of upstream components/context_menu_button.rs (server build). Collections
  // and "Play on" (remote devices) come in a later stage.
  import { tick } from 'svelte';
  import type { Episode } from '$lib/api/endpoints';
  import * as A from '$lib/episodeActions';
  import { t } from '$lib/i18n/index.svelte';

  export type PageType = 'default' | 'queue' | 'saved' | 'downloads';

  let {
    episode,
    pageType = 'default',
    /** Open at a point (long-press) instead of from the "…" button. */
    at = null,
    onclose
  }: { episode: Episode; pageType?: PageType; at?: { x: number; y: number } | null; onclose?: () => void } = $props();

  const id = Symbol();
  let button: HTMLButtonElement | undefined = $state();
  let menu: HTMLDivElement | undefined = $state();
  let place = $state<{ top: number; right: number } | null>(null);
  let flyout = $state<string | null>(null);
  const open = $derived(at ? true : openId === id && place !== null);

  async function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (openId === id) return close();
    openId = id;
    place = compute();
    await tick();
    place = compute(); // re-place once the menu's height is known (flip up near the bottom)
  }

  function compute() {
    if (!button) return null;
    const btn = button.getBoundingClientRect();
    const h = menu?.getBoundingClientRect().height ?? 0;
    const below = innerHeight - btn.bottom,
      above = btn.top;
    const top = h > 0 && h + 4 > below && above > below ? Math.max(btn.top - h - 4, 4) : btn.bottom + 4;
    return { top, right: btn.right };
  }

  function close() {
    if (openId === id) openId = null;
    place = null;
    flyout = null;
    onclose?.();
  }

  function act(fn: () => unknown) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      fn();
      close();
    };
  }

  function openFlyout(e: MouseEvent) {
    const row = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const right = row.right + 180 < innerWidth;
    flyout = `position: fixed; top: ${row.top}px; ${right ? `left: ${row.right}px` : `right: ${innerWidth - row.left}px`};`;
  }

  function onDocDown(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (menu?.contains(target) || button?.contains(target)) return;
    close();
  }

  const queued = $derived(A.isQueued(episode));
  const saved = $derived(A.isSaved(episode));
  const downloaded = $derived(A.isDownloaded(episode));
  const completed = $derived(A.isCompleted(episode));
</script>

<svelte:document onmousedown={onDocDown} ontouchstart={onDocDown as any} />
<svelte:window onscroll={() => open && !at && close()} onresize={() => open && close()} />

{#snippet items()}
  {#if pageType !== 'queue'}
    {#if queued}
      <li class="dropdown-option" onclick={act(() => A.removeFromQueue(episode))}>{t('context_menu_button.remove_from_queue')}</li>
    {:else}
      <li
        class="dropdown-option ep-context-has-flyout"
        onclick={act(() => A.addToQueue(episode))}
        onmouseenter={openFlyout}
        onmouseleave={() => (flyout = null)}
      >
        <span>{t('context_menu_button.queue_episode')}</span>
        <i
          class="ph ph-caret-right ep-context-flyout-caret"
          onclick={(e) => {
            e.stopPropagation();
            if (flyout) flyout = null;
            else openFlyout(e);
          }}
        ></i>
        {#if flyout}
          <ul class="ep-context-menu ep-context-menu-list ep-context-flyout" style={flyout}>
            <li class="dropdown-option" onclick={act(() => A.addToQueue(episode, 'top'))}>{t('context_menu_button.add_to_top_of_queue')}</li>
            <li class="dropdown-option" onclick={act(() => A.addToQueue(episode, 'bottom'))}>{t('context_menu_button.add_to_bottom_of_queue')}</li>
          </ul>
        {/if}
      </li>
    {/if}
  {/if}
  <li class="dropdown-option" onclick={act(() => A.toggleSave(episode))}>
    {saved ? t('context_menu_button.remove_from_saved_episodes') : t('context_menu_button.save_episode')}
  </li>
  {#if pageType === 'queue'}
    <li class="dropdown-option" onclick={act(() => A.removeFromQueue(episode))}>{t('context_menu_button.remove_from_queue')}</li>
  {/if}
  <li class="dropdown-option" onclick={act(() => A.toggleDownload(episode))}>
    {downloaded ? t('context_menu_button.remove_downloaded_episode') : t('context_menu_button.download_episode')}
  </li>
  <li class="dropdown-option" onclick={act(() => A.toggleComplete(episode))}>
    {completed ? t('context_menu_button.mark_episode_incomplete') : t('context_menu_button.mark_episode_complete')}
  </li>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions, a11y_no_static_element_interactions -->
<div class="context-button-wrapper">
  {#if !at}
    <button bind:this={button} onclick={toggle} class="ico" aria-label="Episode actions">
      <i class="ph ph-dots-three"></i>
    </button>
  {/if}
  {#if open}
    <div
      bind:this={menu}
      class="ep-context-menu"
      style={at ? `position: fixed; top: ${at.y}px; left: ${at.x}px;` : `position: fixed; top: ${place!.top}px; right: calc(100vw - ${place!.right}px);`}
      onmousedown={(e) => e.stopPropagation()}
    >
      <ul class="ep-context-menu-list">{@render items()}</ul>
    </div>
  {/if}
</div>
