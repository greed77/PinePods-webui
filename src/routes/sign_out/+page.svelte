<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { logout } from '$lib/auth';
  import { player } from '$lib/player/player.svelte';

  onMount(() => {
    player.stop();
    logout();
    goto('/', { replaceState: true });
  });
</script>
