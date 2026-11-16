<script lang="ts">
  // Signed-in shell: verifies the stored key once, loads the user's settings, and
  // hosts the drawer, queue panel and player that persist across pages.
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { session } from '$lib/stores/session.svelte';
  import * as E from '$lib/api/endpoints';
  import { keyRejected, loadUserSettings } from '$lib/auth';
  import AppDrawer from '$lib/components/AppDrawer.svelte';
  import QueuePanel from '$lib/components/QueuePanel.svelte';
  import AudioPlayer from '$lib/player/AudioPlayer.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import CollectionPickerModal from '$lib/components/CollectionPickerModal.svelte';

  let { children } = $props();
  let ready = $state(false);

  onMount(async () => {
    if (!session.loggedIn) return toLogin();
    try {
      await E.verifyKey(session.apiKey);
    } catch (e) {
      // Keep the session through network errors; only a rejected key signs out.
      if (keyRejected(e)) {
        session.clear();
        return toLogin();
      }
      console.warn('Could not verify the stored key', e);
    }
    ready = true;
    loadUserSettings();
  });

  function toLogin() {
    try {
      sessionStorage.setItem('requested_route', page.url.pathname + page.url.search);
    } catch {
      /* ignore */
    }
    goto('/', { replaceState: true });
  }
</script>

{#if ready}
  {@render children()}
  <QueuePanel />
  <AppDrawer />
  <AudioPlayer />
  <CollectionPickerModal />
{:else}
  <Loading />
{/if}
