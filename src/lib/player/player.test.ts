// Player engine behaviour, with the API mocked. Mirrors upstream audio.rs rules:
// what gets recorded when playback starts, where it starts, and what plays next.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Episode } from '$lib/api/endpoints';

// Default API responses; reapplied before every test so per-test overrides don't leak.
const defaults: Record<string, unknown> = {
  getDefaultVolume: 80,
  checkEpisodeInDb: true,
  getEpisodeIdByUrl: 0,
  recordHistory: {},
  incrementPlayed: {},
  incrementListenTime: {},
  recordListenDuration: {},
  updateEpisodeDuration: {},
  queueBump: {},
  markEpisodeCompleted: {},
  getPodcastIdFromEpisode: 86,
  getAutoPlayNext: false,
  getPlayEpisodeDetails: { playback_speed: 1.5, start_skip: 30, end_skip: 10, playback_speed_customized: true },
  getSkipSegments: { segments: [], ad_audio: null },
  getPodcasting2Data: { chapters: [], transcripts: [], people: [] },
  getQueuedEpisodes: [],
  getNextPodcastEpisode: null,
  getNextPlaylistEpisode: null
};

vi.mock('$lib/api/endpoints', async (orig) => {
  const actual = await orig<typeof import('$lib/api/endpoints')>();
  return { ...actual, ...Object.fromEntries(Object.keys(defaults).map((n) => [n, vi.fn()])) };
});

const E = await import('$lib/api/endpoints');
const { player, adFits } = await import('./player.svelte');
const { episodeStatus } = await import('$lib/stores/app.svelte');
const { session } = await import('$lib/stores/session.svelte');

const ep = (id: number, extra: Partial<Episode> = {}): Episode =>
  E.normEpisode({ episodeid: id, episodetitle: `Ep ${id}`, episodeurl: `https://feed/${id}.mp3`, episodeduration: 600, ...extra });

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  for (const [name, value] of Object.entries(defaults)) {
    (E as unknown as Record<string, ReturnType<typeof vi.fn>>)[name].mockReset().mockResolvedValue(value);
  }
  session.set({ UserID: 3, UseGravatar: false }, { server_name: 'https://pods.example', api_key: 'k' }, {});
  // jsdom has no media playback: make play/pause fire their events.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});

afterEach(() => {
  player.stop();
  vi.restoreAllMocks();
});

describe('starting playback', () => {
  it('records history, bumps the queue and applies per-podcast settings', async () => {
    await player.play(ep(1, { listenduration: 5 }));
    await flush();
    expect(player.current?.episode.episodeid).toBe(1);
    expect(player.playing).toBe(true);
    expect(player.speed).toBe(1.5);
    expect(player.volume).toBe(80);
    // Starts at the later of saved position and the podcast's intro skip.
    expect(player.current?.startPosSec).toBe(30);
    expect(player.current?.endPosSec).toBe(10);
    expect(E.incrementPlayed).toHaveBeenCalled();
    expect(E.recordHistory).toHaveBeenCalledWith(1, 0, false);
    expect(E.queueBump).toHaveBeenCalled();
    expect(episodeStatus.queued.has(1)).toBe(true);
  });

  it('resumes from the saved position when it is past the intro skip', async () => {
    await player.play(ep(2, { listenduration: 120 }));
    expect(player.current?.startPosSec).toBe(120);
  });

  it('does not queue episodes of podcasts that auto-play next', async () => {
    vi.mocked(E.getAutoPlayNext).mockResolvedValueOnce(true);
    await player.play(ep(3));
    await flush();
    expect(E.queueBump).not.toHaveBeenCalled();
  });

  it('streams server downloads through the API', async () => {
    await player.play(ep(4, { downloaded: true }));
    expect(player.current?.src).toContain('/api/data/stream/4?');
  });

  it('toggles instead of restarting when the same episode is played again', async () => {
    await player.play(ep(5));
    await player.play(ep(5));
    expect(player.playing).toBe(false);
    expect(E.getPlayEpisodeDetails).toHaveBeenCalledTimes(1);
  });
});

describe('when an episode ends', () => {
  const end = async () => {
    player.media!.dispatchEvent(new Event('ended'));
    await new Promise((r) => setTimeout(r, 20));
  };

  it('marks it completed and plays the next queued episode', async () => {
    vi.mocked(E.getQueuedEpisodes).mockResolvedValue([
      ep(10, { queueposition: 1 }),
      ep(12, { queueposition: 3 }),
      ep(11, { queueposition: 2 })
    ]);
    await player.play(ep(10));
    await end();
    expect(E.markEpisodeCompleted).toHaveBeenCalledWith({ episodeid: 10, is_youtube: false });
    expect(episodeStatus.completed.has(10)).toBe(true);
    expect(player.current?.episode.episodeid).toBe(11);
  });

  it('prefers the next playlist episode when playing from a playlist', async () => {
    vi.mocked(E.getNextPlaylistEpisode).mockResolvedValue(ep(20));
    vi.mocked(E.getQueuedEpisodes).mockResolvedValue([ep(30, { queueposition: 1 })]);
    await player.play(ep(19), { playlistId: 7 });
    await end();
    expect(E.getNextPlaylistEpisode).toHaveBeenCalledWith(19, 7);
    expect(player.current?.episode.episodeid).toBe(20);
  });

  it('plays the podcast’s next episode when auto-play-next is on', async () => {
    vi.mocked(E.getAutoPlayNext).mockResolvedValue(true);
    vi.mocked(E.getNextPodcastEpisode).mockResolvedValue(ep(41));
    await player.play(ep(40));
    await end();
    expect(player.current?.episode.episodeid).toBe(41);
  });

  it('stops when nothing is next', async () => {
    await player.play(ep(50));
    await end();
    expect(player.current?.episode.episodeid).toBe(50);
    expect(player.playing).toBe(false);
  });

  it('only finishes once even if ended fires twice', async () => {
    await player.play(ep(60));
    player.media!.dispatchEvent(new Event('ended'));
    await end();
    expect(E.markEpisodeCompleted).toHaveBeenCalledTimes(1);
  });
});

describe('adFits (upstream AdAudio::fits)', () => {
  it('trusts ad times on the analyzed server download', () => {
    expect(adFits({ download: 'match', analyzed: { duration: 100 } }, 500, true)).toBe(true);
  });
  it('requires a matching length otherwise', () => {
    expect(adFits({ download: 'mismatch', analyzed: { duration: 1000 } }, 1001.5, false)).toBe(true);
    expect(adFits({ download: 'mismatch', analyzed: { duration: 1000 } }, 1030, false)).toBe(false);
  });
  it('applies when nothing was analyzed', () => {
    expect(adFits({}, 100, false)).toBe(true);
  });
});
