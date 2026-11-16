<script lang="ts">
  import FallbackImage, { DEFAULT_EPISODE_ART } from './FallbackImage.svelte';
  import { formatTime, sanitize } from '$lib/util/format';
  import { t } from '$lib/i18n/index.svelte';

  let {
    artwork,
    title,
    description,
    release,
    duration,
    progress,
    onclose,
    onshownotes
  }: {
    artwork: string;
    title: string;
    description: string;
    release: string;
    duration: number;
    progress: number;
    onclose: () => void;
    onshownotes: () => void;
  } = $props();

  function outside(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onclick={outside}>
  <div class="bg-custom-light dark:bg-custom-dark w-11/12 max-w-2xl rounded-lg shadow-xl max-h-[90vh] flex flex-col">
    <div class="flex items-start space-x-4 p-6 border-b border-custom-border">
      <FallbackImage src={artwork} fallback={DEFAULT_EPISODE_ART} alt="Episode artwork" class="w-32 h-32 rounded-lg object-cover flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold mb-2 item_container-text truncate">{title}</h2>
        <p class="item_container-text text-sm">{release}</p>
      </div>
      <button onclick={onclose} class="hover:opacity-75 flex-shrink-0 item_container-text" aria-label="Close">
        <i class="ph ph-arrow-u-left-down text-2xl"></i>
      </button>
    </div>

    <div class="flex-1 p-6 overflow-y-auto">
      <div class="prose dark:prose-invert item_container-text max-w-none">
        <div class="links-custom episode-description-container">
          {@html sanitize(description)}
        </div>
      </div>
    </div>

    <div class="flex justify-between items-center p-6 border-t border-custom-border mt-auto">
      <div class="flex items-center space-x-2">
        <span class="item_container-text">{formatTime(duration)}</span>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: {progress}%;"></div>
        </div>
      </div>
      <button onclick={onshownotes} class="bg-custom-primary hover:opacity-75 text-white px-4 py-2 rounded-lg">
        {t('gen_components.go_to_episode_page')}
      </button>
    </div>
  </div>
</div>
