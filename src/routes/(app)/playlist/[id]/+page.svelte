<script lang="ts">
  // Port of upstream pages/playlist_detail.rs: playlist header, edit, "play from
  // top" (which keeps the player in playlist context), and the paged episode list.
  import { page } from '$app/state';
  import * as E from '$lib/api/endpoints';
  import type { Episode } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { player } from '$lib/player/player.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import PagedEpisodes from '$lib/components/PagedEpisodes.svelte';
  import PlaylistFormModal, { draftToForm, emptyDraft } from '$lib/components/PlaylistFormModal.svelte';

  const id = $derived(Number(page.params.id));
  let info = $state<any>(null);
  let episodes = $state<Episode[]>([]);
  let reload = $state(0);
  let editing = $state(false);
  let saving = $state(false);
  let draft = $state(emptyDraft());

  const load = async (offset: number) => {
    const r = await E.getPlaylistEpisodes(id, 50, offset);
    if (offset === 0) info = r.info;
    return r;
  };

  function openEdit() {
    const s = (v: unknown) => (v == null ? '' : String(v));
    draft = {
      name: info.name ?? '',
      description: info.description ?? '',
      icon_name: info.icon_name ?? 'ph-playlist',
      podcast_ids: info.podcast_ids ?? [],
      include_unplayed: info.include_unplayed ?? true,
      include_partially_played: info.include_partially_played ?? true,
      include_played: info.include_played ?? false,
      min_duration: s(info.min_duration),
      max_duration: s(info.max_duration),
      play_progress_min: s(info.play_progress_min),
      play_progress_max: s(info.play_progress_max),
      time_filter_hours: s(info.time_filter_hours),
      sort_order: info.sort_order ?? 'date_desc',
      max_episodes: s(info.max_episodes),
      group_by_podcast: info.group_by_podcast ?? false
    };
    editing = true;
  }

  async function save() {
    saving = true;
    try {
      await E.updatePlaylist(id, draftToForm(draft) as E.PlaylistForm);
      editing = false;
      reload++;
    } catch (e) {
      toast.error(`${t('playlist_detail.edit_failed')}: ${(e as Error).message}`);
    } finally {
      saving = false;
    }
  }

  function playFromTop() {
    const target = episodes.find((e) => !e.completed) ?? episodes[0];
    if (target) player.play(target, { playlistId: id });
  }

  const emptyText = $derived(
    (({
      'Fresh Releases': 'playlist_detail.fresh_releases_empty',
      'Currently Listening': 'playlist_detail.currently_listening_empty',
      'Almost Done': 'playlist_detail.almost_done_empty'
    }) as Record<string, string>)[info?.name] ?? 'playlist_detail.no_episodes_match_criteria'
  );
</script>

<div class="main-container">
  <TopBar />
  <div class="section-container">
    {#if info}
      <div class="playlist-header mb-6">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4 min-w-0">
            <i class="text-4xl ph {info.icon_name}"></i>
            <div>
              <h1 class="text-2xl font-bold item_container-text">{info.name}</h1>
              {#if info.description}<p class="text-gray-600 dark:text-gray-400">{info.description}</p>{/if}
              <p class="text-sm item_container-text mt-1">{info.episode_count ?? 0} {t('playlist_detail.episodes')}</p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {#if !info.is_system_playlist}
              <button onclick={openEdit} class="btn-secondary flex items-center justify-center gap-2 px-4 py-2 rounded-lg">
                <i class="ph ph-pencil text-xl"></i>{t('playlist_detail.edit_playlist')}
              </button>
            {/if}
            <button onclick={playFromTop} class="btn-primary flex items-center justify-center gap-2 px-4 py-2 rounded-lg" disabled={episodes.length === 0}>
              <i class="ph ph-play-circle text-xl"></i>{t('playlist_detail.play_from_top')}
            </button>
          </div>
        </div>
      </div>
    {/if}
    <PagedEpisodes bind:episodes {load} key={`${id}|${reload}`} emptyHeader={t('playlist_detail.no_episodes_found')} emptyText={t(emptyText)} />
  </div>
</div>

{#if editing}
  <PlaylistFormModal bind:draft mode="edit" {saving} onsubmit={save} onclose={() => (editing = false)} />
{/if}
