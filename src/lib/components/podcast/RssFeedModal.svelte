<script lang="ts">
  // Port of upstream episode_layout.rs RSS feed window: a feed URL for just this
  // podcast, served by PinePods, to use in another podcast app. The key in it only
  // reads this podcast's feed. Unlike upstream, it says so when RSS feeds are off
  // and links to the setting.
  import * as E from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import ModalFrame from '../ModalFrame.svelte';

  let { podcastId, onclose }: { podcastId: number; onclose: () => void } = $props();

  let key = $state('');
  let failed = $state(false);
  let enabled = $state<boolean | null>(null);

  $effect(() => {
    const id = podcastId;
    E.getRssKey(id).then(
      (k) => (key = k),
      (e) => {
        failed = true;
        console.warn('Failed to fetch RSS key', e);
      }
    );
  });
  E.getRssFeedStatus().then(
    (v) => (enabled = v),
    () => (enabled = null)
  );

  const url = $derived(key ? `${session.serverName}/rss/${session.userId}?api_key=${key}&podcast_id=${podcastId}` : '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.info('Copied to clipboard');
    } catch {
      toast.error("Couldn't copy; select the link and copy it instead");
    }
  }
</script>

<ModalFrame title={t('episodes_layout.rss_feed_url')} {onclose}>
  {#if enabled === false}
    <p class="block mb-2 text-sm font-medium">
      <i class="ph ph-warning"></i>
      RSS feeds are turned off, so this link won't work yet.
      <a href="/settings?section=rss_feeds" class="underline" onclick={onclose}>{t('rss_feeds.enable_rss_feeds')}</a>
    </p>
  {:else if enabled === null}
    <p class="block mb-2 text-sm font-medium">{t('episodes_layout.rss_feed_note')}</p>
  {/if}
  <label for="rss_link" class="block mb-2 text-sm font-medium">{t('episodes_layout.rss_feed_instruction')}</label>
  <div class="relative">
    <input
      type="text"
      id="rss_link"
      class="input-black w-full px-3 py-2 border border-gray-300 rounded-md pr-20"
      value={url || (failed ? 'Error loading the RSS key' : t('episodes_layout.loading_rss_key'))}
      readonly
      onfocus={(e) => e.currentTarget.select()}
    />
    <button
      type="button"
      disabled={!url}
      onclick={copy}
      class="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      {t('episodes_layout.copy')}
    </button>
  </div>
  <p class="mt-2 text-sm text-gray-500">{t('episodes_layout.rss_feed_warning')}</p>
</ModalFrame>
