<script lang="ts">
  // Port of upstream pages/playlists.rs PodcastSelector: multi-select podcast dropdown.
  import type { Podcast } from '$lib/api/endpoints';
  import { t } from '$lib/i18n/index.svelte';
  import FallbackImage from './FallbackImage.svelte';

  let { selected = $bindable(), podcasts }: { selected: number[]; podcasts: Podcast[] } = $props();
  let open = $state(false);
  let root: HTMLDivElement;

  function toggle(id: number) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  }
</script>

<svelte:document onclick={(e) => open && !root.contains(e.target as Node) && (open = false)} />

<div class="relative" bind:this={root}>
  <button
    type="button"
    onclick={(e) => {
      e.stopPropagation();
      open = !open;
    }}
    class="search-bar-input border text-sm rounded-lg block w-full p-2.5 flex items-center"
  >
    <div class="flex items-center flex-grow">
      <span class="flex-grow text-left">
        {selected.length === 0
          ? t('playlists.filter_by_podcasts_optional')
          : `${selected.length} ${selected.length === 1 ? t('playlists.podcast') : t('playlists.podcasts')} ${t('playlists.selected')}`}
      </span>
      <i class="ph ph-caret-down transition-transform duration-200 {open ? 'rotate-180' : ''}"></i>
    </div>
  </button>
  {#if open}
    <div class="absolute z-50 mt-1 w-full rounded-lg shadow-lg modal-container">
      <div class="max-h-[400px] overflow-y-auto p-2 space-y-1">
        {#each podcasts as p (p.podcastid)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div
            onclick={() => toggle(p.podcastid)}
            class="flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors {selected.includes(p.podcastid) ? 'bg-gray-700' : ''}"
          >
            <FallbackImage src={p.artworkurl} alt="Cover for {p.podcastname}" class="w-12 h-12 rounded object-cover" />
            <span class="ml-3 flex-grow truncate">{p.podcastname}</span>
            {#if selected.includes(p.podcastid)}<i class="ph ph-check text-blue-500 text-xl"></i>{/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
