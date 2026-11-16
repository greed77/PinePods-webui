// Playback engine: a port of upstream components/audio.rs (`on_play_click` and the
// AudioPlayer effects) plus player_ui.rs helpers. One media element lives for the
// whole session, outside any component, so navigation never interrupts playback.
//
// Server bookkeeping matches upstream:
//   on play     check_episode_in_db → record_podcast_history → queue_bump (unless the
//               podcast auto-plays next) · increment_played · get_play_episode_details
//   every 1s    skip silence/ad segments; at (duration - end_skip) mark completed
//   every 30s   record_listen_duration (while playing)
//   every 60s   increment_listen_time (while playing)
//   on end      next playlist episode → next podcast episode (auto-play-next) → queue
import * as E from '$lib/api/endpoints';
import type { Chapter, Episode, SkipSegment } from '$lib/api/endpoints';
import { episodeStatus, toast, ui } from '$lib/stores/app.svelte';

export interface NowPlaying {
  episode: Episode;
  src: string;
  title: string;
  description: string;
  releaseDate: string;
  artworkUrl: string;
  durationSec: number;
  startPosSec: number;
  endPosSec: number;
  isYoutube: boolean;
  isVideo: boolean;
}

class Player {
  current = $state<NowPlaying | null>(null);
  playing = $state(false);
  loadingId = $state<number | null>(null);
  speed = $state(1);
  volume = $state(100);
  expanded = $state(false);
  episodeInDb = $state(false);
  chapters = $state<Chapter[] | null>(null);
  people = $state<any[] | null>(null);
  /** Playhead, refreshed once a second (the seek bar reads the element directly). */
  currentTime = $state(0);

  media: HTMLMediaElement | null = null;
  #playlistId: number | null = null;
  #segments: SkipSegment[] | null = null;
  #adAudio: any = null;
  #volumeSeeded = false;
  #finishedFor: number | null = null;
  #advancing = false;
  #timers: ReturnType<typeof setInterval>[] = [];

  // ---- element ----

  #ensureElement(isVideo: boolean) {
    const wrongType = this.media && (this.media instanceof HTMLVideoElement) !== isVideo;
    if (wrongType && this.media) {
      this.media.pause();
      this.media.removeAttribute('src');
      this.media.load();
      this.media = null;
    }
    if (this.media) return this.media;
    const m = document.createElement(isVideo ? 'video' : 'audio');
    m.preload = 'auto';
    m.addEventListener('play', () => {
      this.playing = true;
      this.loadingId = null;
    });
    m.addEventListener('pause', () => (this.playing = false));
    m.addEventListener('error', () => {
      if (this.loadingId != null) toast.error('Could not load this episode');
      this.loadingId = null;
    });
    m.addEventListener('loadedmetadata', () => this.#onMetadata());
    m.addEventListener('ended', () => this.#finish());
    this.media = m;
    return m;
  }

  /** Upstream probes the real length before playing and stores it if the feed's
   *  was wrong; we read it from the playing element instead. */
  #onMetadata() {
    const cur = this.current,
      m = this.media;
    if (!cur || !m || !Number.isFinite(m.duration) || m.duration <= 0) return;
    const real = Math.floor(m.duration);
    if (real !== cur.episode.episodeduration && cur.episode.episodeid) {
      E.updateEpisodeDuration(cur.episode.episodeid, real, cur.isYoutube).catch(() => {});
    }
    cur.durationSec = m.duration;
  }

  // ---- starting playback ----

  async play(episode: Episode, opts: { skipQueue?: boolean; playlistId?: number | null } = {}) {
    if (this.current?.episode.episodeid === episode.episodeid && episode.episodeid) {
      this.toggle();
      return;
    }
    this.loadingId = episode.episodeid;
    await this.#seedVolume();
    let ep = { ...episode };

    // Bookkeeping runs alongside starting playback, as upstream does.
    this.#recordStart(ep, !!opts.skipQueue);
    E.incrementPlayed().catch(() => {});

    const viaServer = ep.downloaded || episodeStatus.downloaded.has(ep.episodeid);
    const src = E.streamUrl(ep, viaServer);

    let speed = 1,
      startPos = 0,
      endPos = 0;
    if (ep.episodeid) {
      try {
        const podcastId = await E.getPodcastIdFromEpisode(ep.episodeid, ep.is_youtube);
        const d = await E.getPlayEpisodeDetails(podcastId, ep.is_youtube);
        speed = d.playback_speed || 1;
        startPos = Math.max(ep.listenduration || 0, d.start_skip || 0);
        endPos = d.end_skip || 0;
      } catch (e) {
        console.warn('play details failed', e);
        this.loadingId = null;
        toast.error('Could not start playback');
        return;
      }
    }

    this.#playlistId = opts.playlistId ?? null;
    this.#finishedFor = null;
    this.current = {
      episode: ep,
      src,
      title: ep.episodetitle,
      description: ep.episodedescription,
      releaseDate: ep.episodepubdate,
      artworkUrl: ep.episodeartwork || ep.artworkurl || '',
      durationSec: ep.episodeduration,
      startPosSec: startPos,
      endPosSec: endPos,
      isYoutube: ep.is_youtube,
      isVideo: ep.is_video
    };
    this.speed = speed;
    this.currentTime = startPos;
    this.chapters = this.people = null;
    this.#segments = this.#adAudio = null;

    const m = this.#ensureElement(ep.is_video);
    m.src = src;
    m.currentTime = startPos;
    m.playbackRate = speed;
    m.volume = this.volume / 100;
    m.play().catch((e) => {
      console.warn('play() rejected', e);
      this.loadingId = null;
    });

    this.#startTimers();
    this.#loadExtras(ep);
    this.#updateMediaSession();
  }

  async #recordStart(ep: Episode, skipQueue: boolean) {
    try {
      let exists = await E.checkEpisodeInDb(ep.episodetitle, ep.episodeurl);
      if (exists && !ep.episodeid) {
        const id = await E.getEpisodeIdByUrl(ep.episodeurl).catch(() => 0);
        if (id) ep.episodeid = id;
        else exists = false;
      }
      this.episodeInDb = exists;
      if (!exists) return;
      await E.recordHistory(ep.episodeid, 0, ep.is_youtube).catch(() => {});
      if (skipQueue) return;
      let shouldQueue = true;
      if (ep.episodeid) {
        try {
          const pid = await E.getPodcastIdFromEpisode(ep.episodeid);
          if (await E.getAutoPlayNext(pid)) shouldQueue = false;
        } catch {
          /* fall through and queue */
        }
      }
      if (shouldQueue) {
        // Playing an episode makes it the queue anchor: move it to the top.
        await E.queueBump(ep);
        episodeStatus.set('queued', ep.episodeid, true);
        ui.queueVersion++;
      }
    } catch (e) {
      console.warn('history/queue bookkeeping failed', e);
    }
  }

  async #seedVolume() {
    if (this.#volumeSeeded) return;
    this.#volumeSeeded = true;
    try {
      this.volume = await E.getDefaultVolume();
    } catch {
      this.volume = 100;
    }
  }

  async #loadExtras(ep: Episode) {
    if (!ep.episodeid || ep.is_youtube) return;
    const id = ep.episodeid;
    E.getSkipSegments(id)
      .then((s) => {
        if (this.current?.episode.episodeid !== id) return;
        this.#segments = s.segments ?? [];
        this.#adAudio = s.ad_audio ?? null;
      })
      .catch(() => {});
    E.getPodcasting2Data(id)
      .then((d) => {
        if (this.current?.episode.episodeid !== id) return;
        this.chapters = d.chapters ?? [];
        this.people = d.people ?? [];
      })
      .catch(() => {});
  }

  // ---- timers ----

  #startTimers() {
    for (const t of this.#timers) clearInterval(t);
    this.#timers = [
      setInterval(() => this.#tick(), 1000),
      setInterval(() => {
        const cur = this.current;
        if (cur && this.playing && this.media && cur.episode.episodeid) {
          E.recordListenDuration(cur.episode.episodeid, this.media.currentTime, cur.isYoutube).catch(() => {});
        }
      }, 30_000),
      setInterval(() => {
        if (this.current && this.playing) E.incrementListenTime().catch(() => {});
      }, 60_000)
    ];
  }

  #tick() {
    const m = this.media,
      cur = this.current;
    if (!m || !cur) return;
    const t = m.currentTime,
      dur = m.duration;
    this.currentTime = t;

    // Auto-skip detected silence, and ads the server marks active/confirmed when
    // their timing fits the copy being played.
    if (this.#segments?.length) {
      const fromServer = m.currentSrc.includes('/api/data/stream/');
      const adsFit =
        Number.isFinite(dur) && dur > 0 && (!this.#adAudio || adFits(this.#adAudio, dur, fromServer));
      const seg = this.#segments.find(
        (s) =>
          (s.kind === 'silence' || (s.kind === 'ad' && adsFit && (s.status === 'active' || s.status === 'confirmed'))) &&
          t >= s.start_time &&
          t < s.end_time - 0.25
      );
      if (seg) m.currentTime = seg.end_time;
    }

    if (Number.isFinite(dur) && dur > 0 && t >= dur - (cur.endPosSec || 0) && this.#finishedFor !== cur.episode.episodeid) {
      m.pause();
      this.#finish();
    }
  }

  // ---- finishing / advancing ----

  async #finish() {
    const cur = this.current;
    if (!cur) return;
    const id = cur.episode.episodeid;
    if (this.#finishedFor === id || this.#advancing) return;
    this.#finishedFor = id;
    this.#advancing = true;
    try {
      if (id) {
        await E.markEpisodeCompleted({ episodeid: id, is_youtube: cur.isYoutube }).catch(() => {});
        episodeStatus.set('completed', id, true);
        episodeStatus.set('queued', id, false);
        ui.queueVersion++;
      }
      const next = await this.#findNext(id);
      if (next) await this.play(next.episode, { skipQueue: next.skipQueue, playlistId: next.playlistId });
      else this.playing = false;
    } finally {
      this.#advancing = false;
    }
  }

  async #findNext(id: number): Promise<{ episode: Episode; skipQueue: boolean; playlistId?: number | null } | null> {
    if (!id) return null;
    // 1. Playlist context.
    if (this.#playlistId != null) {
      const pid = this.#playlistId;
      try {
        const ep = await E.getNextPlaylistEpisode(id, pid);
        if (ep) return { episode: ep, skipQueue: true, playlistId: pid };
        this.#playlistId = null;
      } catch {
        /* fall through */
      }
    }
    // 2. Podcast with auto-play-next on.
    try {
      const podcastId = await E.getPodcastIdFromEpisode(id);
      if (await E.getAutoPlayNext(podcastId)) {
        const ep = await E.getNextPodcastEpisode(id);
        if (ep) return { episode: ep, skipQueue: true };
      }
    } catch {
      /* fall through */
    }
    // 3. Queue: mark_episode_completed already removed the finished one server-side.
    try {
      const queue = (await E.getQueuedEpisodes())
        .filter((e) => e.episodeid !== id && !e.completed)
        .sort((a, b) => (a.queueposition ?? 999999) - (b.queueposition ?? 999999));
      if (queue[0]) return { episode: queue[0], skipQueue: false };
    } catch {
      /* nothing next */
    }
    return null;
  }

  /** "Next episode" button: the queue entry after the current one. */
  async skipToNext() {
    const cur = this.current;
    if (!cur) return;
    try {
      const queue = await E.getQueuedEpisodes();
      const here = queue.find((e) => e.episodeid === cur.episode.episodeid);
      if (!here) return;
      const next = queue.find((e) => e.queueposition === (here.queueposition ?? 0) + 1);
      if (next) await this.play(next);
      else this.media?.pause();
    } catch {
      toast.error('Failed to fetch queued episodes');
    }
  }

  // ---- controls ----

  toggle() {
    const m = this.media;
    if (!m) return;
    if (this.playing) m.pause();
    else m.play().catch(() => {});
  }

  seekTo(seconds: number) {
    const m = this.media;
    if (!m) return;
    m.currentTime = Math.max(0, seconds);
    this.currentTime = m.currentTime;
  }

  seekBy(delta: number) {
    const m = this.media;
    if (!m) return;
    const target = m.currentTime + delta;
    const dur = m.duration;
    this.seekTo(Number.isFinite(dur) && dur > 0 ? Math.min(target, dur - 0.25) : target);
  }

  setSpeed(speed: number) {
    this.speed = speed;
    if (this.media) this.media.playbackRate = speed;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.media) this.media.volume = volume / 100;
  }

  /** Position, duration and end of the buffered range around the playhead. */
  playhead(): { pos: number; dur: number; buf: number } | null {
    const m = this.media;
    if (!m) return null;
    const pos = m.currentTime;
    let buf = pos;
    for (let i = 0; i < m.buffered.length; i++) {
      const s = m.buffered.start(i),
        e = m.buffered.end(i);
      if (s <= pos + 0.5 && e >= pos) buf = e;
    }
    return { pos, dur: m.duration, buf };
  }

  stop() {
    for (const t of this.#timers) clearInterval(t);
    this.#timers = [];
    this.media?.pause();
    this.current = null;
    this.playing = false;
    this.expanded = false;
  }

  #updateMediaSession() {
    const cur = this.current;
    if (!cur || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: cur.title,
      artist: cur.episode.podcastname,
      artwork: cur.artworkUrl ? [{ src: cur.artworkUrl }] : []
    });
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => this.media?.play());
    ms.setActionHandler('pause', () => this.media?.pause());
    ms.setActionHandler('seekbackward', () => this.seekBy(-15));
    ms.setActionHandler('seekforward', () => this.seekBy(15));
    ms.setActionHandler('nexttrack', () => this.skipToNext());
  }
}

/** Whether detected ad ranges apply to the copy playing (upstream `AdAudio::fits`):
 *  the user's server download when it is the analyzed copy, otherwise a copy whose
 *  length matches the analyzed one (inserted ads usually change the length). */
function adFits(ad: { download?: string; analyzed?: { duration?: number | null } | null }, duration: number, fromServer: boolean) {
  if (ad.download === 'match' && fromServer) return true;
  const expected = ad.analyzed?.duration;
  if (typeof expected !== 'number' || expected <= 0) return true;
  return Number.isFinite(duration) && duration > 0 && Math.abs(duration - expected) <= Math.max(expected * 0.003, 2);
}

export const player = new Player();
