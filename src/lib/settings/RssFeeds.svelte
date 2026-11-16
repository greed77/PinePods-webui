<script lang="ts">
  // Port of upstream setting_components/rss_feeds.rs: turn on personal RSS feeds and
  // copy the URLs (all subscriptions, saved, queue, downloads, history, each playlist
  // and collection). The URLs carry an RSS key, shown only once feeds are on.
  import * as E from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  const LIMIT = 2;

  let enabled = $state(false);
  let loading = $state(false);
  let key = $state('');
  let playlists = $state<{ playlist_id: number; name: string }[]>([]);
  let collections = $state<{ collection_id: number; name: string }[]>([]);
  let expanded = $state<Record<string, boolean>>({});

  E.getRssFeedStatus().then((v) => (enabled = v), (e) => console.warn('Error getting RSS feed status', e));

  $effect(() => {
    if (!enabled) {
      key = '';
      playlists = [];
      collections = [];
      return;
    }
    E.getRssKey().then((k) => (key = k), () => (key = ''));
    E.getPlaylists().then((p) => (playlists = p), (e) => console.warn(e));
    E.getCollections().then((c) => (collections = c), (e) => console.warn(e));
  });

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    loading = true;
    try {
      enabled = await E.toggleRssFeeds();
    } catch (err) {
      toast.error(`Error toggling RSS feeds: ${(err as Error).message}`);
    } finally {
      loading = false;
    }
  }

  const base = $derived(key ? `${session.serverName}/rss/${session.userId}?api_key=${key}` : '');
  const groups = $derived(
    base
      ? ([
          [
            t('rss_feeds.general_feeds'),
            [
              [t('rss_feeds.all_subscriptions'), base],
              [t('rss_feeds.saved'), `${base}&source=saved`],
              [t('rss_feeds.queue'), `${base}&source=queue`],
              [t('rss_feeds.downloads'), `${base}&source=downloads`],
              [t('rss_feeds.history'), `${base}&source=history`]
            ]
          ],
          [t('rss_feeds.playlist_feeds'), playlists.map((p) => [p.name, `${base}&source=playlist&id=${p.playlist_id}`])],
          [t('rss_feeds.collection_feeds'), collections.map((c) => [c.name, `${base}&source=collection&id=${c.collection_id}`])]
        ] as [string, [string, string][]][])
      : []
  );

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
  }
</script>

<div class="settings-row">
  <div>
    <div class="settings-row-label">{t('rss_feeds.enable_rss_feeds')}</div>
    <div class="settings-row-desc">{t('rss_feeds.url_includes_api_key')}</div>
  </div>
  <div class="settings-row-control">
    <label class="toggle">
      <input type="checkbox" disabled={loading} checked={enabled} onclick={toggle} aria-label={t('rss_feeds.enable_rss_feeds')} />
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
  </div>
</div>

{#each groups as [title, feeds] (title)}
  {#if feeds.length}
    {@const open = !!expanded[title]}
    <div class="settings-section-subhead">{title}</div>
    {#each open ? feeds : feeds.slice(0, LIMIT) as [label, url] (url)}
      <div class="settings-row">
        <div><div class="settings-row-label">{label}</div></div>
        <div class="settings-row-control" style="display:flex;align-items:center;gap:8px;max-width:320px;width:100%;">
          <input type="text" value={url} readonly class="input" style="font-size:11px;" aria-label={label} />
          <button onclick={() => copy(url)} class="btn btn-ghost" style="padding:6px 10px;white-space:nowrap;" aria-label="Copy"><i class="ph ph-copy"></i></button>
        </div>
      </div>
    {/each}
    {#if feeds.length > LIMIT}
      <div class="settings-row">
        <button onclick={() => (expanded = { ...expanded, [title]: !open })} class="btn btn-ghost" style="display:flex;align-items:center;gap:6px;padding:6px 10px;font-size:12px;">
          {open ? t('rss_feeds.show_less') : `${t('rss_feeds.show_more')} (${feeds.length - LIMIT})`}
          <i class="ph {open ? 'ph-caret-up' : 'ph-caret-down'}"></i>
        </button>
      </div>
    {/if}
  {/if}
{/each}
