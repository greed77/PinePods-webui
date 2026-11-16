<script lang="ts">
  // Port of upstream pages/playlists.rs IconSelector (also used for collections).
  import { ICONS } from '$lib/data/icons';

  let { value, onselect }: { value: string; onselect: (icon: string) => void } = $props();
  let open = $state(false);
</script>

<div class="relative">
  <button
    type="button"
    onclick={() => (open = !open)}
    class="search-bar-input border text-sm rounded-lg w-full p-2.5 flex items-center justify-between"
  >
    <div class="flex items-center">
      <i class="ph {value} text-2xl mr-2"></i>
      <span class="item_container-text">{value.replace('ph-', '')}</span>
    </div>
    <i class="ph ph-caret-down ml-2"></i>
  </button>
  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="absolute z-50 mt-1 w-full rounded-lg shadow-lg modal-container max-h-[400px] overflow-y-auto" onclick={() => (open = false)}>
      <div class="grid grid-cols-5 gap-2 p-3">
        {#each ICONS as icon}
          <button
            type="button"
            onclick={() => onselect(icon)}
            class="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700 {value === icon
              ? 'bg-gray-700 ring-2 ring-blue-500'
              : ''}"
            title={icon.replace('ph-', '')}
          >
            <i class="ph {icon} text-3xl"></i>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
