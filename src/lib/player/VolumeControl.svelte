<script lang="ts">
  import Slider from './Slider.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { volume, onchange, class: klass = '' }: { volume: number; onchange: (v: number) => void; class?: string } = $props();

  // Muting remembers the level to come back to.
  let restore = 100;
  $effect(() => {
    if (volume > 0) restore = volume;
  });
  const icon = $derived(volume <= 0 ? 'ph-speaker-x' : volume < 34 ? 'ph-speaker-none' : volume < 67 ? 'ph-speaker-low' : 'ph-speaker-high');
</script>

<div class="pp-volume {klass}">
  <button
    type="button"
    class="player-btn"
    onclick={(e) => {
      e.stopPropagation();
      onchange(volume > 0 ? 0 : Math.max(restore, 10));
    }}
    title={volume > 0 ? t('audio.mute') : t('audio.unmute')}
  >
    <i class="ph {icon}"></i>
  </button>
  <Slider value={volume} min={0} max={100} step={1} oninput={onchange} label={t('audio.volume')} valueText="{Math.round(volume)}%" class="pp-volume-slider" />
</div>
