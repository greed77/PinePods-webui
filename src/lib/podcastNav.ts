// Opening a podcast found outside the library (search, discover): go to its page if
// subscribed, otherwise to a preview built from its feed (upstream click_events.rs).
import { goto } from '$app/navigation';
import * as E from '$lib/api/endpoints';
import type { Podcast } from '$lib/api/endpoints';
import { toast } from '$lib/stores/app.svelte';

const KEY = 'podcast_preview';

/** Podcast info for the preview page, kept per tab so a reload still works. */
export function setPreview(p: Podcast) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function getPreview(feedUrl: string): Podcast | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Podcast | null;
    return p && p.feedurl === feedUrl ? p : null;
  } catch {
    return null;
  }
}

export function fromSearch(s: E.SearchPodcast): Podcast {
  return {
    podcastid: 0,
    podcastname: s.title,
    artworkurl: s.image,
    description: s.description,
    episodecount: s.episodeCount,
    websiteurl: s.link,
    feedurl: s.url,
    author: s.author,
    categories: s.categories,
    explicit: s.explicit,
    podcastindexid: s.indexId
  };
}

export async function openPodcast(p: Podcast) {
  try {
    if (await E.checkPodcast(p.podcastname, p.feedurl)) {
      const id = await E.getPodcastIdByFeed(p.feedurl, p.podcastname);
      if (id) return goto(`/podcast/${id}`);
    }
  } catch (e) {
    toast.error(`Error checking podcast: ${(e as Error).message}`);
  }
  setPreview(p);
  goto(`/podcast/preview?feed=${encodeURIComponent(p.feedurl)}`);
}
