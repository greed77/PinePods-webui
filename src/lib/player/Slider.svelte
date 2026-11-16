<script lang="ts">
  // Port of upstream player_ui.rs Slider: pointer-driven, thickens while held.
  let {
    value,
    min,
    max,
    step,
    oninput,
    label,
    valueText,
    class: klass = ''
  }: {
    value: number;
    min: number;
    max: number;
    step: number;
    oninput: (v: number) => void;
    label: string;
    valueText?: string;
    class?: string;
  } = $props();

  let track: HTMLDivElement;
  let held = $state(false);
  const snap = (raw: number) => Math.round(Math.min(max, Math.max(min, min + Math.round((raw - min) / step) * step)) * 1000) / 1000;
  const emitAt = (x: number) => {
    const r = track.getBoundingClientRect();
    const f = r.width > 0 ? Math.min(1, Math.max(0, (x - r.left) / r.width)) : 0;
    oninput(snap(min + f * (max - min)));
  };
  const p = $derived(max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0);

  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    held = true;
    emitAt(e.clientX);
  }
  function keydown(e: KeyboardEvent) {
    const next =
      e.key === 'ArrowLeft' || e.key === 'ArrowDown'
        ? value - step
        : e.key === 'ArrowRight' || e.key === 'ArrowUp'
          ? value + step
          : e.key === 'Home'
            ? min
            : e.key === 'End'
              ? max
              : null;
    if (next == null) return;
    e.preventDefault();
    e.stopPropagation();
    oninput(snap(next));
  }
</script>

<div
  bind:this={track}
  class="pp-slider {held ? 'is-held' : ''} {klass}"
  style="--p: {p.toFixed(4)}"
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
  aria-valuetext={valueText}
  onpointerdown={down}
  onpointermove={(e) => {
    if (held) {
      e.preventDefault();
      emitAt(e.clientX);
    }
  }}
  onpointerup={() => (held = false)}
  onpointercancel={() => (held = false)}
  onkeydown={keydown}
>
  <div class="pp-slider-track"><div class="pp-slider-fill"></div></div>
  <div class="pp-slider-thumb-rail"><div class="pp-slider-thumb"></div></div>
</div>
