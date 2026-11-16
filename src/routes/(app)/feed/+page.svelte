<script lang="ts">
  // Port of upstream pages/feed.rs: recent episodes from subscribed podcasts.
  import * as E from '$lib/api/endpoints';
  import { ui } from '$lib/stores/app.svelte';
  import { favorites } from '$lib/stores/favorites.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import PagedEpisodes from '$lib/components/PagedEpisodes.svelte';

  favorites.ensure();
</script>

<div class="main-container">
  <TopBar />
  <PagedEpisodes
    load={(offset) => E.getRecentEpisodes(50, offset)}
    key={ui.feedVersion}
    filter={(e) => favorites.allows(e.podcastid)}
    emptyHeader={t('feed.no_recent_episodes_found')}
    emptyText={t('feed.no_recent_episodes_description')}
  />
</div>
