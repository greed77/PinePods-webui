import { describe, expect, it, beforeEach } from 'vitest';
import { normEpisode, streamUrl } from './endpoints';
import { session } from '$lib/stores/session.svelte';

describe('normEpisode', () => {
  it('normalizes the capitalized keys podcast_episodes returns', () => {
    const ep = normEpisode({
      podcastname: '99% Invisible',
      Episodetitle: 'Title',
      Episodepubdate: '2026-11-13T08:00:00',
      Episodedescription: '<p>d</p>',
      Episodeartwork: 'art.jpg',
      Episodeurl: 'https://x/ep.mp3',
      Episodeduration: 2367,
      Listenduration: null,
      Episodeid: 11719,
      Completed: true,
      saved: false,
      queued: true,
      downloaded: false,
      is_youtube: false,
      is_video: false
    });
    expect(ep).toMatchObject({
      episodetitle: 'Title',
      episodeid: 11719,
      episodeduration: 2367,
      listenduration: 0,
      completed: true,
      queued: true
    });
  });

  it('fills defaults for missing fields', () => {
    const ep = normEpisode({ episodeid: 1 });
    expect(ep.episodetitle).toBe('');
    expect(ep.completed).toBe(false);
    expect(ep.queueposition).toBeNull();
  });
});

describe('streamUrl', () => {
  beforeEach(() => {
    session.set(
      { UserID: 3, Username: 'u', UseGravatar: false },
      { server_name: 'https://pods.example', api_key: 'k&y' },
      {}
    );
  });
  const base = normEpisode({ episodeid: 9, episodeurl: 'https://feed/ep.mp3' });

  it('plays straight from the feed by default', () => {
    expect(streamUrl(base)).toBe('https://feed/ep.mp3');
  });

  it('streams through the server for downloads and local media', () => {
    const url = 'https://pods.example/api/data/stream/9?api_key=k%26y&user_id=3';
    expect(streamUrl({ ...base, downloaded: true })).toBe(url);
    expect(streamUrl(base, true)).toBe(url);
    expect(streamUrl({ ...base, episodeurl: 'local://x.mp3' })).toBe(url);
  });

  it('marks YouTube streams', () => {
    expect(streamUrl({ ...base, episodeurl: 'https://www.youtube.com/watch?v=1' })).toMatch(/&type=youtube$/);
  });
});

describe('people endpoints', () => {
  // The API client keeps the fetch it was created with, so one stub serves every test.
  let next: unknown = null;
  const respond = (body: unknown) => (next = body);
  globalThis.fetch = (async () => new Response(JSON.stringify(next), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

  it('getPodcastPeople always returns arrays (a bad body once crashed the podcast header)', async () => {
    const { getPodcastPeople } = await import('./endpoints');
    respond({ detail: 'ok' });
    expect(await getPodcastPeople(1)).toEqual({ people: [], guests: [] });
  });

  it('getPersonProfile turns outside-library episodes into previews played by URL', async () => {
    const { getPersonProfile } = await import('./endpoints');
    respond({
      person: { id: 7, name: 'R', followed: false },
      podcasts: [],
      episodes: [],
      external_episodes: [{ episodeid: 9001, podcastid: 5, podcastname: 'Out', feedurl: 'f', episodetitle: 'Guest', episodeurl: 'u', episodeartwork: 'a', episodeduration: 60 }],
      refreshing: true
    });
    const p = await getPersonProfile(7, 50, 0);
    expect(p.refreshing).toBe(true);
    expect(p.external_episodes[0]).toMatchObject({ episodeid: 0, podcastid: 0, episodetitle: 'Guest', episodeurl: 'u', artworkurl: 'a' });
  });

  it('getPodcastFunding keeps only http(s) links from the feed', async () => {
    const { getPodcastFunding } = await import('./endpoints');
    respond({
      funding: [
        { url: ' https://patreon.example/show ', description: 'Patreon' },
        { url: 'javascript:alert(1)', description: 'Bad' },
        { url: 'HTTP://tips.example', description: null },
        { description: 'No url' }
      ],
      people: [],
      guests: []
    });
    expect(await getPodcastFunding(1)).toEqual([
      { url: 'https://patreon.example/show', description: 'Patreon' },
      { url: 'HTTP://tips.example', description: '' }
    ]);
    respond({ detail: 'ok' });
    expect(await getPodcastFunding(1)).toEqual([]);
  });
});
