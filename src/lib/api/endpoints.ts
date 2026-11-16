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
