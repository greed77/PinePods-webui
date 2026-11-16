<script lang="ts">
  // Port of upstream setting_components/custom_feed.rs: subscribe to a feed by URL
  // (optionally with basic-auth credentials), or to a YouTube channel by URL.
  import * as E from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let feedUrl = $state('');
  let user = $state('');
  let pass = $state('');
  let youtubeUrl = $state('');
  let busy = $state(false);

  async function add(url: string, opts: Parameters<typeof E.addCustomFeed>[1]) {
    if (!url.trim()) return;
    busy = true;
    try {
      await E.addCustomFeed(url.trim(), opts);
      toast.info(t('custom_feed.podcast_successfully_added'));
    } catch (e) {
      toast.error(`${t('custom_feed.failed_to_add_podcast')}${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }
</script>

<div class="settings-row">
  <div><div class="settings-row-label">{t('custom_feed.feed_url_placeholder')}</div></div>
  <div class="settings-row-control">
    <input bind:value={feedUrl} class="input" placeholder={t('custom_feed.feed_url_placeholder')} aria-label={t('custom_feed.feed_url_placeholder')} />
  </div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('custom_feed.username_optional')}</div></div>
  <div class="settings-row-control">
    <input bind:value={user} class="input" placeholder={t('custom_feed.username_optional')} aria-label={t('custom_feed.username_optional')} autocomplete="off" />
  </div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('custom_feed.password_optional')}</div></div>
  <div class="settings-row-control">
    <input bind:value={pass} type="password" class="input" placeholder={t('custom_feed.password_optional')} aria-label={t('custom_feed.password_optional')} autocomplete="off" />
  </div>
</div>
<div class="settings-row">
  <div></div>
  <div class="settings-row-control">
    <button onclick={() => add(feedUrl, { username: user, password: pass })} class="btn btn-secondary" style="padding:6px 12px;" disabled={busy}>
      <i class="ph ph-plus"></i>{t('custom_feed.add_feed')}
    </button>
  </div>
</div>
<div class="settings-subsection-title">YouTube</div>
<div class="settings-row">
  <div>
    <div class="settings-row-label">{t('podcasts.youtube_channel_url_placeholder')}</div>
    <div class="settings-row-desc">{t('podcasts.youtube_channel_instructions')}</div>
  </div>
  <div class="settings-row-control">
    <input bind:value={youtubeUrl} class="input" placeholder={t('podcasts.youtube_channel_url_placeholder')} aria-label={t('podcasts.youtube_channel_url_placeholder')} />
  </div>
</div>
<div class="settings-row">
  <div></div>
  <div class="settings-row-control">
    <button onclick={() => add(youtubeUrl, { youtube_channel: true })} class="btn btn-secondary" style="padding:6px 12px;" disabled={busy}>
      <i class="ph ph-plus"></i>{t('podcasts.add_channel')}
    </button>
  </div>
</div>
