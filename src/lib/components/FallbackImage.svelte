<script lang="ts" module>
  export const DEFAULT_PODCAST_ART = '/static/assets/default-podcast.png';
  export const DEFAULT_EPISODE_ART = '/static/assets/default-episode.png';
</script>

<script lang="ts">
  // Loads artwork directly; on failure retries through the server's image proxy,
  // then falls back to the default art (upstream gen_components FallbackImage).
  import { proxiedImage } from '$lib/api/endpoints';

  let {
    src,
    alt,
    class: klass = '',
    fallback = DEFAULT_PODCAST_ART,
    style = '',
    onclick
  }: {
    src: string | null | undefined;
    alt: string;
    class?: string;
    fallback?: string;
    style?: string;
    onclick?: (e: MouseEvent) => void;
  } = $props();

  let stage = $state(0);
  $effect(() => {
    src;
    stage = 0;
  });
  const shown = $derived(!src ? fallback : stage === 0 ? src : stage === 1 ? proxiedImage(src) : fallback);
  const onerror = () => {
    if (src && stage < 2) stage++;
  };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<img src={shown} {alt} class={klass} {style} loading="lazy" decoding="async" {onerror} {onclick} />
