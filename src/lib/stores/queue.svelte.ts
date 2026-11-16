// The user's queue, shared by the queue panel, the queue page and the top-bar badge.
import * as E from '$lib/api/endpoints';
import type { Episode } from '$lib/api/endpoints';
import { episodeStatus, toast, ui } from './app.svelte';

class Queue {
  episodes = $state<Episode[]>([]);
  loaded = $state(false);

  async refresh() {
    try {
      const eps = await E.getQueuedEpisodes();
      eps.sort((a, b) => (a.queueposition ?? Number.MAX_SAFE_INTEGER) - (b.queueposition ?? Number.MAX_SAFE_INTEGER));
      this.episodes = eps;
      this.loaded = true;
      episodeStatus.absorb(eps);
    } catch (e) {
      console.warn('queue fetch failed', e);
    }
  }

  /** Move `fromId` to where `toId` is, optimistically, then save the order. */
  async move(fromId: number, toId: number) {
    const eps = [...this.episodes];
    const from = eps.findIndex((e) => e.episodeid === fromId);
    const to = eps.findIndex((e) => e.episodeid === toId);
    if (from < 0 || to < 0 || from === to) return;
    const [item] = eps.splice(from, 1);
    eps.splice(to, 0, item);
    this.episodes = eps;
    try {
      await E.reorderQueue(eps);
    } catch (e) {
      toast.error(`Failed to reorder queue: ${(e as Error).message}`);
      this.refresh();
    }
  }

  async remove(ep: Episode) {
    try {
      await E.removeQueuedEpisode(ep);
      episodeStatus.set('queued', ep.episodeid, false);
      ui.queueVersion++;
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
    await this.refresh();
  }

  async clear() {
    try {
      await E.clearQueue();
      for (const e of this.episodes) episodeStatus.set('queued', e.episodeid, false);
      this.episodes = [];
      ui.queueVersion++;
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  }

  get totalLabel() {
    const secs = this.episodes.reduce((s, e) => s + (e.episodeduration || 0), 0);
    const h = Math.floor(secs / 3600),
      m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}

export const queue = new Queue();
