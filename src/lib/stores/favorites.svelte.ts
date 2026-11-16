// IDs of the user's favorite podcasts, for the drawer's favorites-only filter.
import * as E from '$lib/api/endpoints';
import { ui } from './app.svelte';

class Favorites {
  ids = $state(new Set<number>());
  #loaded = false;

  /** Load once; call from pages that honor the favorites filter. */
  ensure() {
    if (this.#loaded) return;
    this.#loaded = true;
    E.getPodcasts()
      .then((p) => (this.ids = new Set(p.filter((x) => x.is_favorite).map((x) => x.podcastid))))
      .catch(() => (this.#loaded = false));
  }

  set(podcastId: number, on: boolean) {
    const next = new Set(this.ids);
    if (on) next.add(podcastId);
    else next.delete(podcastId);
    this.ids = next;
  }

  /** Episode filter honoring the drawer's star toggle (no favorites = no filtering, like upstream). */
  allows = (podcastId: number) => !ui.favoritesOnly || this.ids.size === 0 || this.ids.has(podcastId);
}

export const favorites = new Favorites();
