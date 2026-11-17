// An in-browser fake PinePods API for end-to-end tests. Every /api request the
// app makes is answered here, so tests are deterministic and never touch a real
// server. Response shapes mirror a live 0.9.2 server. Calls are recorded so
// tests can assert on the bookkeeping the UI performs.
import type { Page, Route } from '@playwright/test';

export interface MockOptions {
  mfa?: boolean;
  firstLoginDone?: boolean;
}

export interface Call {
  method: string;
  path: string;
  query: Record<string, string>;
  body: any;
}

const USER = { UserID: 3, Fullname: 'Test Dev', Username: 'test_dev', Email: 'test@test.com', Hashed_PW: null, Salt: null, UseGravatar: false };
export const KEY = 'test-api-key';

const podcast = (id: number, name: string, count: number) => ({
  podcastid: id,
  podcastname: name,
  artworkurl: '',
  description: `<p>About ${name}</p>`,
  episodecount: count,
  websiteurl: 'https://example.com',
  feedurl: `https://example.com/${id}.xml`,
  author: 'Author',
  categories: { '0': 'Arts' },
  explicit: false,
  podcastindexid: id * 10,
  is_favorite: false,
  is_video: false,
  oldest_episode_date: '2020-01-01T00:00:00',
  newest_episode_date: '2026-11-13T08:00:00',
  play_count: 0
});

export const PODCASTS = [podcast(86, 'Alpha Show', 3), podcast(87, 'Beta Cast', 1)];

const episode = (id: number, podcastid: number, title: string, extra: Record<string, unknown> = {}) => ({
  podcastid,
  podcastname: PODCASTS.find((p) => p.podcastid === podcastid)!.podcastname,
  episodetitle: title,
  episodepubdate: '2026-11-13T08:00:00',
  episodedescription: `<p>Notes for ${title}</p>`,
  episodeartwork: '',
  episodeurl: `https://media.test/${id}.wav`,
  episodeduration: 3,
  listenduration: 0,
  episodeid: id,
  completed: false,
  saved: false,
  queued: false,
  downloaded: false,
  is_youtube: false,
  is_video: false,
  ...extra
});

export const EPISODES = [
  episode(101, 86, 'First Episode'),
  episode(102, 86, 'Second Episode', { completed: true }),
  episode(103, 86, 'Third Episode'),
  episode(201, 87, 'Beta One')
];

const person = (id: number, name: string, role: string) => ({
  id,
  podpeople_id: id * 10,
  name,
  img: null,
  href: null,
  role,
  roles: [role],
  group: null,
  scope: role === 'guest' ? 'episodes' : 'podcast',
  episode_count: 1,
  sources: ['feed'],
  verified: true,
  followed: false
});

/** A short silent WAV so <audio> can genuinely load and play. */
function silentWav(seconds = 3, rate = 8000) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n, 40);
  buf.fill(128, 44);
  return buf;
}

export async function mockApi(page: Page, opts: MockOptions = {}) {
  const calls: Call[] = [];
  const queue: number[] = [];
  const saved = new Set<number>();
  const collections: any[] = [
    { collection_id: 1, user_id: 3, name: 'Saved', description: null, is_default: true, icon: 'ph-bookmark-simple', episode_count: 0, auto_add_categories: null }
  ];
  const playlists: any[] = [];
  let nextId = 100;
  let firstLoginDone = opts.firstLoginDone ?? true;
  const followed = new Set<number>();
  const ytSubscribed = new Set<string>();
  let syncServerEnabled = false;
  let theme = 'Nordic';
  const state = { verifyStatus: 200, admin: false };
  const users: any[] = [
    { userid: 1, fullname: 'Background Tasks', username: 'background_tasks', email: 'inactive', isadmin: 0 },
    { userid: 3, fullname: 'Test Dev', username: 'test_dev', email: 'test@test.com', isadmin: 1 },
    { userid: 4, fullname: 'Other', username: 'other', email: 'other@test.com', isadmin: 0 }
  ];
  const oidc: any[] = [];
  // Per-podcast settings: user edits to podcast info and categories, merges, speed override.
  const podEdits: Record<number, Record<string, unknown>> = {};
  const merged: Record<number, number[]> = {};
  let speedOverride: number | null = null;
  const wav = silentWav();

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  const withFlags = (e: (typeof EPISODES)[number]) => ({ ...e, queued: queue.includes(e.episodeid), saved: saved.has(e.episodeid) });

  await page.route('https://media.test/**', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
  // Artwork and other third-party requests: answer empty so nothing leaves the machine.
  await page.route(/gravatar\.com|fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 404, body: '' }));

  // Match by path prefix: a '**/api/**' glob would also catch the app's own
  // source modules under /src/lib/api/ in dev.
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams);
    let body: any = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    calls.push({ method: req.method(), path, query, body });

    const authed = req.headers()['api-key'] === KEY || query.api_key === KEY;
    const p = path.replace(/^\/api\/data\//, '');

    // --- no auth needed ---
    if (path === '/api/pinepods_check') return json(route, { status_code: 200, pinepods_instance: true });
    if (p === 'get_key') {
      const basic = req.headers()['authorization'] ?? '';
      const [u, pw] = Buffer.from(basic.replace(/^Basic /, ''), 'base64').toString().split(':');
      if (u !== 'test_dev' || pw !== 'secret') return json(route, { detail: 'Invalid credentials' }, 401);
      if (opts.mfa) return json(route, { status: 'mfa_required', mfa_required: true, user_id: 3, mfa_session_token: 'mfa-token' });
      return json(route, { status: 'success', retrieved_key: KEY, mfa_required: false, user_id: 3, mfa_session_token: null });
    }
    if (p === 'verify_mfa_and_get_key') {
      const ok = body?.mfa_session_token === 'mfa-token' && body?.mfa_code === '123456';
      return ok ? json(route, { status: 'success', retrieved_key: KEY, verified: true }) : json(route, { detail: 'Invalid code' }, 401);
    }
    if (p === 'public_oidc_providers') return json(route, { providers: [], disable_standard_login: false });
    if (p === 'get_available_languages') return json(route, { languages: [{ code: 'en', name: 'English' }, { code: 'de', name: 'Deutsch' }] });
    if (p === 'self_service_status') return json(route, { status: false, first_admin_created: true });
    if (p === 'get_server_default_language') return json(route, { default_language: 'en' });
    if (path.startsWith('/api/proxy/image')) return route.fulfill({ status: 404, body: '' });

    if (!authed) return json(route, { detail: 'Invalid API key' }, 401);

    // --- authed ---
    if (path.startsWith('/api/data/stream/')) return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
    switch (p) {
      case 'verify_key':
        return state.verifyStatus === 200 ? json(route, { status: 'success' }) : json(route, { detail: 'error' }, state.verifyStatus);
      case 'get_user':
        return json(route, { status: 'success', retrieved_id: 3 });
      case 'user_details_id/3':
        return json(route, USER);
      case 'config':
        return json(route, { api_url: 'https://search.example', proxy_url: '', people_url: '' });
      case 'first_login_done/3':
        return json(route, { FirstLogin: firstLoginDone });
      case 'setup_time_info':
        firstLoginDone = true;
        return json(route, { success: true });
      case 'update_user_language':
        return json(route, { success: true });
      case 'get_theme/3':
        return json(route, { theme });
      case 'user/set_theme':
        theme = body.new_theme;
        return json(route, { detail: 'ok' });
      case 'get_time_info':
        return json(route, { timezone: 'UTC', hour_pref: 24, date_format: 'ISO' });
      case 'get_user_language':
        return json(route, { language: 'en' });
      case 'get_pinepods_version':
        return json(route, { data: '0.9.2' });
      case 'startpage':
        return json(route, { StartPage: 'home' });
      case 'home_overview':
        return json(route, {
          downloaded_count: 0,
          saved_count: 0,
          queue_count: queue.length,
          queue_preview: EPISODES.filter((e) => queue.includes(e.episodeid)).map(withFlags),
          in_progress_episodes: [],
          recent_episodes: EPISODES.map(withFlags),
          top_podcasts: PODCASTS,
          weekly_stats: { episodes_completed: 1, seconds_listened: 3900 }
        });
      case 'return_pods/3':
        return json(route, { pods: PODCASTS });
      case 'get_podcast_details': {
        const pod = PODCASTS.find((x) => x.podcastid === Number(query.podcast_id))!;
        return json(route, {
          details: { ...pod, ...podEdits[Number(query.podcast_id)], autodownload: false, isyoutubechannel: false, notificationsenabled: false, playbackspeed: 1, startskip: 0, endskip: 0 }
        });
      }
      case 'podcast_episodes': {
        let eps = EPISODES.filter((e) => e.podcastid === Number(query.podcast_id));
        if (query.filter === 'completed') eps = eps.filter((e) => e.completed);
        if (query.filter === 'incomplete') eps = eps.filter((e) => !e.completed);
        if (query.search) eps = eps.filter((e) => e.episodetitle.toLowerCase().includes(query.search.toLowerCase()));
        // Real server capitalizes these keys.
        return json(route, {
          total: eps.length,
          episodes: eps.map((e) => ({
            podcastname: e.podcastname,
            Episodetitle: e.episodetitle,
            Episodepubdate: e.episodepubdate,
            Episodedescription: e.episodedescription,
            Episodeartwork: e.episodeartwork,
            Episodeurl: e.episodeurl,
            Episodeduration: e.episodeduration,
            Listenduration: e.listenduration,
            Episodeid: e.episodeid,
            Completed: e.completed,
            saved: false,
            queued: queue.includes(e.episodeid),
            downloaded: false,
            is_youtube: false,
            is_video: false
          }))
        });
      }
      case 'get_episode_metadata': {
        const e = EPISODES.find((x) => x.episodeid === body?.episode_id);
        return e ? json(route, { episode: withFlags(e) }) : json(route, { detail: 'Episode not found' }, 404);
      }
      case 'fetch_podcasting_2_data':
        return json(route, { chapters: [], people: [], transcripts: [] });
      case 'episode_skip_segments':
        return json(route, { segments: [], ad_audio: null });
      case 'get_queued_episodes':
        return json(route, {
          data: queue.map((id, i) => ({ ...withFlags(EPISODES.find((e) => e.episodeid === id)!), queueposition: i + 1, queuedate: '2026-11-16T00:00:00' }))
        });
      case 'queue_pod':
        if (!queue.includes(body.episode_id)) queue.push(body.episode_id);
        return json(route, { data: 'Episode queued' });
      case 'queue_bump':
        queue.splice(0, queue.length, body.episode_id, ...queue.filter((x) => x !== body.episode_id));
        return json(route, { data: 'Moved to top' });
      case 'remove_queued_pod':
        queue.splice(0, queue.length, ...queue.filter((x) => x !== body.episode_id));
        return json(route, { data: 'Removed' });
      case 'reorder_queue':
        queue.splice(0, queue.length, ...body.episodes.map((e: { episode_id: number }) => e.episode_id));
        return json(route, { message: 'Queue reordered' });
      case 'get_podcast_id_from_ep_id': {
        const e = EPISODES.find((x) => x.episodeid === Number(query.episode_id));
        return json(route, { podcast_id: e?.podcastid ?? 0 });
      }
      case 'get_play_episode_details':
        return json(route, { playback_speed: speedOverride ?? 1, start_skip: 0, end_skip: 0, playback_speed_customized: speedOverride !== null });
      case 'get_auto_play_next_status':
        return json(route, { auto_play_next: false });
      case 'get_default_volume':
        return json(route, { default_volume: 50 });
      case 'check_episode_in_db/3':
        return json(route, { episode_in_db: true });
      case 'mark_episode_completed':
        queue.splice(0, queue.length, ...queue.filter((x) => x !== body.episode_id));
        return json(route, { detail: 'Episode marked as completed' });
      case 'save_episode':
        saved.add(body.episode_id);
        return json(route, { detail: 'Episode saved!' });
      case 'remove_saved_episode':
        saved.delete(body.episode_id);
        return json(route, { detail: 'Removed' });

      // ---- stage 2 ----
      case 'return_episodes/3': {
        const off = Number(query.offset ?? 0),
          lim = Number(query.limit ?? 50);
        return json(route, { episodes: EPISODES.slice(off, off + lim).map(withFlags), total: EPISODES.length });
      }
      case 'user_history/3': {
        let h = EPISODES.filter((e) => e.episodeid === 101 || e.episodeid === 102).map((e) => ({ ...withFlags(e), listendate: '2026-11-16T00:00:00' }));
        if (query.filter === 'completed') h = h.filter((e) => e.completed);
        return json(route, { data: h, total: h.length });
      }
      case 'collections/user/3':
        return json(route, { collections });
      case 'collections/categories/3':
        return json(route, { categories: ['Arts'] });
      case 'collections/create': {
        const c = { collection_id: nextId++, user_id: 3, name: body.name, description: body.description, is_default: false, icon: body.icon, episode_count: 0, auto_add_categories: body.auto_add_categories };
        collections.push(c);
        return json(route, { detail: 'Collection created', collection_id: c.collection_id });
      }
      case 'saved_episode_list/3': {
        const s = EPISODES.filter((e) => saved.has(e.episodeid)).map((e) => ({ ...withFlags(e), saved: true }));
        return json(route, { saved_episodes: s, total: s.length });
      }
      case 'podcast_download_summary/3':
        return json(route, { podcasts: [] });
      case 'get_playlists':
        return json(route, { playlists });
      case 'create_playlist': {
        const pl = { ...body, playlist_id: nextId++, episode_count: 0, is_system_playlist: false };
        playlists.push(pl);
        return json(route, { detail: 'Playlist created', playlist_id: pl.playlist_id });
      }
      case 'get_playlist_episodes': {
        const pl = playlists.find((x) => x.playlist_id === Number(query.playlist_id));
        return json(route, { episodes: EPISODES.slice(0, 2).map(withFlags), total: 2, playlist_info: { ...pl, episode_count: 2 } });
      }
      case 'search_data': {
        const q = String(body.search_term ?? '').toLowerCase();
        const hits = EPISODES.filter((e) => e.episodetitle.toLowerCase().includes(q)).map(withFlags);
        return json(route, { data: hits, total: hits.length });
      }
      case 'proxy_search':
        if (query.index === 'youtube')
          return json(route, {
            results: [
              { channelId: 'UC1', name: 'Tube One', description: 'First channel', url: 'https://www.youtube.com/channel/UC1', thumbnailUrl: '', recentVideos: [] },
              // The search can return a channel twice; the page shows each once.
              { channelId: 'UC1', name: 'Tube One', description: 'First channel', url: 'https://www.youtube.com/channel/UC1', thumbnailUrl: '', recentVideos: [] },
              { channelId: 'UC2', name: 'Tube Two', description: '', url: 'https://www.youtube.com/channel/UC2', thumbnailUrl: '', recentVideos: [] }
            ]
          });
        return json(route, {
          feeds: [
            { id: 555, title: 'Gamma Radio', url: 'https://example.com/gamma.xml', author: 'G', description: 'Gamma desc', image: '', link: '', categories: { '1': 'Arts' }, explicit: false, episodeCount: 2 }
          ]
        });
      case 'check_podcast':
        return json(route, { exists: PODCASTS.some((p) => p.feedurl === query.podcast_url) });
      case 'fetch_podcast_feed':
        return json(route, {
          episodes: [
            { title: 'Gamma Ep 1', description: '<p>one</p>', pub_date: '2026-11-15T00:00:00+00:00', artwork: '', enclosure_url: 'https://media.test/901.wav', duration: 3, is_video: false },
            { title: 'Gamma Ep 2', description: '<p>two</p>', pub_date: '2026-11-14T00:00:00+00:00', artwork: '', enclosure_url: 'https://media.test/902.wav', duration: 3, is_video: false }
          ]
        });
      case 'recommendations':
        return json(route, []);
      case 'proxy_categories':
        return json(route, { feeds: [{ id: 1, name: 'Arts' }] });
      case 'proxy_trending':
        return json(route, { feeds: [] });
      case 'add_podcast':
        return json(route, { success: true, podcast_id: 99, first_episode_id: 0 });

      // --- stage 3: people ---
      case 'people/podcast/86':
        return json(route, { people: [person(7, 'Roman Mars', 'host')], guests: [person(8, 'Guest Star', 'guest')] });
      case 'people/7':
        return json(route, {
          person: { id: 7, podpeople_id: 70, name: 'Roman Mars', img: null, href: 'https://example.com/roman', followed: followed.has(7) },
          podcasts: [
            { podcastid: 86, podcastname: 'Alpha Show', artworkurl: '', feedurl: 'https://example.com/86.xml', podcastindexid: 860, roles: ['host'], podcast_level: true, episode_count: 3 },
            { podcastid: null, podcastname: 'Outside Show', artworkurl: '', feedurl: 'https://example.com/out.xml', podcastindexid: 999, roles: ['guest'], podcast_level: false, episode_count: 1 }
          ],
          episodes: EPISODES.filter((e) => e.podcastid === 86).map(withFlags),
          external_episodes: [
            {
              episodeid: 9001,
              podcastid: 500,
              podcastname: 'Outside Show',
              feedurl: 'https://example.com/out.xml',
              episodetitle: 'Guest Spot',
              episodepubdate: '2026-11-01T08:00:00',
              episodedescription: '',
              episodeartwork: '',
              episodeurl: 'https://media.test/9001.wav',
              episodeduration: 3,
              completed: false,
              saved: false,
              queued: false,
              downloaded: false,
              is_youtube: false,
              is_video: false
            }
          ],
          refreshing: false
        });
      case 'people/lookup':
        return query.podpeople_id === '70' ? json(route, { person_id: 7 }) : json(route, { detail: 'Not found' }, 404);
      case 'people/followed':
        return json(route, [...followed].map((id) => ({ id, name: id === 7 ? 'Roman Mars' : 'Someone', img: null, followed: true })));
      case 'people/7/follow':
        if (req.method() === 'POST') followed.add(7);
        else followed.delete(7);
        return json(route, { success: true });
      case 'podpeople/discover':
        if (query.kind === 'top-hosts') return json(route, [{ id: 70, name: 'Roman Mars', img: '', podcast_count: 2 }]);
        if (query.kind === 'stats') return json(route, { total_hosts: 1, total_podcasts: 2 });
        return json(route, []);

      // --- stage 3: YouTube ---
      case 'check_youtube_channel':
        return json(route, { exists: ytSubscribed.has(query.channel_url) });
      case 'youtube/subscribe':
        ytSubscribed.add('https://www.youtube.com/channel/' + query.channel_id);
        return json(route, { success: true, podcast_id: 300, message: 'ok' });
      case 'remove_youtube_channel':
        ytSubscribed.delete(body.channel_url);
        return json(route, { success: true });

      // --- stage 3: settings ---
      case 'user_admin_check/3':
        return json(route, { is_admin: state.admin });

      // --- stage 3: admin settings ---
      case 'get_user_info':
        return json(route, users);
      case 'add_user':
        users.push({ userid: ++nextId, fullname: body.fullname, username: body.username, email: body.email, isadmin: 0 });
        return json(route, { detail: 'ok', user_id: nextId });
      case 'user/final_admin/3':
        return json(route, { final_admin: true });
      case 'user/final_admin/4':
        return json(route, { final_admin: false });
      case 'user/set_isadmin': {
        const u = users.find((x) => x.userid === body.user_id);
        if (u) u.isadmin = body.isadmin ? 1 : 0;
        return json(route, { detail: 'ok' });
      }
      case 'list_oidc_providers':
        return json(route, { providers: oidc });
      case 'add_oidc_provider':
        oidc.push({ ...body, provider_id: oidc.length + 1, enabled: true, initialized_from_env: false });
        return json(route, { detail: 'ok' });
      case 'update_services':
        return json(route, {
          search: { url: 'https://search.example', reachable: true, latency_ms: 42, error: null },
          podping: { enabled: false, relay_url: 'https://search.example', relay: null, relay_error: null, client: { pings_seen: 0, feeds_refreshed: 0, last_success_at: null, last_error: null } }
        });
      case 'download_status':
        return json(route, true);
      case 'download_metadata_settings':
        return json(route, { folder_cover: true, episode_cover: true, metadata_sidecar: false, metadata_format: 'json', metadata_subfolder: false });
      case 'ytdlp_settings':
        return json(route, { settings: { auto_update: true, channel: 'stable', last_updated: null, last_result: null }, version: '2026.10.26' });
      case 'get_email_settings':
        return json(route, { Emailsettingsid: 1, ServerName: 'default_server', ServerPort: 587, FromEmail: 'x@y.z', SendMode: 'SMTP', Encryption: 'default_encryption', AuthRequired: 1, Username: 'u', Password: '' });
      case 'get_scheduled_backup':
        return json(route, { enabled: false, schedule: null, retention_count: null, updated_at: null });
      case 'list_backup_files':
        return json(route, { backup_files: [{ filename: 'backup_1.sql', size: 2097152, modified: 1794800000 }] });
      case 'user/custom_themes/3':
        return json(route, { themes: [] });
      case 'my_user_info/3':
        return json(route, { userid: 3, fullname: 'Test Dev', username: 'test_dev', email: 'test@test.com', isadmin: 0, timezone: 'UTC', timeformat: 24, dateformat: 'ISO', language: 'en' });
      case 'get_playback_speed':
        return json(route, { playback_speed: 1.5 });
      case 'get_auto_complete_seconds/3':
        return json(route, { auto_complete_seconds: 0 });
      case 'get_auto_download_delete_days':
        return json(route, { days: 0 });
      case 'get_auto_delete_on_complete':
        return json(route, { enabled: false, customized: false });
      case 'ai_status':
        return json(route, { available: false, transcription_ready: false, ad_removal_ready: false });
      case 'ai_settings':
        return json(route, { detail: 'Admin only' }, 403);
      case 'ai_models':
        return json(route, { models: { whisper: [], llm_local: [] } });
      case 'check_mfa_enabled/3':
        return json(route, { mfa_enabled: false });
      case 'user/get_podcast_cover_preference':
        return json(route, { use_podcast_covers: false });
      case 'user/notification_settings':
        return json(route, req.method() === 'GET' ? { settings: [] } : { detail: 'ok' });
      case 'feed_problems':
        return json(route, { feeds: [], imports: [] });
      case 'rss_feed_status':
        return json(route, false);
      case 'get_unmatched_podcasts':
      case 'get_ignored_podcasts':
        return json(route, { podcasts: [] });
      case 'get_api_info/3':
        return json(route, { api_info: [{ apikeyid: 1, userid: 3, username: 'test_dev', lastfourdigits: KEY.slice(-4), created: '2026-11-01' }] });
      case 'get_user_shared_links/3':
        return json(route, { shared_links: [] });
      case '/api/sync/server':
        if (req.method() === 'PUT') syncServerEnabled = !!body.enabled;
        return json(route, { enabled: syncServerEnabled, username: 'test_dev', server_url: 'https://pods.example', server_url_configured: true, notice: null });
      case '/api/sync/target':
        return json(route, { target: null });
      case '/api/sync/server/app-passwords':
      case '/api/sync/devices':
        return json(route, []);
      // --- per-podcast settings ---
      case 'get_auto_download_status':
        return json(route, { auto_download: false });
      case 'get_auto_queue_status':
        return json(route, { auto_queue: false });
      case 'podcast/notification_status':
        return json(route, { enabled: false });
      case 'podcast/favorite_status':
        return json(route, { is_favorite: false });
      case 'get_silence_trim':
        return json(route, { enabled: false, threshold: 2 });
      case 'podcast/set_playback_speed':
        speedOverride = body.playback_speed;
        return json(route, { detail: 'ok' });
      case 'clear_podcast_playback_speed':
        speedOverride = null;
        return json(route, { detail: 'ok' });
      case 'add_category':
      case 'remove_category': {
        const pod = PODCASTS.find((x) => x.podcastid === body.podcast_id)!;
        const edits = (podEdits[pod.podcastid] ??= {});
        const cats = Object.values((edits.categories ?? pod.categories) as Record<string, string>).filter((c) => c !== body.category);
        if (p === 'add_category') cats.push(body.category);
        edits.categories = Object.fromEntries(cats.map((c, i) => [String(i), c]));
        return json(route, { detail: 'ok' });
      }
      case 'update_podcast_info': {
        const edits = (podEdits[body.podcast_id] ??= {});
        if (body.podcast_name) edits.podcastname = body.podcast_name;
        if (body.author) edits.author = body.author;
        return json(route, { success: true, message: 'Podcast updated' });
      }
      case 'refresh_podcast_details':
        if (body.reset_edits) delete podEdits[body.podcast_id];
        return json(route, { success: true, message: 'ok' });
      default: {
        const m = p.match(/^(\d+)\/(merged|merge|unmerge\/(\d+))$/);
        if (m) {
          const ids = (merged[Number(m[1])] ??= []);
          if (m[2] === 'merge') ids.push(...body.secondary_podcast_ids);
          if (m[3]) ids.splice(ids.indexOf(Number(m[3])), 1);
          return json(route, m[2] === 'merged' ? { merged_podcast_ids: ids } : { success: true, message: 'Done' });
        }
        // Bookkeeping endpoints (history, listen time, play count...) just succeed.
        return json(route, { detail: 'ok' });
      }
    }
  });

  return {
    calls,
    queue,
    saved,
    playlists,
    /** Status verify_key answers with (200 = key valid). */
    state,
    /** Calls to an /api/data/<name> endpoint. */
    called: (name: string) => calls.filter((c) => c.path.replace(/^\/api\/data\//, '') === name)
  };
}
