// Thin wrappers over the typed client for the calls the UI makes, mirroring
// upstream web/src/requests/*.rs. Where the spec doesn't describe a response
// body, the shape below was taken from the Rust request code / a live server.
import { api, unwrap } from './client';
import { session } from '$lib/stores/session.svelte';

const uid = () => session.userId;

// ---------- Shared shapes ----------

/** Episode as the UI uses it. Endpoints disagree on key casing, so every list
 *  goes through `normEpisode`. */
export interface Episode {
  podcastid: number;
  podcastname: string;
  episodetitle: string;
  episodepubdate: string;
  episodedescription: string;
  episodeartwork: string;
  artworkurl?: string;
  episodeurl: string;
  episodeduration: number;
  listenduration: number;
  episodeid: number;
  completed: boolean;
  saved: boolean;
  queued: boolean;
  downloaded: boolean;
  is_youtube: boolean;
  is_video: boolean;
  feedurl?: string;
  queueposition?: number | null;
}

export function normEpisode(raw: Record<string, any>): Episode {
  const o: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) o[k.toLowerCase()] = v;
  return {
    podcastid: o.podcastid ?? 0,
    podcastname: o.podcastname ?? '',
    episodetitle: o.episodetitle ?? '',
    episodepubdate: o.episodepubdate ?? '',
    episodedescription: o.episodedescription ?? '',
    episodeartwork: o.episodeartwork ?? '',
    artworkurl: o.artworkurl ?? '',
    episodeurl: o.episodeurl ?? '',
    episodeduration: o.episodeduration ?? 0,
    listenduration: o.listenduration ?? 0,
    episodeid: o.episodeid ?? 0,
    completed: !!o.completed,
    saved: !!o.saved,
    queued: !!o.queued,
    downloaded: !!o.downloaded,
    is_youtube: !!o.is_youtube,
    is_video: !!o.is_video,
    feedurl: o.feedurl ?? '',
    queueposition: o.queueposition ?? null
  };
}

export interface Podcast {
  podcastid: number;
  podcastname: string;
  artworkurl: string;
  description: string;
  episodecount: number;
  websiteurl: string;
  feedurl: string;
  author: string;
  categories: Record<string, string> | null;
  explicit: boolean;
  podcastindexid: number;
  is_favorite?: boolean;
  is_video?: boolean;
  is_youtube?: boolean;
  oldest_episode_date?: string | null;
  newest_episode_date?: string | null;
  play_count?: number;
}

export interface PodcastDetails extends Podcast {
  autodownload: boolean;
  isyoutubechannel: boolean;
  notificationsenabled: boolean;
  playbackspeed: number;
  startskip: number;
  endskip: number;
}

export interface Playlist {
  playlist_id: number;
  name: string;
  description?: string | null;
  icon_name: string;
  episode_count?: number | null;
  is_system_playlist: boolean;
}

export interface HomeOverview {
  recent_episodes: Episode[];
  in_progress_episodes: Episode[];
  queue_preview: Episode[];
  top_podcasts: Podcast[];
  saved_count: number;
  downloaded_count: number;
  queue_count: number;
  weekly_stats: { seconds_listened: number; episodes_completed: number };
}

// ---------- Auth ----------

export interface LoginResponse {
  status: string;
  retrieved_key?: string | null;
  mfa_required?: boolean | null;
  user_id?: number | null;
  mfa_session_token?: string | null;
}

export const pinepodsCheck = () => unwrap<{ pinepods_instance: boolean }>(api().GET('/api/pinepods_check'));

export function getKey(username: string, password: string) {
  const basic = btoa(String.fromCharCode(...new TextEncoder().encode(`${username}:${password}`)));
  return unwrap<LoginResponse>(api().GET('/api/data/get_key', { headers: { Authorization: `Basic ${basic}` } }));
}

export const verifyMfaAndGetKey = (mfa_session_token: string, mfa_code: string) =>
  unwrap<{ status: string; retrieved_key?: string | null; verified: boolean }>(
    api().POST('/api/data/verify_mfa_and_get_key', { body: { mfa_session_token, mfa_code } })
  );

const withKey = (key: string) => ({ headers: { 'Api-Key': key } });

export const verifyKey = (key: string) => unwrap<{ status: string }>(api().GET('/api/data/verify_key', withKey(key)));
export const getUserId = (key: string) =>
  unwrap<{ status: string; retrieved_id?: number }>(api().GET('/api/data/get_user', withKey(key)));
export const getUserDetails = (key: string, user_id: number) =>
  unwrap<any>(api().GET('/api/data/user_details_id/{user_id}', { params: { path: { user_id } }, ...withKey(key) }));
export const getApiConfig = (key: string) => unwrap<any>(api().GET('/api/data/config', withKey(key)));

export const selfServiceStatus = () =>
  unwrap<{ status: boolean; first_admin_created: boolean }>(api().GET('/api/data/self_service_status'));
export const publicOidcProviders = () => unwrap<any>(api().GET('/api/data/public_oidc_providers'));
export const availableLanguages = () =>
  unwrap<{ languages: { code: string; name: string }[] }>(api().GET('/api/data/get_available_languages'));
export const storeOidcState = (body: {
  state: string;
  client_id: string;
  origin_url?: string;
  code_verifier?: string;
  redirect_uri?: string;
}) => unwrap(api().POST('/api/auth/store_state', { body }));

export const firstLoginDone = (user_id = uid()) =>
  unwrap<{ FirstLogin: boolean }>(api().GET('/api/data/first_login_done/{user_id}', { params: { path: { user_id } } }));
export const checkMfaEnabled = (user_id = uid()) =>
  unwrap<{ mfa_enabled: boolean }>(api().GET('/api/data/check_mfa_enabled/{user_id}', { params: { path: { user_id } } }));
export const setupTimeInfo = (timezone: string, hour_pref: number, date_format: string) =>
  unwrap(api().POST('/api/data/setup_time_info', { body: { user_id: uid(), timezone, hour_pref, date_format } }));
export const updateUserLanguage = (language: string) =>
  unwrap(api().PUT('/api/data/update_user_language', { body: { user_id: uid(), language } }));
export const getUserLanguage = () =>
  unwrap<{ language: string }>(api().GET('/api/data/get_user_language', { params: { query: { user_id: uid() } } }));
export const getServerDefaultLanguage = () => unwrap<{ default_language: string }>(api().GET('/api/data/get_server_default_language'));

export const getTheme = () =>
  unwrap<{ theme: string }>(api().GET('/api/data/get_theme/{user_id}', { params: { path: { user_id: uid() } } }));
export const getTimeInfo = () =>
  unwrap<{ timezone: string; hour_pref: number; date_format?: string | null }>(
    api().GET('/api/data/get_time_info', { params: { query: { user_id: uid() } } })
  );
export const getStartPage = () =>
  unwrap<{ StartPage: string }>(api().GET('/api/data/startpage', { params: { query: { user_id: uid() } } }));
export const getPinepodsVersion = () => unwrap<{ data: string }>(api().GET('/api/data/get_pinepods_version'));

// ---------- Home / lists ----------

export async function getHomeOverview(): Promise<HomeOverview> {
  const d = await unwrap<any>(api().GET('/api/data/home_overview', { params: { query: { user_id: uid() } } }));
  return {
    ...d,
    recent_episodes: (d.recent_episodes ?? []).map(normEpisode),
    in_progress_episodes: (d.in_progress_episodes ?? []).map(normEpisode),
    queue_preview: (d.queue_preview ?? []).map(normEpisode)
  };
}

export const getPlaylists = async () =>
  (await unwrap<{ playlists: Playlist[] }>(api().GET('/api/data/get_playlists', { params: { query: { user_id: uid() } } })))
    .playlists ?? [];

export const getPodcasts = async () =>
  (await unwrap<{ pods: Podcast[] }>(api().GET('/api/data/return_pods/{user_id}', { params: { path: { user_id: uid() } } })))
    .pods ?? [];

export const getPodcastDetails = async (podcast_id: number) =>
  (
    await unwrap<{ details: PodcastDetails }>(
      api().GET('/api/data/get_podcast_details', { params: { query: { user_id: uid(), podcast_id } } })
    )
  ).details;

export async function getPodcastEpisodes(
  podcast_id: number,
  opts: { limit?: number; offset?: number; sort_by?: string; sort_order?: string; search?: string; filter?: string } = {}
) {
  const d = await unwrap<{ episodes: any[]; total: number }>(
    api().GET('/api/data/podcast_episodes', { params: { query: { user_id: uid(), podcast_id, ...opts } } })
  );
  return { episodes: (d.episodes ?? []).map(normEpisode), total: Number(d.total ?? 0) };
}

export const togglePodcastFavorite = (podcast_id: number, is_favorite: boolean) =>
  unwrap(api().PUT('/api/data/podcast/toggle_favorite', { body: { user_id: uid(), podcast_id, is_favorite } }));

export const removePodcast = (podcast_id: number) =>
  unwrap<{ success: boolean }>(api().POST('/api/data/remove_podcast_id', { body: { user_id: uid(), podcast_id } }));

export const addPodcast = (p: Podcast) =>
  unwrap<{ success: boolean; podcast_id: number }>(
    api().POST('/api/data/add_podcast', {
      body: {
        podcast_values: {
          pod_title: p.podcastname,
          pod_artwork: p.artworkurl,
          pod_author: p.author,
          categories: p.categories ?? {},
          pod_description: p.description,
          pod_episode_count: p.episodecount,
          pod_feed_url: p.feedurl,
          pod_website: p.websiteurl,
          pod_explicit: p.explicit,
          user_id: uid()
        },
        podcast_index_id: p.podcastindexid || null
      }
    })
  );

export const downloadAllPodcast = (podcast_id: number, is_youtube = false) =>
  unwrap(api().POST('/api/data/download_all_podcast', { body: { podcast_id, user_id: uid(), is_youtube } }));

type BulkPath =
  | '/api/data/bulk_mark_episodes_completed'
  | '/api/data/bulk_save_episodes'
  | '/api/data/bulk_queue_episodes'
  | '/api/data/bulk_download_episodes';
export const bulkAction = (path: BulkPath, episode_ids: number[], is_youtube?: boolean) =>
  unwrap<{ message: string; processed_count: number }>(api().POST(path, { body: { episode_ids, user_id: uid(), is_youtube } }));

// ---------- Episode actions ----------

const epBody = (ep: Pick<Episode, 'episodeid' | 'is_youtube'>) => ({
  episode_id: ep.episodeid,
  user_id: uid(),
  is_youtube: ep.is_youtube
});

export const queueEpisode = (ep: Episode) => unwrap(api().POST('/api/data/queue_pod', { body: epBody(ep) }));
export const removeQueuedEpisode = (ep: Episode) => unwrap(api().POST('/api/data/remove_queued_pod', { body: epBody(ep) }));
export const queueBump = (ep: Episode) => unwrap(api().POST('/api/data/queue_bump', { body: epBody(ep) }));
export const saveEpisode = (ep: Episode) => unwrap(api().POST('/api/data/save_episode', { body: epBody(ep) }));
export const removeSavedEpisode = (ep: Episode) => unwrap(api().POST('/api/data/remove_saved_episode', { body: epBody(ep) }));
export const downloadEpisode = (ep: Episode) => unwrap(api().POST('/api/data/download_podcast', { body: epBody(ep) }));
export const deleteDownloadedEpisode = (ep: Episode) => unwrap(api().POST('/api/data/delete_episode', { body: epBody(ep) }));
export const markEpisodeCompleted = (ep: Pick<Episode, 'episodeid' | 'is_youtube'>) =>
  unwrap(api().POST('/api/data/mark_episode_completed', { body: epBody(ep) }));
export const markEpisodeUncompleted = (ep: Episode) =>
  unwrap(api().POST('/api/data/mark_episode_uncompleted', { body: epBody(ep) }));

export async function getQueuedEpisodes() {
  const d = await unwrap<{ data: any[] }>(api().GET('/api/data/get_queued_episodes', { params: { query: { user_id: uid() } } }));
  return (d.data ?? []).map(normEpisode);
}

export const reorderQueue = (episodes: Episode[]) =>
  unwrap(
    api().POST('/api/data/reorder_queue', {
      params: { query: { user_id: uid() } },
      body: { episodes: episodes.map((e) => ({ episode_id: e.episodeid, is_youtube: e.is_youtube })) }
    })
  );

export const clearQueue = () => unwrap(api().POST('/api/data/clear_queue', { body: { user_id: uid() } }));

export async function getEpisodeMetadata(episode_id: number, is_youtube = false) {
  const d = await unwrap<any>(
    api().POST('/api/data/get_episode_metadata', { body: { episode_id, user_id: uid(), is_youtube, person_episode: false } })
  );
  return normEpisode(d.episode ?? d);
}

// ---------- Playback bookkeeping (see upstream components/audio.rs) ----------

export const checkEpisodeInDb = async (episode_title: string, episode_url: string) =>
  (
    await unwrap<{ episode_in_db: boolean }>(
      api().GET('/api/data/check_episode_in_db/{user_id}', {
        params: { path: { user_id: uid() }, query: { episode_title, episode_url } }
      })
    )
  ).episode_in_db;

export const getEpisodeIdByUrl = async (episode_url: string) =>
  Number(
    await unwrap<any>(api().GET('/api/data/get_episode_id_ep_name', { params: { query: { episode_url, user_id: uid() } } }))
  ) || 0;

export const recordHistory = (episode_id: number, episode_pos: number, is_youtube: boolean) =>
  unwrap(api().POST('/api/data/record_podcast_history', { body: { episode_id, episode_pos, user_id: uid(), is_youtube } }));

export const incrementPlayed = () =>
  unwrap(api().PUT('/api/data/increment_played/{user_id}', { params: { path: { user_id: uid() } } }));
export const incrementListenTime = () =>
  unwrap(api().PUT('/api/data/increment_listen_time/{user_id}', { params: { path: { user_id: uid() } } }));

export const recordListenDuration = (episode_id: number, listen_duration: number, is_youtube: boolean) =>
  unwrap(api().POST('/api/data/record_listen_duration', { body: { episode_id, user_id: uid(), listen_duration, is_youtube } }));

export const updateEpisodeDuration = (episode_id: number, new_duration: number, is_youtube: boolean) =>
  unwrap(api().POST('/api/data/update_episode_duration', { body: { episode_id, new_duration, is_youtube } }));

export async function getPodcastIdFromEpisode(episode_id: number, is_youtube?: boolean) {
  const d = await unwrap<any>(
    api().GET('/api/data/get_podcast_id_from_ep_id', { params: { query: { episode_id, user_id: uid(), is_youtube } } })
  );
  return Number(typeof d === 'object' && d ? (d.podcast_id ?? d.data ?? 0) : d) || 0;
}

export const getAutoPlayNext = async (podcast_id: number) =>
  (
    await unwrap<{ auto_play_next: boolean }>(
      api().POST('/api/data/get_auto_play_next_status', { body: { podcast_id, user_id: uid() } })
    )
  ).auto_play_next;

export const getPlayEpisodeDetails = (podcast_id: number, is_youtube: boolean) =>
  unwrap<{ playback_speed: number; start_skip: number; end_skip: number; playback_speed_customized: boolean }>(
    api().POST('/api/data/get_play_episode_details', { body: { podcast_id, user_id: uid(), is_youtube } })
  );

export const getDefaultVolume = async () =>
  Number((await unwrap<any>(api().POST('/api/data/get_default_volume', { body: { user_id: uid() } }))).default_volume ?? 100);

export interface SkipSegment {
  kind: string;
  start_time: number;
  end_time: number;
  status?: string | null;
}
export const getSkipSegments = (episode_id: number) =>
  unwrap<{ segments: SkipSegment[]; ad_audio?: any }>(
    api().GET('/api/data/episode_skip_segments', { params: { query: { episode_id, user_id: uid() } } })
  );

export interface Chapter {
  title: string;
  startTime?: number | null;
  img?: string | null;
  url?: string | null;
}
export const getPodcasting2Data = (episode_id: number) =>
  unwrap<{ chapters: Chapter[]; transcripts: any[]; people?: any[] }>(
    api().GET('/api/data/fetch_podcasting_2_data', { params: { query: { episode_id, user_id: uid() } } })
  );

export async function getNextPodcastEpisode(episode_id: number) {
  const d = await unwrap<any>(api().POST('/api/data/get_next_podcast_episode', { body: { episode_id, user_id: uid() } }));
  return d && d.episodeid ? normEpisode(d) : null;
}

export async function getNextPlaylistEpisode(episode_id: number, playlist_id: number) {
  const d = await unwrap<any>(
    api().POST('/api/data/get_next_playlist_episode', { body: { episode_id, playlist_id, user_id: uid() } })
  );
  return d && d.episodeid ? normEpisode(d) : null;
}

/** URL the browser plays an episode from: through the server for YouTube,
 *  server downloads and local media, otherwise the feed's own URL. */
export function streamUrl(ep: Episode, viaServer = false) {
  const base = `${session.serverName}/api/data/stream/${ep.episodeid}?api_key=${encodeURIComponent(session.apiKey)}&user_id=${uid()}`;
  if (ep.episodeurl.includes('youtube.com')) return `${base}&type=youtube`;
  if (viaServer || ep.downloaded || ep.episodeurl.startsWith('local://')) return base;
  return ep.episodeurl;
}

export const proxiedImage = (url: string) => `${session.serverName}/api/proxy/image?url=${encodeURIComponent(url)}`;

// ---------- Stage 2: lists, collections, downloads, playlists, search, discover ----------

export interface Page {
  episodes: Episode[];
  total: number;
}

export const sortParams = (s: string): { sort_by: string; sort_order: string } => {
  const m: Record<string, [string, string]> = {
    oldest: ['date', 'asc'],
    shortest: ['duration', 'asc'],
    longest: ['duration', 'desc'],
    title_az: ['title', 'asc'],
    title_za: ['title', 'desc']
  };
  const [sort_by, sort_order] = m[s] ?? ['date', 'desc'];
  return { sort_by, sort_order };
};

export async function getRecentEpisodes(limit: number, offset: number): Promise<Page> {
  const d = await unwrap<{ episodes: any[]; total: number }>(
    api().GET('/api/data/return_episodes/{user_id}', { params: { path: { user_id: uid() }, query: { limit, offset } } })
  );
  return { episodes: (d.episodes ?? []).map(normEpisode), total: Number(d.total ?? 0) };
}

export async function getHistory(limit: number, offset: number, sort: string, filter: string): Promise<Page> {
  const d = await unwrap<{ data: any[]; total: number }>(
    api().GET('/api/data/user_history/{user_id}', {
      params: { path: { user_id: uid() }, query: { limit, offset, ...sortParams(sort), filter } as any }
    })
  );
  return { episodes: (d.data ?? []).map(normEpisode), total: Number(d.total ?? 0) };
}

export interface Collection {
  collection_id: number;
  name: string;
  description?: string | null;
  is_default: boolean;
  icon: string;
  episode_count: number;
  auto_add_categories?: string[] | null;
}

export const getCollections = async () =>
  (await unwrap<{ collections: Collection[] }>(api().GET('/api/data/collections/user/{user_id}', { params: { path: { user_id: uid() } } })))
    .collections ?? [];

export const getCollectionCategories = async () =>
  (await unwrap<{ categories: string[] }>(api().GET('/api/data/collections/categories/{user_id}', { params: { path: { user_id: uid() } } })))
    .categories ?? [];

export async function getSavedEpisodes(limit: number, offset: number, sort: string, filter: string): Promise<Page> {
  const d = await unwrap<{ saved_episodes: any[]; total: number }>(
    api().GET('/api/data/saved_episode_list/{user_id}', { params: { path: { user_id: uid() }, query: { limit, offset, ...sortParams(sort), filter } } })
  );
  return { episodes: (d.saved_episodes ?? []).map(normEpisode), total: Number(d.total ?? 0) };
}

export async function getCollectionEpisodes(collection_id: number, limit: number, offset: number, sort: string, filter: string): Promise<Page> {
  const d = await unwrap<{ saved_episodes: any[]; total: number }>(
    api().GET('/api/data/collections/{collection_id}/episodes', {
      params: { path: { collection_id }, query: { limit, offset, ...sortParams(sort), filter } }
    })
  );
  return { episodes: (d.saved_episodes ?? []).map(normEpisode), total: Number(d.total ?? 0) };
}

export interface CollectionForm {
  name: string;
  description?: string | null;
  icon?: string;
  auto_add_categories?: string[];
  backfill?: boolean;
}
export const createCollection = (f: CollectionForm) =>
  unwrap<{ detail: string; collection_id: number }>(api().POST('/api/data/collections/create', { body: { user_id: uid(), ...f } }));
export const updateCollection = (collection_id: number, f: CollectionForm) =>
  unwrap(api().PATCH('/api/data/collections/{collection_id}', { params: { path: { collection_id } }, body: f }));
export const deleteCollection = (collection_id: number) =>
  unwrap(api().DELETE('/api/data/collections/{collection_id}', { params: { path: { collection_id } } }));
export const addToCollection = (collection_id: number, ep: Pick<Episode, 'episodeid' | 'is_youtube'>) =>
  unwrap(
    api().POST('/api/data/collections/{collection_id}/add_episode', {
      params: { path: { collection_id } },
      body: { user_id: uid(), episode_id: ep.episodeid, is_youtube: ep.is_youtube }
    })
  );
export const removeFromCollection = (collection_id: number, ep: Pick<Episode, 'episodeid' | 'is_youtube'>) =>
  unwrap(
    api().POST('/api/data/collections/{collection_id}/remove_episode', {
      params: { path: { collection_id } },
      body: { user_id: uid(), episode_id: ep.episodeid, is_youtube: ep.is_youtube }
    })
  );
export const bulkAddToCollection = (collection_id: number, episodes: [number, boolean][]) =>
  unwrap(api().POST('/api/data/collections/bulk_add', { body: { user_id: uid(), collection_id, episodes: episodes as any } }));
export const getEpisodeCollections = async (ep: Pick<Episode, 'episodeid' | 'is_youtube'>) =>
  (
    await unwrap<{ collection_ids: number[] }>(
      api().GET('/api/data/episode_collections/{user_id}/{episode_id}', {
        params: { path: { user_id: uid(), episode_id: ep.episodeid }, query: { is_youtube: ep.is_youtube } }
      })
    )
  ).collection_ids ?? [];

export interface DownloadSummary {
  podcastid: number;
  podcastname: string;
  artworkurl?: string | null;
  episode_count?: number;
  [k: string]: unknown;
}
export const getDownloadSummary = async (search = '', filter = 'all') =>
  (
    await unwrap<{ podcasts: DownloadSummary[] }>(
      api().GET('/api/data/podcast_download_summary/{user_id}', { params: { path: { user_id: uid() }, query: { search, filter } } })
    )
  ).podcasts ?? [];

export async function getPodcastDownloads(podcast_id: number, limit: number, offset: number, sort: string, filter: string, search: string): Promise<Page> {
  const d = await unwrap<{ episodes: any[]; total: number }>(
    api().GET('/api/data/podcast_downloads_paged/{user_id}/{podcast_id}', {
      params: { path: { user_id: uid(), podcast_id }, query: { limit, offset, ...sortParams(sort), filter, search } }
    })
  );
  return { episodes: (d.episodes ?? []).map((e) => normEpisode({ ...e, downloaded: true })), total: Number(d.total ?? 0) };
}

export const bulkDeleteDownloads = (episode_ids: number[]) =>
  unwrap<{ message: string }>(api().POST('/api/data/bulk_delete_downloaded_episodes', { body: { episode_ids, user_id: uid() } }));

export interface PlaylistFull extends Playlist {
  podcast_ids?: number[] | null;
  include_unplayed: boolean;
  include_partially_played: boolean;
  include_played: boolean;
  play_progress_min?: number | null;
  play_progress_max?: number | null;
  time_filter_hours?: number | null;
  min_duration?: number | null;
  max_duration?: number | null;
  sort_order: string;
  group_by_podcast: boolean;
  max_episodes?: number | null;
  preview_episodes?: any[];
}
export type PlaylistForm = Omit<PlaylistFull, 'playlist_id' | 'episode_count' | 'is_system_playlist' | 'preview_episodes'>;

export const getPlaylistsFull = async () =>
  (await unwrap<{ playlists: PlaylistFull[] }>(api().GET('/api/data/get_playlists', { params: { query: { user_id: uid() } } }))).playlists ?? [];
export const createPlaylist = (f: PlaylistForm) =>
  unwrap<{ detail: string; playlist_id: number }>(api().POST('/api/data/create_playlist', { body: { user_id: uid(), ...f } as any }));
export const updatePlaylist = (playlist_id: number, f: PlaylistForm) =>
  unwrap<{ detail: string }>(api().PATCH('/api/data/update_playlist', { body: { user_id: uid(), playlist_id, ...f } as any }));
export const deletePlaylist = (playlist_id: number) =>
  unwrap(api().DELETE('/api/data/delete_playlist', { body: { user_id: uid(), playlist_id } }));

export async function getPlaylistEpisodes(playlist_id: number, limit: number, offset: number) {
  const d = await unwrap<{ episodes: any[]; total?: number; playlist_info?: any }>(
    api().GET('/api/data/get_playlist_episodes', { params: { query: { user_id: uid(), playlist_id, limit, offset } } })
  );
  return { episodes: (d.episodes ?? []).map(normEpisode), total: Number(d.total ?? d.episodes?.length ?? 0), info: d.playlist_info ?? null };
}

/** Library search across the user's subscribed episodes. */
export async function searchLibrary(search_term: string, categories: string[], limit: number, offset: number, filter?: string): Promise<Page> {
  const d = await unwrap<{ data: any[]; total: number }>(
    api().POST('/api/data/search_data', { params: { query: { limit, offset, filter } }, body: { search_term, user_id: uid(), categories } })
  );
  return { episodes: (d.data ?? []).map(normEpisode), total: Number(d.total ?? 0) };
}

/** A podcast from Podcast Index / iTunes search, in one shape (upstream UnifiedPodcast). */
export interface SearchPodcast {
  id: number;
  indexId: number;
  title: string;
  url: string;
  author: string;
  description: string;
  image: string;
  link: string;
  categories: Record<string, string>;
  explicit: boolean;
  episodeCount: number;
}

function fromIndex(f: any): SearchPodcast {
  return {
    id: f.id,
    indexId: f.id,
    title: f.title ?? '',
    url: f.url ?? '',
    author: f.author ?? '',
    description: f.description ?? '',
    image: f.image || f.artwork || '',
    link: f.link ?? '',
    categories: f.categories ?? {},
    explicit: !!f.explicit,
    episodeCount: f.episodeCount ?? 0
  };
}

function fromItunes(r: any): SearchPodcast {
  return {
    id: r.trackId,
    indexId: 0,
    title: r.trackName ?? '',
    url: r.feedUrl ?? '',
    author: r.artistName ?? '',
    description: 'Descriptions not provided by iTunes',
    image: r.artworkUrl100 ?? '',
    link: r.collectionViewUrl ?? '',
    categories: Object.fromEntries((r.genres ?? []).map((g: string, i: number) => [String(i), g])),
    explicit: r.collectionExplicitness === 'explicit',
    episodeCount: r.trackCount ?? 0
  };
}

export async function searchPodcasts(query: string, index: 'podcast_index' | 'itunes'): Promise<SearchPodcast[]> {
  const d = await unwrap<any>(api().GET('/api/data/proxy_search', { params: { query: { query, index } } }));
  if (Array.isArray(d.feeds)) return d.feeds.map(fromIndex);
  if (Array.isArray(d.results)) return d.results.filter((r: any) => r.feedUrl).map(fromItunes);
  return [];
}

export const getTrending = async (cat?: string, max = 30) =>
  ((await unwrap<{ feeds: any[] }>(api().GET('/api/data/proxy_trending', { params: { query: { max, cat } } }))).feeds ?? []).map(fromIndex);

export const getCategories = async () =>
  (await unwrap<{ feeds: { id: number; name: string }[] }>(api().GET('/api/data/proxy_categories'))).feeds ?? [];

export interface Recommendation {
  podcastindexid?: number | null;
  title: string;
  author?: string | null;
  image?: string | null;
  description?: string | null;
  feedurl?: string | null;
  categories: Record<string, string>;
  score: number;
  reason: string;
}
export const getRecommendations = (refresh = false, limit = 20) =>
  unwrap<Recommendation[]>(api().GET('/api/data/recommendations', { params: { query: { refresh, limit } } }));

export const checkPodcast = async (podcast_name: string, podcast_url: string) =>
  (
    await unwrap<{ exists: boolean }>(
      api().GET('/api/data/check_podcast', { params: { query: { user_id: uid(), podcast_name, podcast_url } } })
    )
  ).exists;

export async function getPodcastIdByFeed(podcast_feed: string, podcast_title: string) {
  const d = await unwrap<any>(api().GET('/api/data/get_podcast_id', { params: { query: { user_id: uid(), podcast_feed, podcast_title } } }));
  return Number(typeof d === 'object' && d ? (d.podcast_id ?? 0) : d) || 0;
}

/** Episodes straight from a feed the user isn't subscribed to. */
export async function fetchFeedEpisodes(feedUrl: string, podcastName: string): Promise<Episode[]> {
  const d = await unwrap<{ episodes: any[] }>(api().GET('/api/data/fetch_podcast_feed', { params: { query: { podcast_feed: feedUrl } } }));
  return (d.episodes ?? []).map((e) =>
    normEpisode({
      episodeid: 0,
      podcastname: podcastName,
      episodetitle: e.title,
      episodedescription: e.description || e.content || '',
      episodepubdate: e.pub_date,
      episodeartwork: e.artwork,
      episodeurl: e.enclosure_url,
      episodeduration: e.duration,
      is_video: e.is_video,
      feedurl: feedUrl
    })
  );
}

export const removePodcastByName = (podcast_name: string, podcast_url: string) =>
  unwrap(api().POST('/api/data/remove_podcast', { body: { user_id: uid(), podcast_name, podcast_url } }));

// ---------- People (upstream requests/people_req.rs) ----------

/** A person credited on a podcast or episode. */
export interface CreditedPerson {
  id: number;
  podpeople_id?: number | null;
  name: string;
  img?: string | null;
  href?: string | null;
  role: string;
  roles: string[];
  group?: string | null;
  scope: string;
  episode_count: number;
  sources: string[];
  verified: boolean;
  followed: boolean;
}

export interface PersonInfo {
  id: number;
  podpeople_id?: number | null;
  name: string;
  img?: string | null;
  href?: string | null;
  followed: boolean;
}

export interface PersonPodcast {
  podcastid?: number | null;
  podcastname: string;
  artworkurl?: string | null;
  feedurl: string;
  podcastindexid?: number | null;
  roles: string[];
  podcast_level: boolean;
  episode_count: number;
}

export interface PersonProfile {
  person: PersonInfo;
  podcasts: PersonPodcast[];
  episodes: Episode[];
  /** Episodes from shows outside the library; played by URL like feed previews. */
  external_episodes: Episode[];
  refreshing: boolean;
}

export async function getPersonProfile(person_id: number, limit: number, offset: number): Promise<PersonProfile> {
  const d = await unwrap<any>(api().GET('/api/data/people/{person_id}', { params: { path: { person_id }, query: { limit, offset } } }));
  return {
    person: d.person,
    podcasts: d.podcasts ?? [],
    episodes: (d.episodes ?? []).map(normEpisode),
    // Upstream's into_episode keeps only display fields, so these play as previews.
    external_episodes: (d.external_episodes ?? []).map((e: any) =>
      normEpisode({
        episodeid: 0,
        podcastid: 0,
        podcastname: e.podcastname,
        feedurl: e.feedurl,
        episodetitle: e.episodetitle,
        episodepubdate: e.episodepubdate,
        episodedescription: e.episodedescription,
        episodeartwork: e.episodeartwork,
        artworkurl: e.episodeartwork,
        episodeurl: e.episodeurl,
        episodeduration: e.episodeduration
      })
    ),
    refreshing: !!d.refreshing
  };
}

/** Resolve a PodPeopleDB id or a name to a PinePods person id. */
export async function lookupPerson(q: { podpeople_id?: number; name?: string }): Promise<number> {
  const d = await unwrap<{ person_id: number }>(api().GET('/api/data/people/lookup', { params: { query: q } }));
  return d.person_id;
}

export const getFollowedPeople = () => unwrap<PersonInfo[]>(api().GET('/api/data/people/followed'));

export const setFollowing = (person_id: number, follow: boolean) =>
  follow
    ? unwrap(api().POST('/api/data/people/{person_id}/follow', { params: { path: { person_id } } }))
    : unwrap(api().DELETE('/api/data/people/{person_id}/follow', { params: { path: { person_id } } }));

export async function getPodcastPeople(podcast_id: number) {
  const d = await unwrap<any>(api().GET('/api/data/people/podcast/{podcast_id}', { params: { path: { podcast_id } } }));
  // Arrays even if the server answers with something else, so the header never breaks.
  return {
    people: (Array.isArray(d?.people) ? d.people : []) as CreditedPerson[],
    guests: (Array.isArray(d?.guests) ? d.guests : []) as CreditedPerson[]
  };
}

// PodPeopleDB discovery, proxied by the server. Responses aren't in the spec;
// shapes from upstream DiscoverHost / DiscoverPodcast / DiscoverStats.
export interface DiscoverHost {
  id: number;
  name: string;
  img: string;
  podcast_count: number;
}
export interface DiscoverPodcast {
  podcast_id: number;
  title: string;
  host_count: number;
  description: string;
}
export interface DiscoverStats {
  total_hosts: number;
  total_podcasts: number;
}
const discover = (kind: string, limit?: number) =>
  unwrap<any>(api().GET('/api/data/podpeople/discover', { params: { query: { kind, limit } } }));
const normHost = (h: any): DiscoverHost => ({
  id: h.id ?? 0,
  name: h.name ?? '',
  img: h.img ?? '',
  podcast_count: h.podcast_count ?? h.podcastCount ?? 0
});
export const discoverTopHosts = async (limit = 24) => ((await discover('top-hosts', limit)) ?? []).map(normHost);
export const discoverRecentHosts = async (limit = 12) => ((await discover('recent-hosts', limit)) ?? []).map(normHost);
export const discoverPopularPodcasts = async (limit = 12): Promise<DiscoverPodcast[]> =>
  ((await discover('popular-podcasts', limit)) ?? []).map((p: any) => ({
    podcast_id: p.podcast_id ?? 0,
    title: p.title ?? '',
    host_count: p.host_count ?? 0,
    description: p.description ?? ''
  }));
export const discoverStats = async (): Promise<DiscoverStats> => {
  const s = await discover('stats');
  return { total_hosts: s?.total_hosts ?? 0, total_podcasts: s?.total_podcasts ?? 0 };
};

// ---------- YouTube (upstream search_pods.rs / pod_req.rs) ----------

export interface YouTubeChannel {
  channelId: string;
  name: string;
  description: string;
  subscriberCount?: number | null;
  url: string;
  videoCount?: number | null;
  thumbnailUrl: string;
}

/** Channel search through the server's search proxy. */
export async function searchYouTube(query: string): Promise<YouTubeChannel[]> {
  const d = await unwrap<{ results?: YouTubeChannel[] }>(api().GET('/api/data/proxy_search', { params: { query: { query, index: 'youtube' } } }));
  // The same channel can come back more than once.
  const seen = new Set<string>();
  return (d.results ?? []).filter((c) => c.channelId && !seen.has(c.channelId) && !!seen.add(c.channelId));
}

export const youtubeChannelUrl = (channelId: string) => `https://www.youtube.com/channel/${channelId}`;

export const checkYouTubeChannel = async (channel_name: string, channel_url: string) =>
  !!(
    await unwrap<{ exists: boolean }>(
      api().GET('/api/data/check_youtube_channel', { params: { query: { user_id: uid(), channel_name, channel_url } } })
    )
  ).exists;

export const subscribeYouTubeChannel = (channel_id: string) =>
  unwrap<any>(api().POST('/api/data/youtube/subscribe', { params: { query: { channel_id, user_id: uid() } } }));

export const removeYouTubeChannel = (channel_name: string, channel_url: string) =>
  unwrap(api().POST('/api/data/remove_youtube_channel', { body: { user_id: uid(), channel_name, channel_url } }));

// ---------- Settings: theme ----------

export const setTheme = (new_theme: string) => unwrap(api().PUT('/api/data/user/set_theme', { body: { user_id: uid(), new_theme } }));
export const getCustomThemes = async () =>
  (await unwrap<{ themes: import('$lib/theme/custom').CustomTheme[] }>(api().GET('/api/data/user/custom_themes/{user_id}', { params: { path: { user_id: uid() } } })))
    .themes ?? [];
export const createCustomTheme = async (name: string, colors: import('$lib/theme/custom').ThemeColors) =>
  (await unwrap<{ theme: import('$lib/theme/custom').CustomTheme }>(api().POST('/api/data/user/custom_themes', { body: { user_id: uid(), name, ...colors } })))
    .theme;
export const deleteCustomTheme = (theme_id: number) =>
  unwrap(api().DELETE('/api/data/user/custom_themes', { body: { user_id: uid(), theme_id } }));

// ---------- Settings: account ----------

export interface MyUserInfo {
  userid: number;
  fullname: string;
  username: string;
  email: string;
  isadmin: number;
  timezone: string;
  timeformat: number;
  dateformat: string;
  language: string;
}
export const getMyUserInfo = () => unwrap<MyUserInfo>(api().GET('/api/data/my_user_info/{user_id}', { params: { path: { user_id: uid() } } }));
export const setUsername = (new_username: string, user_id = uid()) => unwrap(api().PUT('/api/data/user/set_username', { body: { user_id, new_username } }));
export const setEmail = (new_email: string, user_id = uid()) => unwrap(api().PUT('/api/data/user/set_email', { body: { user_id, new_email } }));
// The server reads new_name from the query string (not in the spec).
export const setFullname = (new_name: string, user_id = uid()) =>
  unwrap(api().PUT('/api/data/set_fullname/{user_id}', { params: { path: { user_id }, query: { new_name } as never } }));
/** `hash_pw` is an Argon2id PHC string (see util/password.ts). */
export const setPassword = (hash_pw: string, user_id = uid()) => unwrap(api().PUT('/api/data/set_password/{user_id}', { params: { path: { user_id } }, body: { hash_pw } }));
export const updateTimezone = (timezone: string) => unwrap(api().PUT('/api/data/update_timezone', { body: { user_id: uid(), timezone } }));
export const updateDateFormat = (date_format: string) => unwrap(api().PUT('/api/data/update_date_format', { body: { user_id: uid(), date_format } }));
export const updateTimeFormat = (hour_pref: number) => unwrap(api().PUT('/api/data/update_time_format', { body: { user_id: uid(), hour_pref } }));

// ---------- Settings: playback / auto-delete ----------

export const getUserPlaybackSpeed = async () =>
  Number((await unwrap<any>(api().POST('/api/data/get_playback_speed', { body: { user_id: uid(), podcast_id: null } }))).playback_speed ?? 1);
export const setUserPlaybackSpeed = (playback_speed: number) =>
  unwrap(api().POST('/api/data/user/set_playback_speed', { body: { user_id: uid(), playback_speed } }));
export const getAutoCompleteSeconds = async () =>
  Number((await unwrap<any>(api().GET('/api/data/get_auto_complete_seconds/{user_id}', { params: { path: { user_id: uid() } } }))).auto_complete_seconds ?? 0);
export const updateAutoCompleteSeconds = (seconds: number) =>
  unwrap(api().PUT('/api/data/update_auto_complete_seconds', { body: { user_id: uid(), seconds } }));
export const setDefaultVolume = (volume: number) => unwrap(api().POST('/api/data/user/set_default_volume', { body: { user_id: uid(), volume } }));
export const getUserAutoDeleteDays = async () =>
  Number((await unwrap<any>(api().POST('/api/data/get_auto_download_delete_days', { body: { user_id: uid(), podcast_id: null } }))).days ?? 0);
export const setUserAutoDeleteDays = (days: number) =>
  unwrap(api().POST('/api/data/user/set_auto_download_delete_days', { body: { user_id: uid(), days } }));
export const getUserAutoDeleteOnComplete = async () =>
  !!(await unwrap<any>(api().POST('/api/data/get_auto_delete_on_complete', { body: { user_id: uid(), podcast_id: null } }))).enabled;
export const setUserAutoDeleteOnComplete = (enabled: boolean) =>
  unwrap(api().POST('/api/data/user/set_auto_delete_on_complete', { body: { user_id: uid(), enabled } }));

export const isUserAdmin = async () =>
  !!(await unwrap<{ is_admin: boolean }>(api().GET('/api/data/user_admin_check/{user_id}', { params: { path: { user_id: uid() } } }))).is_admin;

// ---------- Settings: AI (optional pinepods-ai sidecar) ----------

export interface AiStatus {
  available: boolean;
  transcription_ready: boolean;
  ad_removal_ready: boolean;
}
export interface AiSettings {
  transcription_model: string;
  llm_backend: string;
  llm_model?: string | null;
  llm_url?: string | null;
  has_api_key?: boolean;
}
export interface AiModels {
  whisper: string[];
  llm_local: string[];
}
export const getAiStatus = async (): Promise<AiStatus> => {
  const d = await unwrap<any>(api().GET('/api/data/ai_status'));
  return { available: !!d?.available, transcription_ready: !!d?.transcription_ready, ad_removal_ready: !!d?.ad_removal_ready };
};
/** Admin-only; fails for other users. */
export const getAiSettings = async () => (await unwrap<{ settings: AiSettings }>(api().GET('/api/data/ai_settings'))).settings;
export const getAiModels = async (): Promise<AiModels> => {
  const m = (await unwrap<{ models: Partial<AiModels> }>(api().GET('/api/data/ai_models', { params: { query: {} } }))).models ?? {};
  return { whisper: m.whisper ?? [], llm_local: m.llm_local ?? [] };
};
export const updateAiSettings = (body: {
  transcription_model: string;
  llm_backend: string;
  llm_model: string | null;
  llm_url: string | null;
  llm_api_key: string | null;
  clear_api_key: boolean;
}) => unwrap(api().POST('/api/data/ai_settings', { body: { ...body, whisper_device: null, whisper_compute_type: null } }));
export const pullAiModel = (body: { kind: string; model: string; repo: string | null; filename: string | null; url: string | null }) =>
  unwrap(api().POST('/api/data/ai_pull_model', { body }));

// ---------- Settings: MFA ----------

export const generateMfaSecret = () =>
  unwrap<{ secret: string; qr_code_svg: string }>(api().GET('/api/data/generate_mfa_secret/{user_id}', { params: { path: { user_id: uid() } } }));
export const verifyTempMfa = async (mfa_code: string) =>
  !!(await unwrap<{ verified: boolean }>(api().POST('/api/data/verify_temp_mfa', { body: { user_id: uid(), mfa_code } }))).verified;
// Body isn't in the spec; upstream sends { user_id }.
export const disableMfa = () => unwrap(api().DELETE('/api/data/delete_mfa', { body: { user_id: uid() } as never }));

// ---------- Settings: import / export ----------

/** The user's subscriptions as OPML text. */
export async function exportOpml(): Promise<string> {
  const { data, response } = await api().POST('/api/data/backup_user', { body: { user_id: uid() }, parseAs: 'text' });
  if (!response.ok) throw new Error(response.statusText || `HTTP ${response.status}`);
  return data as unknown as string;
}
export const importOpml = (podcasts: string[]) => unwrap(api().POST('/api/data/import_opml', { body: { podcasts, user_id: uid() } }));
export const getImportProgress = () =>
  unwrap<{ current: number; total: number; current_podcast: string }>(api().GET('/api/data/import_progress/{user_id}', { params: { path: { user_id: uid() } } }));

/** Saves text as a file download. */
export function downloadText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Settings: display ----------

export const setStartPage = (startpage: string) =>
  unwrap(api().POST('/api/data/startpage', { params: { query: { user_id: uid(), startpage } } }));
export const getPodcastCoverPreference = async () =>
  !!(await unwrap<{ use_podcast_covers: boolean }>(
    api().GET('/api/data/user/get_podcast_cover_preference', { params: { query: { user_id: uid() } as never } })
  )).use_podcast_covers;
export const setGlobalPodcastCoverPreference = (use_podcast_covers: boolean) =>
  unwrap(api().POST('/api/data/user/set_global_podcast_cover_preference', { body: { user_id: uid(), use_podcast_covers, podcast_id: null } }));
export const setUseGravatar = (enabled: boolean) => unwrap(api().POST('/api/data/user/set_use_gravatar', { body: { user_id: uid(), enabled } }));

// ---------- Settings: notifications ----------

export interface NotificationSetting {
  platform: string;
  enabled: boolean;
  ntfy_topic?: string | null;
  ntfy_server_url?: string | null;
  ntfy_username?: string | null;
  ntfy_password?: string | null;
  ntfy_access_token?: string | null;
  gotify_url?: string | null;
  gotify_token?: string | null;
  http_url?: string | null;
  http_token?: string | null;
  http_method?: string | null;
}
export const getNotificationSettings = async () =>
  (await unwrap<{ settings: NotificationSetting[] }>(api().GET('/api/data/user/notification_settings', { params: { query: { user_id: uid() } } }))).settings ?? [];
export const updateNotificationSettings = (s: NotificationSetting) =>
  unwrap(api().PUT('/api/data/user/notification_settings', { body: { user_id: uid(), ...s } }));
export const testNotification = (platform: string) => unwrap(api().POST('/api/data/user/test_notification', { body: { user_id: uid(), platform } }));

// ---------- Settings: custom feeds ----------

export const addCustomFeed = (feed_url: string, opts: { username?: string; password?: string; youtube_channel?: boolean; feed_cutoff?: number } = {}) =>
  unwrap(
    api().POST('/api/data/add_custom_podcast', {
      body: {
        feed_url,
        user_id: uid(),
        username: opts.username ?? null,
        password: opts.password ?? null,
        youtube_channel: opts.youtube_channel ?? false,
        feed_cutoff: opts.feed_cutoff ?? 30
      }
    })
  );

// ---------- Settings: local podcasts ----------

export interface LocalDirEntry {
  name: string;
  path: string;
  audio_count: number;
}
export const listLocalDirectories = (path: string) =>
  unwrap<{ current_path: string; directories: LocalDirEntry[] }>(api().GET('/api/data/list_local_directories', { params: { query: { path } } }));
/** Server-relative URL of a cover image found in the folder, if any. */
export const detectLocalCover = async (path: string) =>
  (await unwrap<{ artwork_url?: string | null }>(api().GET('/api/data/detect_local_cover', { params: { query: { path } } }))).artwork_url ?? null;
export const addLocalPodcast = async (b: { directory_path: string; podcast_name: string; description: string | null; author: string | null; explicit: boolean }) =>
  (await unwrap<{ data: { podcastid: number } }>(api().POST('/api/data/add_local_podcast', { body: { user_id: uid(), ...b } }))).data;
/** Multipart upload, which the typed client doesn't describe. */
export async function addLocalPodcastArtwork(podcast_id: number, file: File) {
  const form = new FormData();
  form.append('podcast_id', String(podcast_id));
  form.append('user_id', String(uid()));
  form.append('artwork', file, file.name);
  const r = await fetch(`${session.serverName}/api/data/add_local_podcast_artwork`, { method: 'POST', headers: { 'Api-Key': session.apiKey }, body: form });
  if (!r.ok) throw new Error((await r.text().catch(() => '')) || r.statusText);
}

// ---------- Settings: podcast sync (/api/sync) ----------

import type { components } from './schema';
type S = components['schemas'];
export type SyncServerInfo = S['SyncServerInfo'];
export type SyncTargetInfo = S['SyncTargetInfo'];
export type SyncDevice = S['SyncDeviceEntry'];
export type AppPassword = S['AppPasswordEntry'];
export type SyncStats = S['SyncStats'];
export type SyncTestResult = S['TestTargetResponse'];
export type SyncCredentials = S['TargetCredentials'];

export const getSyncServer = () => unwrap<SyncServerInfo>(api().GET('/api/sync/server'));
export const setSyncServer = (enabled: boolean) => unwrap<SyncServerInfo>(api().PUT('/api/sync/server', { body: { enabled } }));
export const dismissSyncNotice = () => unwrap(api().DELETE('/api/sync/notice'));
export const listAppPasswords = () => unwrap<AppPassword[]>(api().GET('/api/sync/server/app-passwords'));
export const createAppPassword = (label: string) =>
  unwrap<S['CreatedAppPassword']>(api().POST('/api/sync/server/app-passwords', { body: { label: label || null } }));
export const revokeAppPassword = (app_password_id: number) =>
  unwrap(api().DELETE('/api/sync/server/app-passwords/{app_password_id}', { params: { path: { app_password_id } } }));
export const listSyncDevices = () => unwrap<SyncDevice[]>(api().GET('/api/sync/devices'));
export const renameSyncDevice = (device_id: number, caption: string) =>
  unwrap(api().PUT('/api/sync/devices/{device_id}', { params: { path: { device_id } }, body: { caption } }));
export const removeSyncDevice = (device_id: number) => unwrap(api().DELETE('/api/sync/devices/{device_id}', { params: { path: { device_id } } }));
export const getSyncTarget = async () => (await unwrap<{ target?: SyncTargetInfo | null }>(api().GET('/api/sync/target'))).target ?? null;
export const testSyncTarget = (c: SyncCredentials) => unwrap<SyncTestResult>(api().POST('/api/sync/target/test', { body: c }));
export const saveSyncTarget = (c: SyncCredentials) => unwrap(api().PUT('/api/sync/target', { body: c }));
export const deleteSyncTarget = () => unwrap(api().DELETE('/api/sync/target'));
export const runSync = (full: boolean) => unwrap<S['RunResponse']>(api().POST('/api/sync/run', { params: { query: { full } } }));
export const getSyncStats = () => unwrap<SyncStats>(api().GET('/api/sync/stats'));
/** Starts Nextcloud's login flow: open `login`, then hand the poll token to the server. */
export const initiateNextcloudLogin = (nextcloud_url: string) =>
  unwrap<{ login: string; poll: { token: string; endpoint: string } }>(api().POST('/api/data/initiate_nextcloud_login', { body: { user_id: uid(), nextcloud_url } }));
export const addNextcloudServer = (b: { token: string; poll_endpoint: string; nextcloud_url: string }) =>
  unwrap(api().POST('/api/data/add_nextcloud_server', { body: { user_id: uid(), ...b } }));

// ---------- Settings: feed problems ----------

export type FeedProblems = S['FeedProblems'];
export type FailingFeed = S['FailingFeed'];
export type ImportFailure = S['ImportFailure'];
export const getFeedProblems = () => unwrap<FeedProblems>(api().GET('/api/data/feed_problems'));
export const refreshFailingFeed = (podcast_id: number) =>
  unwrap<FeedProblems>(api().POST('/api/data/feed_problems/{podcast_id}/refresh', { params: { path: { podcast_id } } }));
export const retryImport = (id: number) => unwrap(api().POST('/api/data/feed_problems/imports/{id}/retry', { params: { path: { id } } }));
export const removeImport = (id: number) => unwrap(api().POST('/api/data/feed_problems/imports/{id}/remove', { params: { path: { id } } }));
export const dismissImport = (id: number) => unwrap(api().DELETE('/api/data/feed_problems/imports/{id}', { params: { path: { id } } }));

// ---------- Settings: RSS feeds ----------

export const getRssFeedStatus = async () => !!(await unwrap<boolean>(api().GET('/api/data/rss_feed_status')));
export const toggleRssFeeds = async () => !!(await unwrap<{ enabled: boolean }>(api().POST('/api/data/toggle_rss_feeds'))).enabled;
export const getRssKey = async () =>
  (await unwrap<{ rss_key: string }>(api().GET('/api/data/get_rss_key', { params: { query: { user_id: uid() } } }))).rss_key ?? '';

// ---------- Settings: Podcast Index matching ----------

export interface UnmatchedPodcast {
  podcast_id: number;
  podcast_name: string;
  artwork_url?: string | null;
  author?: string | null;
}
export const getUnmatchedPodcasts = async () =>
  (await unwrap<{ podcasts: UnmatchedPodcast[] }>(api().POST('/api/data/get_unmatched_podcasts', { body: { user_id: uid() } }))).podcasts ?? [];
export const getIgnoredPodcasts = async () =>
  (await unwrap<{ podcasts: UnmatchedPodcast[] }>(api().POST('/api/data/get_ignored_podcasts', { body: { user_id: uid() } }))).podcasts ?? [];
export const ignorePodcastIndexId = (podcast_id: number, ignore: boolean) =>
  unwrap(api().POST('/api/data/ignore_podcast_index_id', { body: { user_id: uid(), podcast_id, ignore } }));
export const updatePodcastIndexId = (podcast_id: number, podcast_index_id: number) =>
  unwrap(api().POST('/api/data/update_podcast_index_id', { body: { user_id: uid(), podcast_id, podcast_index_id } }));

// ---------- Settings: API keys / shared links ----------

export interface ApiKeyInfo {
  apikeyid: number;
  userid: number;
  username: string;
  lastfourdigits: string;
  created: string;
}
export const getApiInfo = async () =>
  (await unwrap<{ api_info: ApiKeyInfo[] }>(api().GET('/api/data/get_api_info/{user_id}', { params: { path: { user_id: uid() } } }))).api_info ?? [];
export const createApiKey = async () =>
  (await unwrap<{ api_key: string }>(api().POST('/api/data/create_api_key', { body: { user_id: uid(), rssonly: false } }))).api_key;
export const deleteApiKey = (api_id: number) => unwrap(api().DELETE('/api/data/delete_api_key', { body: { api_id: String(api_id) } }));

export interface SharedLink {
  share_code: string;
  expiration_date: string;
  episode_title: string;
  podcast_name: string;
}
export const getSharedLinks = async () =>
  (await unwrap<{ shared_links: SharedLink[] }>(api().GET('/api/data/get_user_shared_links/{user_id}', { params: { path: { user_id: uid() } } })))
    .shared_links ?? [];
export const deleteSharedLink = (share_code: string) => unwrap(api().DELETE('/api/data/delete_shared_link', { body: { share_code } }));
export const extendSharedLink = (share_code: string, days: number) => unwrap(api().PUT('/api/data/extend_shared_link', { body: { share_code, days } }));

// ---------- Admin settings: small sections ----------

export const toggleSelfService = () => unwrap(api().POST('/api/data/enable_disable_self_service'));

export type UpdateServices = S['UpdateServices'];
export const getUpdateServices = () => unwrap<UpdateServices>(api().GET('/api/data/update_services'));
export const setPodping = (enabled: boolean) => unwrap<UpdateServices>(api().PUT('/api/data/update_services/podping', { body: { enabled } }));

export const getServerDownloadStatus = async () => !!(await unwrap<boolean>(api().GET('/api/data/download_status')));
export const toggleServerDownloads = () => unwrap(api().POST('/api/data/enable_disable_downloads'));
export type DownloadMetadataSettings = S['DownloadMetadataSettings'];
export const getDownloadMetadataSettings = () => unwrap<DownloadMetadataSettings>(api().GET('/api/data/download_metadata_settings'));
export const setDownloadMetadataSettings = (body: DownloadMetadataSettings) => unwrap(api().POST('/api/data/download_metadata_settings', { body }));

export interface YtDlpInfo {
  settings: { auto_update: boolean; channel: string; last_updated?: string | null; last_result?: string | null };
  version?: string | null;
}
/** Admin-only. */
export const getYtDlpSettings = () => unwrap<YtDlpInfo>(api().GET('/api/data/ytdlp_settings'));
export const updateYtDlpSettings = (auto_update: boolean, channel: string) =>
  unwrap(api().POST('/api/data/ytdlp_settings', { body: { auto_update, channel } }));
export const triggerYtDlpUpdate = () => unwrap<{ success: boolean; detail: string }>(api().POST('/api/data/ytdlp_update'));

// ---------- Admin settings: email ----------

export const getEmailSettings = () => unwrap<S['EmailSettingsResponse']>(api().GET('/api/data/get_email_settings'));
export interface EmailForm {
  server_name: string;
  server_port: string;
  from_email: string;
  send_mode: string;
  encryption: string;
  auth_required: boolean;
  email_username: string;
  email_password: string;
}
export const saveEmailSettings = (email_settings: EmailForm) => unwrap(api().POST('/api/data/save_email_settings', { body: { email_settings } }));
export const sendTestEmail = (s: EmailForm, to_email: string, message: string) =>
  unwrap(api().POST('/api/data/send_test_email', { body: { ...s, to_email, message } }));

// ---------- Admin settings: users ----------

export interface ServerUser {
  userid: number;
  fullname: string;
  username: string;
  email: string;
  /** The spec says boolean; older servers send 0/1. */
  isadmin: boolean | number;
}
export const getUsers = () => unwrap<ServerUser[]>(api().GET('/api/data/get_user_info'));
export const addUser = (u: { fullname: string; username: string; email: string; hash_pw: string }) => unwrap(api().POST('/api/data/add_user', { body: u }));
export const deleteUser = (user_id: number) => unwrap(api().DELETE('/api/data/user/delete/{user_id}', { params: { path: { user_id } } }));
export const setIsAdmin = (user_id: number, isadmin: boolean) => unwrap(api().PUT('/api/data/user/set_isadmin', { body: { user_id, isadmin } }));
/** Whether the user is the last admin (who can't lose admin rights). */
export const isFinalAdmin = async (user_id: number) =>
  !!(await unwrap<{ final_admin: boolean }>(api().GET('/api/data/user/final_admin/{user_id}', { params: { path: { user_id } } }))).final_admin;

// ---------- Admin settings: backup / restore ----------

export interface BackupFile {
  filename: string;
  size: number;
  /** Unix seconds. */
  modified: number;
}
// Bodies include user_id like upstream; the spec lists empty objects for some.
export async function listBackupFiles(): Promise<{ files: BackupFile[]; sqlite: boolean }> {
  const d = await unwrap<any>(api().POST('/api/data/list_backup_files', { body: { user_id: uid() } as never }));
  return { files: Array.isArray(d?.backup_files) ? d.backup_files : [], sqlite: d?.database_type === 'sqlite' };
}
export const getScheduledBackup = () =>
  unwrap<{ enabled?: boolean; schedule?: string; retention_count?: number | null; updated_at?: string | null }>(
    api().POST('/api/data/get_scheduled_backup', { body: { user_id: uid() } })
  );
export const scheduleBackup = (cron_schedule: string, enabled: boolean, retention_count: number | null) =>
  unwrap(api().POST('/api/data/schedule_backup', { body: { user_id: uid(), cron_schedule, enabled, retention_count } }));
export const manualBackupToDirectory = () =>
  unwrap<{ filename?: string }>(api().POST('/api/data/manual_backup_to_directory', { body: { user_id: uid() } as never }));
export const deleteBackupFile = (backup_filename: string) =>
  unwrap(api().POST('/api/data/delete_backup_file', { body: { user_id: uid(), backup_filename } as never }));
/** The whole database as SQL text (database_pass is ignored for SQLite). */
export async function backupServer(database_pass: string): Promise<string> {
  const { data, response } = await api().POST('/api/data/backup_server', { body: { database_pass }, parseAs: 'text' });
  if (!response.ok) throw new Error((data as unknown as string) || response.statusText);
  return data as unknown as string;
}
export const restoreBackupFile = (backup_filename: string) =>
  unwrap(api().POST('/api/data/restore_backup_file', { body: { user_id: uid(), backup_filename } as never }));
/** Multipart upload of an SQL backup. */
export async function restoreServer(file: File, database_pass: string) {
  const form = new FormData();
  form.append('database_pass', database_pass);
  form.append('backup_file', file);
  const r = await fetch(`${session.serverName}/api/data/restore_server`, { method: 'POST', headers: { 'Api-Key': session.apiKey }, body: form });
  const text = await r.text().catch(() => '');
  if (!r.ok) throw new Error(text || r.statusText);
  return text;
}

// ---------- Admin settings: OIDC providers ----------

export interface OidcProvider {
  provider_id: number;
  provider_name: string;
  client_id: string;
  authorization_url: string;
  token_url: string;
  user_info_url: string;
  button_text: string;
  scope: string;
  button_color: string;
  button_text_color: string;
  icon_svg?: string | null;
  name_claim?: string | null;
  email_claim?: string | null;
  username_claim?: string | null;
  roles_claim?: string | null;
  user_role?: string | null;
  admin_role?: string | null;
  enabled: boolean;
  initialized_from_env: boolean;
}
export type OidcProviderForm = S['OidcProviderRequest'];
export const listOidcProviders = async () =>
  (await unwrap<{ providers: OidcProvider[] }>(api().GET('/api/data/list_oidc_providers'))).providers ?? [];
export const addOidcProvider = (body: OidcProviderForm) => unwrap(api().POST('/api/data/add_oidc_provider', { body }));
export const updateOidcProvider = (provider_id: number, body: OidcProviderForm) =>
  unwrap(api().PUT('/api/data/update_oidc_provider/{provider_id}', { params: { path: { provider_id } }, body }));
/** The body is the bare provider id. */
export const removeOidcProvider = (provider_id: number) => unwrap(api().POST('/api/data/remove_oidc_provider', { body: provider_id }));
export const discoverOidc = (url: string) =>
  unwrap<{ authorization_endpoint: string; token_endpoint: string; userinfo_endpoint: string }>(api().POST('/api/data/oidc_discovery', { body: { url } }));

// ---------- Per-podcast settings (the podcast page's settings window) ----------

const pod = (podcast_id: number) => ({ user_id: uid(), podcast_id });

export const getAutoDownload = async (podcast_id: number) =>
  !!(await unwrap<{ auto_download: boolean }>(api().POST('/api/data/get_auto_download_status', { body: pod(podcast_id) }))).auto_download;
export const setAutoDownload = (podcast_id: number, auto_download: boolean) =>
  unwrap(api().POST('/api/data/enable_auto_download', { body: { ...pod(podcast_id), auto_download } }));
export const setAutoPlayNext = (podcast_id: number, auto_play_next: boolean) =>
  unwrap(api().POST('/api/data/enable_auto_play_next', { body: { ...pod(podcast_id), auto_play_next } }));
export const getAutoQueue = async (podcast_id: number) =>
  !!(await unwrap<{ auto_queue: boolean }>(api().POST('/api/data/get_auto_queue_status', { body: pod(podcast_id) }))).auto_queue;
export const setAutoQueue = (podcast_id: number, auto_queue: boolean) =>
  unwrap(api().POST('/api/data/enable_auto_queue', { body: { ...pod(podcast_id), auto_queue } }));
export const getPodcastNotifications = async (podcast_id: number) =>
  !!(await unwrap<{ enabled: boolean }>(api().POST('/api/data/podcast/notification_status', { body: pod(podcast_id) }))).enabled;
export const setPodcastNotifications = (podcast_id: number, enabled: boolean) =>
  unwrap(api().PUT('/api/data/podcast/toggle_notifications', { body: { ...pod(podcast_id), enabled } }));
export const getPodcastFavorite = async (podcast_id: number) =>
  !!(await unwrap<{ is_favorite: boolean }>(api().POST('/api/data/podcast/favorite_status', { body: pod(podcast_id) }))).is_favorite;
export const setPodcastFavorite = (podcast_id: number, is_favorite: boolean) =>
  unwrap(api().PUT('/api/data/podcast/toggle_favorite', { body: { ...pod(podcast_id), is_favorite } }));

export const setPodcastPlaybackSpeed = (podcast_id: number, playback_speed: number) =>
  unwrap(api().POST('/api/data/podcast/set_playback_speed', { body: { ...pod(podcast_id), playback_speed } }));
export const clearPodcastPlaybackSpeed = (podcast_id: number) =>
  unwrap(api().POST('/api/data/clear_podcast_playback_speed', { body: pod(podcast_id) }));
export const setSkipTimes = (podcast_id: number, start_skip: number, end_skip: number) =>
  unwrap(api().POST('/api/data/adjust_skip_times', { body: { ...pod(podcast_id), start_skip, end_skip } }));

export const getPodcastAutoDeleteDays = (podcast_id: number) =>
  unwrap<{ days: number; customized: boolean }>(api().POST('/api/data/get_auto_download_delete_days', { body: pod(podcast_id) }));
export const setPodcastAutoDeleteDays = (podcast_id: number, days: number) =>
  unwrap(api().POST('/api/data/podcast/set_auto_download_delete_days', { body: { ...pod(podcast_id), days } }));
export const clearPodcastAutoDeleteDays = (podcast_id: number) =>
  unwrap(api().POST('/api/data/clear_podcast_auto_download_delete_days', { body: pod(podcast_id) }));
/** With no podcast this is the user's default. */
export const getDeleteOnComplete = (podcast_id?: number) =>
  unwrap<{ enabled: boolean; customized: boolean }>(
    api().POST('/api/data/get_auto_delete_on_complete', { body: { user_id: uid(), podcast_id: podcast_id ?? null } })
  );
/** `null` goes back to the user's default. */
export const setPodcastDeleteOnComplete = (podcast_id: number, enabled: boolean | null) =>
  unwrap(api().POST('/api/data/podcast/set_auto_delete_on_complete', { body: { ...pod(podcast_id), enabled } }));

export const getPodcastCoverPref = async (podcast_id: number) =>
  !!(await unwrap<{ use_podcast_covers: boolean }>(
    api().GET('/api/data/user/get_podcast_cover_preference', { params: { query: pod(podcast_id) as never } })
  )).use_podcast_covers;
export const setPodcastCoverPref = (podcast_id: number, use_podcast_covers: boolean) =>
  unwrap(api().POST('/api/data/user/set_global_podcast_cover_preference', { body: { ...pod(podcast_id), use_podcast_covers } }));

export const getSilenceTrim = (podcast_id: number) =>
  unwrap<{ enabled: boolean; threshold: number }>(api().GET('/api/data/get_silence_trim', { params: { query: pod(podcast_id) } }));
export const setSilenceTrim = (podcast_id: number, enabled: boolean, threshold: number) =>
  unwrap(api().POST('/api/data/adjust_silence_trim', { body: { ...pod(podcast_id), enabled, threshold } }));

type FlagPath = '/api/data/get_auto_transcribe' | '/api/data/get_auto_ad_detect' | '/api/data/get_ad_skip_auto_activate';
const getFlag = async (path: FlagPath, podcast_id: number) =>
  !!(await unwrap<{ enabled: boolean }>(api().GET(path, { params: { query: pod(podcast_id) } }))).enabled;
export const getAutoTranscribe = (id: number) => getFlag('/api/data/get_auto_transcribe', id);
export const getAutoAdDetect = (id: number) => getFlag('/api/data/get_auto_ad_detect', id);
export const getAdSkipAutoActivate = (id: number) => getFlag('/api/data/get_ad_skip_auto_activate', id);
export const setAutoTranscribe = (podcast_id: number, enabled: boolean) =>
  unwrap(api().POST('/api/data/adjust_auto_transcribe', { body: { ...pod(podcast_id), enabled } }));
export const setAutoAdDetect = (podcast_id: number, enabled: boolean) =>
  unwrap(api().POST('/api/data/adjust_auto_ad_detect', { body: { ...pod(podcast_id), enabled } }));
export const setAdSkipAutoActivate = (podcast_id: number, enabled: boolean) =>
  unwrap(api().POST('/api/data/adjust_ad_skip_auto_activate', { body: { ...pod(podcast_id), enabled } }));

/** YouTube channels: days to keep downloaded audio (0 = no limit). */
export const getFeedCutoffDays = async (podcast_id: number) =>
  (await unwrap<{ feed_cutoff_days: number }>(api().GET('/api/data/get_feed_cutoff_days', { params: { query: pod(podcast_id) } }))).feed_cutoff_days ?? 0;
export const setFeedCutoffDays = (podcast_id: number, feed_cutoff_days: number) =>
  unwrap(api().POST('/api/data/update_feed_cutoff_days', { body: { ...pod(podcast_id), feed_cutoff_days } }));
export type VideoFilter = { min_minutes: number | null; max_minutes: number | null; title_contains: string | null };
export const getVideoFilter = (podcast_id: number) =>
  unwrap<VideoFilter>(api().GET('/api/data/youtube_video_filter', { params: { query: pod(podcast_id) } }));
export const setVideoFilter = (podcast_id: number, f: VideoFilter) =>
  unwrap<VideoFilter>(api().POST('/api/data/update_youtube_video_filter', { body: { ...pod(podcast_id), ...f } }));

export const addCategory = (podcast_id: number, category: string) =>
  unwrap(api().POST('/api/data/add_category', { body: { ...pod(podcast_id), category } }));
export const removeCategory = (podcast_id: number, category: string) =>
  unwrap(api().POST('/api/data/remove_category', { body: { ...pod(podcast_id), category } }));

/** Only the fields being changed; anything left out stays as it is. */
export type PodcastInfoEdit = Partial<{
  feed_url: string;
  username: string;
  password: string;
  podcast_name: string;
  description: string;
  author: string;
  artwork_url: string;
  website_url: string;
  podcast_index_id: number;
}>;
export const updatePodcastInfo = (podcast_id: number, edit: PodcastInfoEdit) =>
  unwrap<{ success: boolean; message: string }>(api().PUT('/api/data/update_podcast_info', { body: { ...pod(podcast_id), ...edit } }));
/** Read the feed again; `reset_edits` also drops the user's own edits. */
export const refreshPodcastDetails = (podcast_id: number, reset_edits: boolean) =>
  unwrap<{ success: boolean; message: string }>(api().POST('/api/data/refresh_podcast_details', { body: { podcast_id, reset_edits } }));

export const getMergedPodcasts = async (podcast_id: number) =>
  (await unwrap<{ merged_podcast_ids: number[] }>(api().GET('/api/data/{podcast_id}/merged', { params: { path: { podcast_id } } }))).merged_podcast_ids ?? [];
export const mergePodcasts = (podcast_id: number, secondary_podcast_ids: number[]) =>
  unwrap<{ success: boolean; message: string }>(
    api().POST('/api/data/{podcast_id}/merge', { params: { path: { podcast_id } }, body: { secondary_podcast_ids } })
  );
export const unmergePodcast = (podcast_id: number, target_podcast_id: number) =>
  unwrap<{ success: boolean; message: string }>(
    api().POST('/api/data/{podcast_id}/unmerge/{target_podcast_id}', { params: { path: { podcast_id, target_podcast_id } } })
  );
