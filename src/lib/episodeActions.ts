// Episode actions shared by the context menu, the episode page and bulk bars.
// Each updates the server, then the shared status sets, and shows the server's
// message the way upstream's context_menu_button.rs does.
import * as E from '$lib/api/endpoints';
import type { Episode } from '$lib/api/endpoints';
import { episodeStatus, toast, ui } from '$lib/stores/app.svelte';

function message(res: unknown, fallback: string) {
  if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    for (const k of ['detail', 'data', 'message']) if (typeof r[k] === 'string' && r[k]) return r[k] as string;
  }
  return fallback;
}

async function run(fn: () => Promise<unknown>, ok: string, after: () => void) {
  try {
    const res = await fn();
    after();
    toast.info(message(res, ok));
  } catch (e) {
    toast.error(`Error: ${(e as Error).message}`);
  }
}

export const isQueued = (ep: Episode) => episodeStatus.queued.has(ep.episodeid);
export const isSaved = (ep: Episode) => episodeStatus.saved.has(ep.episodeid);
export const isDownloaded = (ep: Episode) => episodeStatus.downloaded.has(ep.episodeid);
export const isCompleted = (ep: Episode) => episodeStatus.completed.has(ep.episodeid);

/** Queue at the bottom, or at the top (0.9.2 servers have no position
 *  parameter, so "top" uses queue_bump like playing does). */
export function addToQueue(ep: Episode, position: 'top' | 'bottom' = 'bottom') {
  return run(
    () => (position === 'top' ? E.queueBump(ep) : E.queueEpisode(ep)),
    'Episode added to queue',
    () => {
      episodeStatus.set('queued', ep.episodeid, true);
      ui.queueVersion++;
    }
  );
}

export function removeFromQueue(ep: Episode) {
  return run(
    () => E.removeQueuedEpisode(ep),
    'Episode removed from queue',
    () => {
      episodeStatus.set('queued', ep.episodeid, false);
      ui.queueVersion++;
    }
  );
}

export const toggleQueue = (ep: Episode) => (isQueued(ep) ? removeFromQueue(ep) : addToQueue(ep));

export function toggleSave(ep: Episode) {
  const saved = isSaved(ep);
  return run(
    () => (saved ? E.removeSavedEpisode(ep) : E.saveEpisode(ep)),
    saved ? 'Episode removed from saved' : 'Episode saved',
    () => episodeStatus.set('saved', ep.episodeid, !saved)
  );
}

export function toggleDownload(ep: Episode) {
  const downloaded = isDownloaded(ep);
  return run(
    () => (downloaded ? E.deleteDownloadedEpisode(ep) : E.downloadEpisode(ep)),
    downloaded ? 'Downloaded episode removed' : 'Episode download queued!',
    () => {
      // A download finishes later on the server; only removal is immediate.
      if (downloaded) episodeStatus.set('downloaded', ep.episodeid, false);
    }
  );
}

export function toggleComplete(ep: Episode) {
  const done = isCompleted(ep);
  return run(
    () => (done ? E.markEpisodeUncompleted(ep) : E.markEpisodeCompleted(ep)),
    done ? 'Episode marked as not completed' : 'Episode marked as completed',
    () => {
      episodeStatus.set('completed', ep.episodeid, !done);
      if (!done) {
        episodeStatus.set('queued', ep.episodeid, false);
        ui.queueVersion++;
      }
    }
  );
}
