<script lang="ts">
  // Port of upstream player_ui.rs SeekBar: follows the playhead every frame via CSS
  // variables; drag or click to scrub, seeking once on release.
  import { onMount } from 'svelte';
  import { player } from './player.svelte';
  import { fmtTime } from '$lib/util/format';

  let {
    duration: fallbackDuration,
    chapters = [],
    stacked = false,
    class: klass = ''
  }: { duration: number; chapters?: [number, string][]; stacked?: boolean; class?: string } = $props();

  let root: HTMLDivElement;
  let track: HTMLDivElement;
  let scrub = $state<number | null>(null);
  let hover = $state<number | null>(null);
  let shownSec = $state(0);
  let mediaDur = $state(0);
  let remaining = $state(false);
  let dragging = false;

  const duration = $derived(mediaDur > 0 ? mediaDur : Math.max(0, fallbackDuration));
  const long = $derived(duration >= 3600);

  onMount(() => {
    let lastSec = -1,
      lastDur = -1,
      last = [-1, -1],
      raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const ph = player.playhead();
      if (!ph) return;
      const real = Number.isFinite(ph.dur) && ph.dur > 0;
      if (real && Math.abs(ph.dur - lastDur) > 0.5) {
        lastDur = ph.dur;
        mediaDur = ph.dur;
      } else if (!real && lastDur > 0) {
        lastDur = -1;
        mediaDur = 0;
      }
      const dur = real ? ph.dur : fallbackDuration;
      const sec = Math.floor(ph.pos);
      if (sec !== lastSec) {
        lastSec = sec;
        shownSec = sec;
      }
      if (dragging || dur <= 0) return;
      const p = clamp(ph.pos / dur),
        b = clamp(ph.buf / dur);
      if (Math.abs(p - last[0]) > 0.00005 || Math.abs(b - last[1]) > 0.001) {
        last = [p, b];
        root.style.setProperty('--p', p.toFixed(5));
        root.style.setProperty('--b', b.toFixed(5));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });

  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const fracAt = (x: number) => {
    const r = track.getBoundingClientRect();
    return r.width > 0 ? clamp((x - r.left) / r.width) : 0;
  };

  function begin(e: PointerEvent) {
    if (e.button !== 0 || duration <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    track.focus();
    const f = fracAt(e.clientX);
    dragging = true;
    root.style.setProperty('--p', f.toFixed(5));
    scrub = f * duration;
  }
  function move(e: PointerEvent) {
    const f = fracAt(e.clientX);
    if (dragging) {
      e.preventDefault();
      root.style.setProperty('--p', f.toFixed(5));
      scrub = f * duration;
    } else if (e.pointerType === 'mouse') hover = f;
  }
  function end(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    player.seekTo(fracAt(e.clientX) * duration);
    scrub = null;
    if (e.pointerType !== 'mouse') hover = null;
  }
  function cancel() {
    dragging = false;
    scrub = null;
  }
  function keydown(e: KeyboardEvent) {
    const steps: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -30, PageUp: 30 };
    if (e.key in steps) player.seekBy(steps[e.key]);
    else if (e.key === 'Home') player.seekTo(0);
    else if (e.key === 'End' && duration > 0) player.seekTo(duration - 1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  const current = $derived(scrub ?? shownSec);
  const curLabel = $derived(fmtTime(current, long));
  const endLabel = $derived(remaining ? `-${fmtTime(Math.max(0, duration - current), long)}` : fmtTime(duration, long));
  const bubble = $derived(scrub != null ? (duration > 0 ? scrub / duration : 0) : hover);
  const chapterAt = (tm: number) => [...chapters].reverse().find(([s]) => s <= tm)?.[1] || null;
</script>

{#snippet endButton()}
  <button
    type="button"
    class="pp-seek-time pp-seek-time--end"
    onclick={(e) => {
      e.stopPropagation();
      remaining = !remaining;
    }}
    title="Show remaining time">{endLabel}</button
  >
{/snippet}

<div bind:this={root} class="pp-seek {stacked ? 'pp-seek--stacked' : ''} {scrub != null ? 'is-scrubbing' : ''} {klass}">
  {#if !stacked}<span class="pp-seek-time">{curLabel}</span>{/if}
  <div
    bind:this={track}
    class="pp-seek-hit"
    role="slider"
    tabindex="0"
    aria-label="Seek"
    aria-valuemin={0}
    aria-valuemax={Math.round(duration)}
    aria-valuenow={Math.round(current)}
    aria-valuetext={curLabel}
    onpointerdown={begin}
    onpointermove={move}
    onpointerup={end}
    onpointercancel={cancel}
    onpointerleave={() => (hover = null)}
    onkeydown={keydown}
  >
    <div class="pp-seek-track">
      <div class="pp-seek-buffer"></div>
      {#if hover != null && scrub == null}
        <div class="pp-seek-ghost" style="transform: scaleX({hover.toFixed(4)})"></div>
      {/if}
      <div class="pp-seek-fill"></div>
      {#if duration > 0}
        {#each chapters.filter(([s]) => s > 0.5 && s < duration) as [s]}
          <span class="pp-seek-tick" style="left: {((s / duration) * 100).toFixed(3)}%"></span>
        {/each}
      {/if}
    </div>
    <div class="pp-seek-thumb-rail"><div class="pp-seek-thumb"></div></div>
    {#if bubble != null}
      {@const tm = bubble * duration}
      <div class="pp-seek-bubble" style="left: clamp(28px, {(bubble * 100).toFixed(3)}%, calc(100% - 28px))">
        <span class="pp-seek-bubble-time">{fmtTime(tm, long)}</span>
        {#if chapterAt(tm)}<span class="pp-seek-bubble-chapter">{chapterAt(tm)}</span>{/if}
      </div>
    {/if}
  </div>
  {#if stacked}
    <div class="pp-seek-times">
      <span class="pp-seek-time">{curLabel}</span>
      {@render endButton()}
    </div>
  {:else}
    {@render endButton()}
  {/if}
</div>
