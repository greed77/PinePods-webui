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
