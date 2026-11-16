<script lang="ts">
  // Port of upstream setting_components/notifications.rs: ntfy / Gotify / HTTP webhook
  // notifications for new episodes, one platform shown at a time.
  import * as E from '$lib/api/endpoints';
  import type { NotificationSetting } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  type Platform = 'ntfy' | 'gotify' | 'http';
  let platform = $state<Platform>('ntfy');
  let saved = $state<NotificationSetting[]>([]);
  let enabled = $state(false);
  let ntfyTopic = $state('');
  let ntfyServer = $state('https://ntfy.sh');
  let ntfyUser = $state('');
  let ntfyPass = $state('');
  let ntfyToken = $state('');
  let gotifyUrl = $state('');
  let gotifyToken = $state('');
  let httpUrl = $state('');
  let httpToken = $state('');
  let httpMethod = $state('POST');
  let success = $state('');

  const enabledFor = (p: Platform, list: NotificationSetting[]) => !!list.find((s) => s.platform === p)?.enabled;

  function load() {
    E.getNotificationSettings()
      .then((list) => {
        saved = list;
        enabled = enabledFor(platform, list);
        const n = list.find((s) => s.platform === 'ntfy');
        if (n) {
          ntfyTopic = n.ntfy_topic ?? ntfyTopic;
          ntfyServer = n.ntfy_server_url ?? ntfyServer;
          ntfyUser = n.ntfy_username ?? ntfyUser;
          ntfyPass = n.ntfy_password ?? ntfyPass;
          ntfyToken = n.ntfy_access_token ?? ntfyToken;
        }
        const g = list.find((s) => s.platform === 'gotify');
        if (g) {
          gotifyUrl = g.gotify_url ?? gotifyUrl;
          gotifyToken = g.gotify_token ?? gotifyToken;
        }
        const h = list.find((s) => s.platform === 'http');
        if (h) {
          httpUrl = h.http_url ?? httpUrl;
          httpToken = h.http_token ?? httpToken;
          httpMethod = h.http_method ?? httpMethod;
        }
      })
      .catch((e) => toast.error(`${t('notifications.failed_to_fetch_notification_settings')}${(e as Error).message}`));
  }
  load();

  function pick(p: Platform) {
    platform = p;
    enabled = enabledFor(p, saved);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    try {
      await E.updateNotificationSettings({
        platform,
        enabled,
        ntfy_topic: ntfyTopic,
        ntfy_server_url: ntfyServer,
        ntfy_username: ntfyUser,
        ntfy_password: ntfyPass,
        ntfy_access_token: ntfyToken,
        gotify_url: gotifyUrl,
        gotify_token: gotifyToken,
        http_url: httpUrl,
        http_token: httpToken,
        http_method: httpMethod
      });
      success = t('notifications.successfully_updated_notification_settings');
      load();
    } catch (err) {
      toast.error(`${t('notifications.failed_to_update_notification_settings')}${(err as Error).message}`);
    }
  }

  async function test() {
    try {
      await E.testNotification(platform);
      toast.info(t('notifications.test_notification_sent'));
    } catch (err) {
      toast.error(`${t('notifications.failed_to_send_test_notification')}${(err as Error).message}`);
    }
  }

  // ntfy takes a username/password or an access token: typing one clears the other.
  const setUser = (v: string) => ((ntfyUser = v), v && (ntfyToken = ''));
  const setPass = (v: string) => ((ntfyPass = v), v && (ntfyToken = ''));
  const setToken = (v: string) => ((ntfyToken = v), v && (ntfyUser = ntfyPass = ''));
</script>

{#snippet textRow(label: string, placeholder: string, value: string, set: (v: string) => void, type = 'text', disabled = false, desc = '')}
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{label}</div>
      {#if desc}<div class="settings-row-desc">{desc}</div>{/if}
    </div>
    <div class="settings-row-control">
      <input {type} {value} {placeholder} {disabled} class="input" aria-label={label} autocomplete="off" oninput={(e) => set(e.currentTarget.value)} />
    </div>
  </div>
{/snippet}

<form onsubmit={submit}>
  <div class="settings-row">
    <div><div class="settings-row-label">{t('notifications.notification_platform')}</div></div>
    <div class="settings-row-control">
      <div class="notification-platform-tabs">
        <button type="button" class="notification-platform-tab {platform === 'ntfy' ? 'active' : ''}" onclick={() => pick('ntfy')}>ntfy</button>
        <button type="button" class="notification-platform-tab {platform === 'gotify' ? 'active' : ''}" onclick={() => pick('gotify')}>{t('notifications.gotify')}</button>
        <button type="button" class="notification-platform-tab {platform === 'http' ? 'active' : ''}" onclick={() => pick('http')}>HTTP</button>
      </div>
    </div>
  </div>
  <div class="settings-row">
    <div><div class="settings-row-label">{t('notifications.enable_notifications')}</div></div>
    <div class="settings-row-control">
      <label class="toggle">
        <input type="checkbox" bind:checked={enabled} aria-label={t('notifications.enable_notifications')} />
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
      </label>
    </div>
  </div>

  {#if platform === 'ntfy'}
    {@render textRow(t('notifications.ntfy_topic'), 'Enter your ntfy topic', ntfyTopic, (v) => (ntfyTopic = v))}
    {@render textRow(t('notifications.ntfy_server_url'), 'https://ntfy.sh', ntfyServer, (v) => (ntfyServer = v))}
    <div class="settings-subsection-title">{t('notifications.authentication_optional')}</div>
    {@render textRow(t('notifications.username'), 'ntfy username (optional)', ntfyUser, setUser, 'text', !!ntfyToken, t('notifications.username_password_or_token'))}
    {@render textRow(t('notifications.password'), 'ntfy password (optional)', ntfyPass, setPass, 'password', !!ntfyToken)}
    {@render textRow(
      t('notifications.access_token'),
      'ntfy access token (alternative to username/password)',
      ntfyToken,
      setToken,
      'password',
      !!(ntfyUser || ntfyPass)
    )}
  {:else if platform === 'gotify'}
    {@render textRow(t('notifications.gotify_server_url'), 'Enter your Gotify server URL', gotifyUrl, (v) => (gotifyUrl = v))}
    {@render textRow(t('notifications.gotify_app_token'), 'Enter your Gotify application token', gotifyToken, (v) => (gotifyToken = v))}
  {:else}
    {@render textRow(t('notifications.http_endpoint_url'), 'https://api.example.com/webhook', httpUrl, (v) => (httpUrl = v))}
    {@render textRow(t('notifications.token_authentication'), 'API key, token, or authentication string', httpToken, (v) => (httpToken = v))}
    <div class="settings-row">
      <div><div class="settings-row-label">{t('notifications.http_method')}</div></div>
      <div class="settings-row-control">
        <div class="notification-platform-tabs">
          <button type="button" class="notification-platform-tab {httpMethod === 'POST' ? 'active' : ''}" onclick={() => (httpMethod = 'POST')}>POST</button>
          <button type="button" class="notification-platform-tab {httpMethod === 'GET' ? 'active' : ''}" onclick={() => (httpMethod = 'GET')}>GET</button>
        </div>
      </div>
    </div>
  {/if}

  <div class="settings-row">
    <div>{#if success}<div class="success-message">{success}</div>{/if}</div>
    <div class="settings-row-control">
      <button type="submit" class="btn btn-secondary" style="padding:6px 12px;"><i class="ph ph-floppy-disk"></i>{t('notifications.save_settings')}</button>
      {#if enabled}
        <button type="button" onclick={test} class="btn btn-secondary" style="padding:6px 12px;"><i class="ph ph-bell-ringing"></i>{t('notifications.send_test_notification')}</button>
      {/if}
    </div>
  </div>
</form>
