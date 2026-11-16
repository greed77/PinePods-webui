<script lang="ts">
  // Port of upstream pages/history.rs: server-sorted/filtered listening history
  // with a client-side search over what's loaded.
  import * as E from '$lib/api/endpoints';
  import { favorites } from '$lib/stores/favorites.svelte';
  import { getPref, setPref } from '$lib/util/prefs';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import PagedEpisodes from '$lib/components/PagedEpisodes.svelte';
  import SortSelect from '$lib/components/SortSelect.svelte';

  favorites.ensure();
  let sort = $state(getPref('history', 'newest'));
  let filter = $state(getPref('history_filter', 'all'));
  let search = $state('');

  function setFilter(next: string) {
    filter = filter === next ? 'all' : next;
    setPref('history_filter', filter);
  }

  const matches = (title: string, desc: string) => {
    const q = search.toLowerCase();
    return !q || title.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  };
</script>

<div class="main-container">
  <TopBar />
  <div class="pfb-section">
    <div class="pfb-bar">
      <div class="sp-input">
        <i class="ph ph-clock-counter-clockwise sp-search-ico"></i>
        <input type="text" placeholder={t('history.search_listening_history')} bind:value={search} />
      </div>
      <SortSelect bind:value={sort} onchange={(v) => setPref('history', v)} />
    </div>
    <div class="sp-chips pfb-chips">
      <button
        class="sp-chip"
        onclick={() => {
          filter = 'all';
          setPref('history_filter', 'all');
        }}><i class="ph ph-broom"></i><span>{t('downloads.clear_all')}</span></button
      >
      <button class="sp-chip {filter === 'completed' ? 'is-active' : ''}" onclick={() => setFilter('completed')}>
        <i class="ph ph-check-circle"></i><span>{t('downloads.completed')}</span>
      </button>
      <button class="sp-chip {filter === 'in_progress' ? 'is-active' : ''}" onclick={() => setFilter('in_progress')}>
        <i class="ph ph-hourglass-medium"></i><span>{t('downloads.in_progress')}</span>
      </button>
    </div>
  </div>
  <PagedEpisodes
    load={(offset) => E.getHistory(50, offset, sort, filter)}
    key={`${sort}|${filter}`}
    filter={(e) => favorites.allows(e.podcastid) && matches(e.episodetitle, e.episodedescription)}
    emptyHeader={t('history.no_episode_history_found')}
    emptyText={t('history.no_episode_history_description')}
  />
</div>
