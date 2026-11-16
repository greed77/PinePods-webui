<script lang="ts" module>
  /** Form values as typed (strings for the number boxes). Durations are minutes;
   *  the server converts them to seconds. */
  export interface PlaylistDraft {
    name: string;
    description: string;
    icon_name: string;
    podcast_ids: number[];
    include_unplayed: boolean;
    include_partially_played: boolean;
    include_played: boolean;
    min_duration: string | number;
    max_duration: string | number;
    play_progress_min: string | number;
    play_progress_max: string | number;
    time_filter_hours: string | number;
    sort_order: string;
    max_episodes: string | number;
    group_by_podcast: boolean;
  }

  export const emptyDraft = (): PlaylistDraft => ({
    name: '',
    description: '',
    icon_name: 'ph-playlist',
    podcast_ids: [],
    include_unplayed: true,
    include_partially_played: true,
    include_played: false,
    min_duration: '',
    max_duration: '',
    play_progress_min: '',
    play_progress_max: '',
    time_filter_hours: '',
    sort_order: 'date_desc',
    max_episodes: '',
    group_by_podcast: false
  });

  // Number inputs bind as numbers once typed in (and '' / null when cleared).
  const num = (v: string | number | null | undefined) => {
    const s = String(v ?? '').trim();
    return s === '' || isNaN(Number(s)) ? null : Number(s);
  };

  export function draftToForm(d: PlaylistDraft) {
    return {
      name: d.name,
      description: d.description || null,
      icon_name: d.icon_name,
      podcast_ids: d.podcast_ids.length ? d.podcast_ids : null,
      include_unplayed: d.include_unplayed,
      include_partially_played: d.include_partially_played,
      include_played: d.include_played,
      min_duration: num(d.min_duration),
      max_duration: num(d.max_duration),
      play_progress_min: num(d.play_progress_min),
      play_progress_max: num(d.play_progress_max),
      time_filter_hours: num(d.time_filter_hours),
      sort_order: d.sort_order,
      max_episodes: num(d.max_episodes),
      group_by_podcast: d.group_by_podcast
    };
  }
</script>

<script lang="ts">
  // The create (upstream playlists.rs) and edit (playlist_detail.rs) playlist forms.
  import * as E from '$lib/api/endpoints';
  import type { Podcast } from '$lib/api/endpoints';
  import { t } from '$lib/i18n/index.svelte';
  import IconSelector from './IconSelector.svelte';
  import PodcastSelector from './PodcastSelector.svelte';
  import Loading from './Loading.svelte';

  let {
    draft = $bindable(),
    mode,
    saving,
    onsubmit,
    onclose
  }: { draft: PlaylistDraft; mode: 'create' | 'edit'; saving: boolean; onsubmit: () => void; onclose: () => void } = $props();

  let podcasts = $state<Podcast[] | null>(null);
  E.getPodcasts()
    .then((p) => (podcasts = p))
    .catch(() => (podcasts = []));

  const sorts = [
    ['date_desc', 'playlists.newest_first'],
    ['date_asc', 'playlists.oldest_first'],
    ['duration_desc', 'playlists.longest_first'],
    ['duration_asc', 'playlists.shortest_first']
  ];
  const inputCls = 'search-bar-input border text-sm rounded-lg block w-full p-2.5';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-25" onclick={onclose}>
  <div class="flex min-h-full items-center justify-center p-4">
    <div class="modal-container relative w-full max-w-md rounded-lg shadow" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
        <h3 class="text-xl font-semibold">{mode === 'create' ? t('playlists.create_new_playlist') : t('playlist_detail.edit_playlist')}</h3>
        <button
          onclick={onclose}
          class="end-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
          aria-label={t('playlists.close_modal')}
        >
          <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
          </svg>
        </button>
      </div>
      <div class="p-4 md:p-5">
        <form
          class="space-y-4"
          onsubmit={(e) => {
            e.preventDefault();
            onsubmit();
          }}
        >
          <div>
            <label class="block mb-2 text-sm font-medium" for="pl-name">{t('playlists.name')}</label>
            <input id="pl-name" type="text" class={inputCls} bind:value={draft.name} />
          </div>
          <div>
            <label class="block mb-2 text-sm font-medium" for="pl-desc">{t('playlists.description')}</label>
            <textarea id="pl-desc" class={inputCls} bind:value={draft.description}></textarea>
          </div>
          <div>
            <span class="block mb-2 text-sm font-medium">{t('playlists.icon')}</span>
            <IconSelector value={draft.icon_name} onselect={(i) => (draft.icon_name = i)} />
          </div>
          <div>
            <span class="block mb-2 text-sm font-medium">{t('playlists.filter_by_podcasts')}</span>
            {#if podcasts === null}<Loading />{:else}<PodcastSelector bind:selected={draft.podcast_ids} {podcasts} />{/if}
          </div>
          <div>
            <span class="block mb-2 text-sm font-medium">{t('playlists.episode_filters')}</span>
            <div class="space-y-2">
              <label class="flex items-center"><input type="checkbox" class="mr-2" bind:checked={draft.include_unplayed} /><span>{t('playlists.include_unplayed')}</span></label>
              <label class="flex items-center"
                ><input type="checkbox" class="mr-2" bind:checked={draft.include_partially_played} /><span>{t('playlists.include_partially_played')}</span></label
              >
              <label class="flex items-center"><input type="checkbox" class="mr-2" bind:checked={draft.include_played} /><span>{t('playlists.include_played')}</span></label>
            </div>
          </div>
          <div>
            <span class="block mb-2 text-sm font-medium">{t('playlists.duration_range_minutes')}</span>
            <div class="grid grid-cols-2 gap-4">
              <input type="number" placeholder={t('playlists.min')} class={inputCls} bind:value={draft.min_duration} />
              <input type="number" placeholder={t('playlists.max')} class={inputCls} bind:value={draft.max_duration} />
            </div>
          </div>
          <div>
            <span class="block mb-2 text-sm font-medium">{t('playlists.play_progress_range_percent')}</span>
            <div class="grid grid-cols-2 gap-4">
              {#each ['play_progress_min', 'play_progress_max'] as const as k, i}
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder={t(i ? 'playlists.max_percent' : 'playlists.min_percent')}
                  disabled={!draft.include_partially_played}
                  class="{inputCls} {!draft.include_partially_played ? 'opacity-50 cursor-not-allowed' : ''}"
                  bind:value={draft[k]}
                />
              {/each}
            </div>
          </div>
          <div>
            <label class="block mb-2 text-sm font-medium" for="pl-hours">{t('playlists.time_filter_hours')}</label>
            <input id="pl-hours" type="number" min="0" placeholder={t('playlists.hours')} class={inputCls} bind:value={draft.time_filter_hours} />
          </div>
          <div>
            <label class="block mb-2 text-sm font-medium" for="pl-sort">{t('playlists.sort_order')}</label>
            <select id="pl-sort" class={inputCls} bind:value={draft.sort_order}>
              {#each sorts as [v, k]}<option value={v}>{t(k)}</option>{/each}
            </select>
          </div>
          <div>
            <label class="block mb-2 text-sm font-medium" for="pl-max">{t('playlists.max_episodes')}</label>
            <input id="pl-max" type="number" class={inputCls} bind:value={draft.max_episodes} />
          </div>
          <label class="flex items-center"><input type="checkbox" class="mr-2" bind:checked={draft.group_by_podcast} /><span>{t('playlists.group_by_podcast')}</span></label>
          <button
            type="submit"
            class="download-button w-full focus:ring-4 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center"
            disabled={saving || !draft.name.trim()}
          >
            {#if saving}
              <div class="flex items-center justify-center"><i class="ph ph-circle-notch animate-spin mr-2"></i>{t('playlists.creating')}</div>
            {:else}
              {mode === 'create' ? t('playlists.create_playlist') : t('playlist_detail.edit_save')}
            {/if}
          </button>
        </form>
      </div>
    </div>
  </div>
</div>
