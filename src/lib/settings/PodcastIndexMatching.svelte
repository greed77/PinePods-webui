<script lang="ts">
  // Port of upstream setting_components/podcast_index_matching.rs: podcasts without a
  // Podcast Index id. Clicking one searches the index by its name (or custom terms, or
  // takes an id directly); picking a result saves the match. Podcasts can be ignored.
  import * as E from '$lib/api/endpoints';
  import type { SearchPodcast, UnmatchedPodcast } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import FallbackImage from '$lib/components/FallbackImage.svelte';

  let unmatched = $state<UnmatchedPodcast[]>([]);
  let ignored = $state<UnmatchedPodcast[]>([]);
  let loading = $state(true);
  let selected = $state<number | null>(null);
  let results = $state<SearchPodcast[]>([]);
  let searching = $state(false);
  let showIgnored = $state(false);
  let terms = $state('');
  let manualId = $state('');
  let container: HTMLDivElement | undefined = $state();

  Promise.allSettled([E.getUnmatchedPodcasts().then((v) => (unmatched = v)), E.getIgnoredPodcasts().then((v) => (ignored = v))]).finally(
    () => (loading = false)
  );

  let searchSeq = 0;
  async function search(q: string) {
    const seq = ++searchSeq;
    searching = true;
    try {
      const r = await E.searchPodcasts(q, 'podcast_index');
      if (seq === searchSeq) results = r;
    } catch (e) {
      console.warn('Error searching Podcast Index', e);
    } finally {
      if (seq === searchSeq) searching = false;
    }
  }

  function open(p: UnmatchedPodcast) {
    results = [];
    terms = manualId = '';
    selected = p.podcast_id;
    search(p.podcast_name);
  }

  async function match(podcastId: number, indexId: number) {
    try {
      await E.updatePodcastIndexId(podcastId, indexId);
      unmatched = unmatched.filter((p) => p.podcast_id !== podcastId);
      selected = null;
      results = [];
      terms = manualId = '';
      toast.info('Podcast successfully matched to Podcast Index!');
    } catch (e) {
      toast.error(`Error updating podcast index ID: ${(e as Error).message}`);
    }
  }

  async function setIgnored(p: UnmatchedPodcast, ignore: boolean) {
    try {
      await E.ignorePodcastIndexId(p.podcast_id, ignore);
      if (ignore) {
        unmatched = unmatched.filter((x) => x.podcast_id !== p.podcast_id);
        ignored = [...ignored, p];
        toast.info('Podcast ignored from index matching');
      } else {
        ignored = ignored.filter((x) => x.podcast_id !== p.podcast_id);
        unmatched = [...unmatched, p];
        toast.info('Podcast restored to index matching');
      }
    } catch (e) {
      toast.error(`Error updating podcast ignore status: ${(e as Error).message}`);
    }
  }

  const validId = $derived(/^\d+$/.test(manualId.trim()));
  const matchManual = () => validId && selected !== null && match(selected, Number(manualId.trim()));
  const searchTerms = () => terms.trim() && ((results = []), search(terms.trim()));
</script>

<!-- Clicking anywhere outside the section closes the open search. -->
<svelte:document onclick={(e) => container && !container.contains(e.target as Node) && (selected = null)} />

<div class="settings_container" bind:this={container}>
  {#if loading}
    <div class="settings-row">
      <div><div class="settings-row-label">{t('podcast_index_matching.loading_podcasts')}</div></div>
      <div class="settings-row-control"><i class="ph ph-spinner animate-spin" style="font-size:18px;color:var(--text-color);"></i></div>
    </div>
  {:else if unmatched.length === 0}
    <div class="settings-row">
      <div>
        <div class="settings-row-label">{t('podcast_index_matching.all_podcasts_matched')}</div>
        <div class="settings-row-desc">{t('podcast_index_matching.no_podcasts_need_matching')}</div>
      </div>
    </div>
  {:else}
    <div style="display:flex;flex-direction:column;gap:12px;">
      {#each unmatched as p (p.podcast_id)}
        <div class="border rounded-lg p-4 modal-container">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;padding:8px;border-radius:6px;" onclick={() => open(p)}>
            <FallbackImage src={p.artwork_url || '/static/assets/favicon.png'} alt="Cover for {p.podcast_name}" class="w-16 h-16 rounded object-cover flex-shrink-0" />
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:600;color:var(--text-color);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{p.podcast_name}</div>
              {#if p.author}<div style="font-size:12px;color:var(--text-secondary-color);margin-bottom:4px;">{p.author}</div>{/if}
              <div style="font-size:11px;color:var(--text-secondary-color);">{t('podcast_index_matching.click_to_search')}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <button
                class="btn btn-danger"
                style="padding:4px 10px;font-size:12px;"
                onclick={(e) => {
                  e.stopPropagation();
                  setIgnored(p, true);
                }}>{t('podcast_index_matching.ignore')}</button
              >
              <i class="ph ph-magnifying-glass" style="font-size:22px;color:var(--text-secondary-color);"></i>
            </div>
          </div>
          {#if selected === p.podcast_id}
            <div style="margin-top:12px;border-radius:8px;overflow:hidden;" class="modal-container border">
              <div style="padding:16px;border-bottom:1px solid rgba(128,128,128,0.15);">
                <div style="font-size:13px;font-weight:500;color:var(--text-color);margin-bottom:12px;">{t('podcast_index_matching.manual_search_options')}</div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:11px;color:var(--text-secondary-color);margin-bottom:6px;">{t('podcast_index_matching.search_by_custom_terms')}</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <input
                      type="text"
                      placeholder="Enter search terms (e.g., 'Skeptoid')"
                      bind:value={terms}
                      onkeydown={(e) => e.key === 'Enter' && searchTerms()}
                      class="input"
                      style="flex:1;min-width:160px;"
                      aria-label={t('podcast_index_matching.search_by_custom_terms')}
                    />
                    <button onclick={searchTerms} class="btn btn-secondary" style="padding:6px 12px;">
                      <i class="ph ph-magnifying-glass"></i>{t('podcast_index_matching.search')}
                    </button>
                  </div>
                </div>
                <div>
                  <div style="font-size:11px;color:var(--text-secondary-color);margin-bottom:6px;">{t('podcast_index_matching.enter_podcast_id')}</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <input
                      type="text"
                      placeholder="Enter Podcast Index ID (e.g., 920666)"
                      bind:value={manualId}
                      onkeydown={(e) => e.key === 'Enter' && matchManual()}
                      class="input"
                      style="flex:1;min-width:160px;"
                      aria-label={t('podcast_index_matching.enter_podcast_id')}
                    />
                    <button onclick={matchManual} disabled={!validId} class="btn btn-primary" style="padding:6px 12px;">
                      <i class="ph ph-check"></i>{t('podcast_index_matching.match_btn')}
                    </button>
                  </div>
                </div>
              </div>
              {#if searching}
                <div style="display:flex;align-items:center;gap:8px;padding:16px;color:var(--text-color);">
                  <i class="ph ph-spinner animate-spin" style="font-size:18px;"></i>
                  <span style="font-size:13px;">{t('podcast_index_matching.searching')}</span>
                </div>
              {:else if results.length === 0}
                <div style="text-align:center;padding:16px;">
                  <div style="font-size:13px;color:var(--text-secondary-color);">{t('podcast_index_matching.no_matches_found')}</div>
                  <div style="font-size:11px;color:var(--text-secondary-color);margin-top:4px;">{t('podcast_index_matching.try_manual_search')}</div>
                </div>
              {:else}
                <div>
                  <div style="padding:10px 12px;border-bottom:1px solid rgba(128,128,128,0.15);">
                    <span style="font-size:13px;font-weight:500;color:var(--text-color);">{t('podcast_index_matching.search_results')}</span>
                  </div>
                  <div style="max-height:300px;overflow-y:auto;padding:8px;">
                    {#each results as r (r.id)}
                      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                      <div onclick={() => match(p.podcast_id, r.indexId)} style="display:flex;align-items:center;padding:8px;border-radius:6px;cursor:pointer;gap:12px;">
                        <FallbackImage src={r.image} alt="Cover for {r.title}" class="w-12 h-12 rounded object-cover" />
                        <div style="flex:1;min-width:0;">
                          <div style="font-size:13px;font-weight:500;color:var(--text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{r.title}</div>
                          <div style="font-size:11px;color:var(--text-secondary-color);">{r.author}</div>
                          <div style="font-size:11px;color:var(--text-secondary-color);">Index ID: {r.indexId}</div>
                        </div>
                        <i class="ph ph-check" style="font-size:20px;color:var(--accent-color);flex-shrink:0;"></i>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="settings-subsection-title" style="margin-top:20px;">{t('podcast_index_matching.ignored_podcasts')}</div>
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{showIgnored ? t('podcast_index_matching.showing_ignored') : t('podcast_index_matching.podcasts_ignored')}</div>
    </div>
    <div class="settings-row-control">
      <button class="btn btn-ghost" style="padding:6px 12px;" onclick={() => (showIgnored = !showIgnored)}>
        <i class="ph {showIgnored ? 'ph-caret-up' : 'ph-caret-down'}"></i>
        <span>{showIgnored ? t('podcast_index_matching.hide') : t('podcast_index_matching.show')}</span>
      </button>
    </div>
  </div>
  {#if showIgnored}
    {#if ignored.length === 0}
      <div class="settings-row"><div><div class="settings-row-desc">{t('podcast_index_matching.no_ignored')}</div></div></div>
    {:else}
      <div style="padding:0 8px;">
        {#each ignored as p (p.podcast_id)}
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(128,128,128,0.12);">
            <FallbackImage src={p.artwork_url || '/static/assets/favicon.png'} alt="Cover for {p.podcast_name}" class="w-12 h-12 rounded object-cover flex-shrink-0" />
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:500;color:var(--text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.75;">{p.podcast_name}</div>
              {#if p.author}<div style="font-size:11px;color:var(--text-secondary-color);opacity:0.75;">{p.author}</div>{/if}
            </div>
            <button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;flex-shrink:0;" onclick={() => setIgnored(p, false)}>
              <i class="ph ph-arrow-counter-clockwise"></i>{t('podcast_index_matching.restore')}
            </button>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
