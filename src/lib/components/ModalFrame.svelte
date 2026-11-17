<script lang="ts">
  // The scrolling modal shell upstream repeats for its podcast option windows: a
  // titled header with a close button and a scrollable body. Escape or a click on
  // the backdrop closes it.
  import type { Snippet } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-[calc(100%-1rem)] max-h-full bg-black bg-opacity-25 py-8"
  onclick={(e) => e.target === e.currentTarget && onclose()}
>
  <div class="modal-container relative w-full max-w-md max-h-full rounded-lg shadow mx-4 overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
    <div class="modal-container relative rounded-lg shadow flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t flex-shrink-0">
        <h3 class="text-xl font-semibold">{title}</h3>
        <button
          type="button"
          onclick={onclose}
          class="end-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
          aria-label={t('episodes_layout.close_modal')}
        >
          <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
          </svg>
        </button>
      </div>
      <div class="p-4 md:p-5 overflow-y-auto flex-1">
        {@render children()}
      </div>
    </div>
  </div>
</div>
