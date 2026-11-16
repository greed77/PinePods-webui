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
  let firstLoginDone = opts.firstLoginDone ?? true;
  const wav = silentWav();

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  const withFlags = (e: (typeof EPISODES)[number]) => ({ ...e, queued: queue.includes(e.episodeid) });

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
        return json(route, { status: 'success' });
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
        return json(route, { theme: 'Nordic' });
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
      case 'get_playlists':
        return json(route, { playlists: [] });
      case 'return_pods/3':
        return json(route, { pods: PODCASTS });
      case 'get_podcast_details': {
        const pod = PODCASTS.find((x) => x.podcastid === Number(query.podcast_id))!;
        return json(route, { details: { ...pod, autodownload: false, isyoutubechannel: false, notificationsenabled: false, playbackspeed: 1, startskip: 0, endskip: 0 } });
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
        return json(route, { playback_speed: 1, start_skip: 0, end_skip: 0, playback_speed_customized: false });
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
        return json(route, { detail: 'Episode saved!' });
      default:
        // Bookkeeping endpoints (history, listen time, play count...) just succeed.
        return json(route, { detail: 'ok' });
    }
  });

  return {
    calls,
    queue,
    /** Calls to an /api/data/<name> endpoint. */
    called: (name: string) => calls.filter((c) => c.path.replace(/^\/api\/data\//, '') === name)
  };
}
