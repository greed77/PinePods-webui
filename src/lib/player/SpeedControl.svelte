<script lang="ts" module>
  export const SPEED_PRESETS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5];
  export function fmtSpeed(speed: number) {
    let s = speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    if (!s.includes('.')) s += '.0';
    return `${s}×`;
  }
</script>

<script lang="ts">
  import Slider from './Slider.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { speed, onchange }: { speed: number; onchange: (v: number) => void } = $props();
  let open = $state(false);
</script>

<div class="pp-speed">
  <button
    type="button"
    class="pp-pill {open ? 'is-open' : ''}"
    onclick={(e) => {
      e.stopPropagation();
      open = !open;
    }}
    title={t('audio.playback_speed')}
    aria-expanded={open}
  >
    <i class="ph ph-gauge"></i>
    <span>{fmtSpeed(speed)}</span>
  </button>
  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="pp-popover-scrim" onclick={() => (open = false)}></div>
    <div class="pp-popover" role="dialog" aria-label={t('audio.playback_speed')}>
      <div class="pp-popover-head">
        <span>{t('audio.speed')}</span>
        <span class="pp-popover-value">{fmtSpeed(speed)}</span>
      </div>
      <div class="pp-chips">
        {#each SPEED_PRESETS as p}
          <button type="button" class="pp-chip {Math.abs(p - speed) < 0.001 ? 'is-active' : ''}" onclick={() => onchange(p)}>{fmtSpeed(p)}</button>
        {/each}
      </div>
      <Slider value={speed} min={0.5} max={3.0} step={0.05} oninput={onchange} label={t('audio.playback_speed')} valueText={fmtSpeed(speed)} />
    </div>
  {/if}
</div>
