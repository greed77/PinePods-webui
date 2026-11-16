<script lang="ts">
  // Thin progress line for the collapsed phone bar.
  import { onMount } from 'svelte';
  import { player } from './player.svelte';

  let el: HTMLDivElement;
  onMount(() => {
    let last = -1,
      raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const ph = player.playhead();
      if (!ph || !(Number.isFinite(ph.dur) && ph.dur > 0)) return;
      const p = Math.min(1, Math.max(0, ph.pos / ph.dur));
      if (Math.abs(p - last) > 0.0001) {
        last = p;
        el.style.setProperty('--p', p.toFixed(5));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div bind:this={el} class="pp-line" aria-hidden="true"><div class="pp-line-fill"></div></div>
