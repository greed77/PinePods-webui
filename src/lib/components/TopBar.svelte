<script lang="ts">
  // Port of upstream gen_components.rs Search_nav: the top bar with the queue
  // button and the "search new shows" box (desktop) / search takeover (mobile).
  // Search results, remote devices and the notification center come in stage 2.
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { toast, ui } from '$lib/stores/app.svelte';
  import { queue } from '$lib/stores/queue.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let value = $state('');
  let index = $state<'podcast_index' | 'itunes' | 'youtube'>('podcast_index');
  let isMobile = $state(false);
  let expanded = $state(false);
  let srcOpen = $state(false);
  let mobileInput: HTMLInputElement | undefined = $state();

  const display = $derived(({ podcast_index: 'Podcast Index', itunes: 'iTunes', youtube: 'YouTube' })[index]);
  const srcIcon = $derived(index === 'itunes' ? 'ph ph-apple-logo' : index === 'youtube' ? 'ph ph-youtube-logo' : 'ph ph-globe-hemisphere-west');
  const count = $derived(queue.episodes.length);

  onMount(() => {
    const check = () => {
      isMobile = innerWidth < 820;
      if (!isMobile) {
        expanded = false;
        srcOpen = false;
      }
    };
    check();
    addEventListener('resize', check);
    if (!queue.loaded) queue.refresh();
    return () => removeEventListener('resize', check);
  });

  $effect(() => {
    document.body.classList.toggle('search-takeover-open', expanded);
    if (expanded) setTimeout(() => mobileInput?.focus(), 60);
    return () => document.body.classList.remove('search-takeover-open');
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    expanded = false;
    const q = value.trim();
    if (!q) return;
    if (index === 'youtube') return goto(`/youtube_layout?q=${encodeURIComponent(q)}`);
    goto(`/search_results?q=${encodeURIComponent(q)}&index=${index}`);
  }

  function pick(v: typeof index) {
    index = v;
    srcOpen = false;
  }

  const toggleQueue = () => (ui.queuePanelOpen = !ui.queuePanelOpen);
</script>

{#snippet queueBtn()}
  <button type="button" class="iconbtn topbar-queue-btn" onclick={toggleQueue} title="Queue">
    <i class="ph ph-queue"></i>
    {#if count > 0}<span class="topbar-queue-badge">{count}</span>{/if}
  </button>
{/snippet}

{#snippet clearBtn()}
  {#if value}
    <button type="button" class="src-input-clear" onclick={() => (value = '')} aria-label="Clear"><i class="ph ph-x"></i></button>
  {/if}
{/snippet}

<div class="episodes-container w-full">
  <div class="topbar {expanded && isMobile ? 'is-expanded' : ''}">
    {#if !isMobile}
      <div class="topbar-left"></div>
      <form class="topbar-right" onsubmit={submit}>
        {@render queueBtn()}
        <div style="position: relative;">
          <button type="button" class="src-source" onclick={() => (srcOpen = !srcOpen)}>
            <span>{display}</span>
            <i class="ph ph-caret-down"></i>
          </button>
          {#if srcOpen}
            <div class="src-dropdown">
              <button type="button" class="src-dropdown-item {index === 'podcast_index' ? 'is-active' : ''}" onclick={() => pick('podcast_index')}
                >{t('gen_components.podcast_index')}</button
              >
              <button type="button" class="src-dropdown-item {index === 'itunes' ? 'is-active' : ''}" onclick={() => pick('itunes')}>iTunes</button>
              <button type="button" class="src-dropdown-item {index === 'youtube' ? 'is-active' : ''}" onclick={() => pick('youtube')}>YouTube</button>
            </div>
          {/if}
        </div>
        <div class="src-input">
          <input type="search" placeholder="Search New Shows…" bind:value />
          {@render clearBtn()}
        </div>
        <button type="submit" class="iconbtn" title="Search"><i class="ph ph-magnifying-glass"></i></button>
      </form>
    {:else if !expanded}
      <div class="topbar-left"></div>
      <div class="topbar-right">
        {@render queueBtn()}
        <button type="button" class="iconbtn search-trigger" onclick={() => (expanded = true)} title="Search" aria-label="Open search">
          <i class="ph ph-magnifying-glass"></i>
        </button>
      </div>
    {:else}
      <form
        class="topbar-search-takeover"
        onsubmit={submit}
        onkeydown={(e) => {
          if (e.key === 'Escape') {
            if (srcOpen) srcOpen = false;
            else expanded = false;
          }
        }}
      >
        <button
          type="button"
          class="iconbtn"
          onclick={() => {
            expanded = false;
            srcOpen = false;
          }}
          title="Close search"
          aria-label="Close search"><i class="ph ph-arrow-left"></i></button
        >
        <div style="position: relative;">
          <button
            type="button"
            class="src-source src-source-icon"
            onclick={() => (srcOpen = !srcOpen)}
            title="Search source: {display}. Click to change."
            aria-label="Search source: {display}. Click to change."
          >
            <i class={srcIcon}></i>
            <i class="ph ph-caret-down src-combined-caret"></i>
          </button>
          {#if srcOpen}
            <div class="src-menu src-menu-takeover" role="menu" tabindex="-1" onmouseleave={() => (srcOpen = false)}>
              <button type="button" class="src-menu-item {index === 'podcast_index' ? 'is-active' : ''}" onclick={() => pick('podcast_index')}>
                <i class="ph ph-globe-hemisphere-west"></i><span>{t('gen_components.podcast_index')}</span>
              </button>
              <button type="button" class="src-menu-item {index === 'itunes' ? 'is-active' : ''}" onclick={() => pick('itunes')}>
                <i class="ph ph-apple-logo"></i><span>iTunes</span>
              </button>
              <button type="button" class="src-menu-item {index === 'youtube' ? 'is-active' : ''}" onclick={() => pick('youtube')}>
                <i class="ph ph-youtube-logo"></i><span>YouTube</span>
              </button>
            </div>
          {/if}
        </div>
        <div class="src-input">
          <input bind:this={mobileInput} type="text" placeholder="Search {display}…" bind:value />
          {@render clearBtn()}
        </div>
        <button type="submit" class="iconbtn" title="Search" aria-label="Submit search"><i class="ph ph-magnifying-glass"></i></button>
      </form>
    {/if}
  </div>
</div>
