// Global UI state that upstream keeps in yewdux stores: user preferences,
// per-episode status sets shared across pages, toasts and a few UI flags.
import type { Episode } from '$lib/api/endpoints';

class Prefs {
  timezone = $state('UTC');
  hourPref = $state(24);
  dateFormat = $state('ISO');
  gravatarUrl = $state<string | null>(null);
}
export const prefs = new Prefs();

/** Which episodes are completed / saved / queued / downloaded, so a change on
 *  one page (or in the player) shows everywhere the episode appears. */
class EpisodeStatus {
  completed = $state(new Set<number>());
  saved = $state(new Set<number>());
  queued = $state(new Set<number>());
  downloaded = $state(new Set<number>());

  /** Seed the sets from episodes a page just fetched. */
  absorb(eps: Episode[]) {
    const add = (set: Set<number>, on: boolean, id: number) => (on ? set.add(id) : set.delete(id));
    const c = new Set(this.completed),
      s = new Set(this.saved),
      q = new Set(this.queued),
      d = new Set(this.downloaded);
    for (const e of eps) {
      if (!e.episodeid) continue;
      add(c, e.completed, e.episodeid);
      add(s, e.saved, e.episodeid);
      add(q, e.queued, e.episodeid);
      add(d, e.downloaded, e.episodeid);
    }
    this.completed = c;
    this.saved = s;
    this.queued = q;
    this.downloaded = d;
  }

  set(kind: 'completed' | 'saved' | 'queued' | 'downloaded', id: number, on: boolean) {
    const next = new Set(this[kind]);
    if (on) next.add(id);
    else next.delete(id);
    this[kind] = next;
  }
}
export const episodeStatus = new EpisodeStatus();

type ToastKind = 'info' | 'error';
class Toasts {
  current = $state<{ kind: ToastKind; text: string; id: number } | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;
  #n = 0;
  show(kind: ToastKind, text: string) {
    this.current = { kind, text, id: ++this.#n };
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.current = null), 4000);
  }
  info(text: string) {
    this.show('info', text);
  }
  error(text: string) {
    this.show('error', text);
  }
  dismiss() {
    this.current = null;
  }
}
export const toast = new Toasts();

class Ui {
  queuePanelOpen = $state(false);
  favoritesOnly = $state(false);
  isRefreshing = $state(false);
  pinepodsVersion = $state<string | null>(null);
  /** Bumped when the queue changes so open views can refetch. */
  queueVersion = $state(0);
  /** Bumped after a feed refresh so lists can refetch. */
  feedVersion = $state(0);
}
export const ui = new Ui();
