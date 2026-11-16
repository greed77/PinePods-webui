// The single global "Add to collection" picker (upstream CollectionModalState).
import type { Episode } from '$lib/api/endpoints';

class CollectionPicker {
  open = $state(false);
  episode = $state<Episode | null>(null);
  /** Multi-select mode: every selected episode goes into the chosen collection. */
  bulk = $state<[number, boolean][]>([]);
  /** Bumped when an episode leaves a collection here, so a page showing it can drop the card. */
  lastRemoved = $state<{ episodeId: number; collectionId: number; n: number } | null>(null);

  show(episode: Episode) {
    this.episode = episode;
    this.bulk = [];
    this.open = true;
  }
  showBulk(episodes: [number, boolean][]) {
    this.episode = null;
    this.bulk = episodes;
    this.open = true;
  }
  close() {
    this.open = false;
  }
}

export const collectionPicker = new CollectionPicker();
