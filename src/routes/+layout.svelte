<script lang="ts">
  import '../app.css';
  import { session } from '$lib/stores/session.svelte';
  import { changeTheme } from '$lib/theme/themes.js';
  import Toast from '$lib/components/Toast.svelte';

  let { children } = $props();

  session.load();
  // Same default as upstream initialize_default_theme().
  try {
    const theme = localStorage.getItem('selected_theme') || 'Nordic';
    localStorage.setItem('selected_theme', theme);
    changeTheme(theme);
  } catch {
    changeTheme('Nordic');
  }
</script>

{@render children()}
<Toast />
