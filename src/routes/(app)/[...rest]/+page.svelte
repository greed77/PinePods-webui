<script lang="ts">
  // Pages from later build stages land here until they exist.
  import { page } from '$app/state';
  import TopBar from '$lib/components/TopBar.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
</script>

<div class="main-container">
  <TopBar />
  <EmptyMessage header="Not built yet" paragraph="{page.url.pathname} is part of a later stage of this UI. The stock Pinepods web UI still has it." />
</div>
