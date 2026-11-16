<script lang="ts">
  // The newest/oldest/shortest/longest/title sort dropdown upstream repeats per page.
  import { t } from '$lib/i18n/index.svelte';

  let { value = $bindable(), onchange, ns = 'common' }: { value: string; onchange?: (v: string) => void; ns?: string } = $props();

  const options = ['newest_first', 'oldest_first', 'shortest_first', 'longest_first', 'title_az', 'title_za'];
  const values = ['newest', 'oldest', 'shortest', 'longest', 'title_az', 'title_za'];
</script>

<div class="pfb-sort">
  <i class="ph ph-funnel pfb-sort-icon-mobile"></i>
  <select class="pfb-sort-select" bind:value onchange={() => onchange?.(value)}>
    {#each values as v, i}<option value={v}>{t(`${ns}.${options[i]}`)}</option>{/each}
  </select>
  <i class="ph ph-caret-down pfb-sort-arrow"></i>
</div>
