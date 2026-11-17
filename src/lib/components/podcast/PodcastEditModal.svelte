<script lang="ts">
  // Port of upstream episode_layout.rs "Edit Podcast Info" window: override the
  // podcast's feed URL, feed login, name, description, author, artwork, website and
  // Podcast Index id; reset them to the feed's values; and merge other podcasts into
  // this one (their episodes then show here) or undo a merge.
  import * as E from '$lib/api/endpoints';
  import type { Podcast, PodcastDetails } from '$lib/api/endpoints';
  import { changedFields, type EditBase, type EditForm } from './edit';
  import { toast, ui } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import ModalFrame from '../ModalFrame.svelte';
  import PodcastSelector from '../PodcastSelector.svelte';
  import { untrack } from 'svelte';

  let {
    podcast,
    onclose,
    onchanged
  }: {
    podcast: PodcastDetails;
    onclose: () => void;
    /** The podcast's details changed on the server. */
    onchanged: () => Promise<void> | void;
  } = $props();

  // The form starts from the podcast's values when the window opens.
  const p = untrack(() => podcast);
  const id = p.podcastid;
  const initial: EditBase = {
    feed_url: p.feedurl ?? '',
    podcast_name: p.podcastname ?? '',
    description: p.description ?? '',
    author: p.author ?? '',
    artwork_url: p.artworkurl ?? '',
    website_url: p.websiteurl ?? '',
    podcast_index_id: p.podcastindexid ? String(p.podcastindexid) : ''
  };
  let form = $state<EditForm>({ ...initial, username: '', password: '' });
  let saving = $state(false);
  let resetting = $state(false);

  // Merging: every other podcast of the user's, minus the ones merged in already.
  let podcasts = $state<Podcast[]>([]);
  let merged = $state<{ id: number; name: string }[]>([]);
  let toMerge = $state<number[]>([]);
  let loadingMerge = $state(true);
  let merging = $state(false);
  const candidates = $derived(podcasts.filter((p) => p.podcastid !== id && !merged.some((m) => m.id === p.podcastid)));

  async function loadMerged() {
    const ids = await E.getMergedPodcasts(id);
    // Merged podcasts can drop out of the podcast list, so look names up one by one.
    merged = await Promise.all(
      ids.map(async (m) => {
        const known = podcasts.find((p) => p.podcastid === m);
        if (known) return { id: m, name: known.podcastname };
        try {
          return { id: m, name: (await E.getPodcastDetails(m)).podcastname };
        } catch {
          return { id: m, name: `Podcast ID ${m}` };
        }
      })
    );
  }
  E.getPodcasts()
    .then((p) => (podcasts = p))
    .catch((e) => console.warn('Error loading podcasts for merge', e))
    .then(loadMerged)
    .catch((e) => console.warn('Error loading merged podcasts', e))
    .finally(() => (loadingMerge = false));

  async function save(e: Event) {
    e.preventDefault();
    const edit = changedFields(form, initial);
    if (!Object.keys(edit).length) {
      toast.info('No changes to save');
      return;
    }
    saving = true;
    try {
      const r = await E.updatePodcastInfo(id, edit);
      if (!r.success) throw new Error(r.message);
      toast.info('Podcast updated successfully');
      await onchanged();
      onclose();
    } catch (err) {
      toast.error(`Error updating podcast: ${(err as Error).message}`);
    } finally {
      saving = false;
    }
  }

  async function resetToFeed() {
    resetting = true;
    try {
      await E.refreshPodcastDetails(id, true);
      await onchanged();
      toast.info(t('episodes_layout.details_refreshed'));
      onclose();
    } catch (err) {
      toast.error(`${t('episodes_layout.details_refresh_failed')}: ${(err as Error).message}`);
    } finally {
      resetting = false;
    }
  }

  async function merge() {
    merging = true;
    try {
      const r = await E.mergePodcasts(id, toMerge);
      if (!r.success) throw new Error(r.message);
      toast.info(r.message || 'Podcasts merged');
      toMerge = [];
      await loadMerged();
      ui.feedVersion++;
    } catch (err) {
      toast.error(`Failed to merge podcasts: ${(err as Error).message}`);
    } finally {
      merging = false;
    }
  }

  async function unmerge(target: number) {
    try {
      const r = await E.unmergePodcast(id, target);
      if (!r.success) throw new Error(r.message);
      toast.info(r.message || 'Podcast unmerged');
      await loadMerged();
      ui.feedVersion++;
    } catch (err) {
      toast.error(`Failed to unmerge podcast: ${(err as Error).message}`);
    }
  }
</script>

{#snippet field(key: keyof typeof form, label: string, type: string, placeholder: string)}
  <div>
    <label for="edit_{key}" class="block mb-2 text-sm font-medium">{label}</label>
    <input {type} id="edit_{key}" class="email-input border text-sm rounded-lg p-2.5 w-full" {placeholder} autocomplete="off" bind:value={form[key]} />
  </div>
{/snippet}

<ModalFrame title={t('episodes_layout.edit_podcast_info')} {onclose}>
  <form class="space-y-4" onsubmit={save}>
    {@render field('feed_url', t('episodes_layout.feed_url'), 'url', t('episodes_layout.feed_url_placeholder'))}
    {@render field('username', t('episodes_layout.username'), 'text', t('episodes_layout.username_placeholder'))}
    {@render field('password', t('episodes_layout.password'), 'password', t('episodes_layout.password_placeholder'))}
    {@render field('podcast_name', t('episodes_layout.podcast_name'), 'text', t('episodes_layout.podcast_name_placeholder'))}
    <div>
      <label for="edit_description" class="block mb-2 text-sm font-medium">{t('episodes_layout.description')}</label>
      <textarea
        id="edit_description"
        rows="4"
        class="email-input border text-sm rounded-lg p-2.5 w-full"
        placeholder={t('episodes_layout.description_placeholder')}
        bind:value={form.description}
      ></textarea>
    </div>
    {@render field('author', t('episodes_layout.author'), 'text', t('episodes_layout.author_placeholder'))}
    {@render field('artwork_url', t('episodes_layout.artwork_url'), 'url', t('episodes_layout.artwork_url_placeholder'))}
    {@render field('website_url', t('episodes_layout.website_url'), 'url', t('episodes_layout.website_url_placeholder'))}
    {@render field('podcast_index_id', t('episodes_layout.podcast_index_id'), 'number', t('episodes_layout.podcast_index_id_placeholder'))}

    <div class="border-t pt-4">
      <h4 class="text-lg font-semibold mb-3">{t('episodes_layout.merge_podcasts')}</h4>
      <p class="text-sm text-gray-600 mb-3">{t('episodes_layout.merge_description')}</p>
      {#if merged.length}
        <div class="mb-4">
          <span class="block mb-2 text-sm font-medium">{t('episodes_layout.currently_merged_podcasts')}</span>
          {#each merged as m (m.id)}
            <div class="merged-podcast-item">
              <span class="merged-podcast-name">{m.name}</span>
              <button type="button" class="clear-button bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-3 rounded text-sm" onclick={() => unmerge(m.id)}>
                {t('episodes_layout.unmerge')}
              </button>
            </div>
          {/each}
        </div>
      {/if}
      <div class="mb-3">
        <span class="block mb-2 text-sm font-medium">{t('episodes_layout.select_podcasts_to_merge')}</span>
        <PodcastSelector
          bind:selected={toMerge}
          podcasts={candidates}
          placeholder={loadingMerge ? t('episodes_layout.loading_podcasts') : t('episodes_layout.select_podcasts_to_merge')}
        />
      </div>
      {#if toMerge.length}
        <button type="button" class="save-button font-bold py-2 px-4 rounded mr-2" disabled={merging} onclick={merge}>
          {t('episodes_layout.merge_podcasts')} ({toMerge.length})
        </button>
      {/if}
    </div>

    <div class="flex flex-wrap gap-2 pt-2">
      <button type="submit" class="save-button font-bold py-2 px-4 rounded" disabled={saving}>{t('episodes_layout.save_changes')}</button>
      <button
        type="button"
        class="download-button font-bold py-2 px-4 rounded"
        title={t('episodes_layout.reset_to_feed_hint')}
        disabled={resetting}
        onclick={resetToFeed}
      >
        {t('episodes_layout.reset_to_feed')}
      </button>
      <button type="button" class="download-button font-bold py-2 px-4 rounded" onclick={onclose}>{t('episodes_layout.cancel')}</button>
    </div>
  </form>
</ModalFrame>
