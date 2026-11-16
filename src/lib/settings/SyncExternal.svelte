<script lang="ts">
  // The external sync server part of upstream nextcloud_options.rs (ExternalSection):
  // pick gpodder or Nextcloud, test, save and sync, and see the last run's status.
  import { onDestroy } from 'svelte';
  import * as E from '$lib/api/endpoints';
  import type { SyncCredentials, SyncTargetInfo, SyncTestResult } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { fmtUnix } from './syncFormat';

  let { target, onchange }: { target: SyncTargetInfo | null; onchange: () => void } = $props();

  /** How long the Nextcloud login flow is waited for (the server polls Nextcloud as long). */
  const NEXTCLOUD_WAIT_MS = 20 * 60 * 1000;

  let kind = $state('none');
  let url = $state('');
  let username = $state('');
  let password = $state('');
  let device = $state('');
  let busy = $state<'test' | 'save' | 'nextcloud' | 'run' | 'full' | null>(null);
  let tested = $state<SyncTestResult | null>(null);
  let destroyed = false;
  onDestroy(() => (destroyed = true));

  // Follow the saved target when it changes (saved, removed, Nextcloud login finished).
  $effect(() => {
    const tg = target;
    if (!tg) return;
    kind = tg.kind;
    url = tg.url;
    username = tg.username;
    device = tg.device_name ?? '';
    password = '';
  });

  const creds = (): SyncCredentials => ({
    kind,
    url: url.trim(),
    username: username.trim(),
    password: password || null,
    device_name: kind === 'gpodder' && device.trim() ? device.trim() : null
  });

  async function test() {
    busy = 'test';
    try {
      tested = await E.testSyncTarget(creds());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      busy = null;
    }
  }

  async function save() {
    busy = 'save';
    try {
      await E.saveSyncTarget(creds());
      toast.info(t('sync_settings.saved'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      busy = null;
      onchange();
    }
  }

  async function remove() {
    if (!confirm(t('sync_settings.remove_external_confirm'))) return;
    await E.deleteSyncTarget().catch((e) => toast.error((e as Error).message));
    onchange();
  }

  // Nextcloud login flow: approve Pinepods in a new tab; the server polls Nextcloud and
  // saves the target, which this page waits for.
  async function nextcloudLogin() {
    const ncUrl = url.trim().replace(/\/+$/, '');
    if (!ncUrl) return;
    busy = 'nextcloud';
    try {
      const login = await E.initiateNextcloudLogin(ncUrl);
      window.open(login.login, '_blank');
      await E.addNextcloudServer({ token: login.poll.token, poll_endpoint: login.poll.endpoint, nextcloud_url: ncUrl });
    } catch (e) {
      toast.error((e as Error).message);
      busy = null;
      return;
    }
    const until = Date.now() + NEXTCLOUD_WAIT_MS;
    while (Date.now() < until && !destroyed) {
      await new Promise((r) => setTimeout(r, 3000));
      const tg = await E.getSyncTarget().catch(() => null);
      if (tg && tg.kind === 'nextcloud' && tg.url.replace(/\/+$/, '') === ncUrl) {
        toast.info(t('sync_settings.nextcloud_connected'));
        break;
      }
    }
    busy = null;
    onchange();
  }

  async function run(full: boolean) {
    busy = full ? 'full' : 'run';
    try {
      const r = await E.runSync(full);
      if (r.success) toast.info(t('sync_settings.sync_done'));
      else toast.error(`${t('sync_settings.sync_failed')}${r.message ?? ''}`);
    } catch (e) {
      toast.error(`${t('sync_settings.sync_failed')}${(e as Error).message}`);
    } finally {
      busy = null;
      onchange();
    }
  }

  const never = $derived(t('sync_settings.never'));
  const savedSameKind = $derived(!!target && target.kind === kind);
</script>

{#snippet spin(what: typeof busy)}
  {#if busy === what}<i class="ph ph-spinner animate-spin"></i>{/if}
{/snippet}

<div class="settings-subsection-title">{t('sync_settings.external_title')}</div>
<div class="settings-row">
  <div>
    <div class="settings-row-label">{t('sync_settings.external_kind')}</div>
    <div class="settings-row-desc">{t('sync_settings.external_desc')}</div>
  </div>
  <div class="settings-row-control">
    <select class="select" style="width:220px;max-width:60vw;" bind:value={kind} onchange={() => (tested = null)} aria-label={t('sync_settings.external_kind')}>
      <option value="none">{t('sync_settings.external_none')}</option>
      <option value="gpodder">{t('sync_settings.external_gpodder')}</option>
      <option value="nextcloud">{t('sync_settings.external_nextcloud')}</option>
    </select>
  </div>
</div>

{#if kind === 'none'}
  {#if target}
    <div class="settings-row">
      <div><div class="settings-row-desc">{t('sync_settings.remove_external_hint')}</div></div>
      <div class="settings-row-control">
        <button class="btn btn-danger" onclick={remove}><i class="ph ph-trash"></i>{t('sync_settings.remove')}</button>
      </div>
    </div>
  {/if}
{:else}
  <div class="settings-row">
    <div><div class="settings-row-label">{t('sync_settings.server_url')}</div></div>
    <div class="settings-row-control">
      <input
        type="text"
        class="input"
        style="width:280px;max-width:60vw;"
        bind:value={url}
        placeholder={kind === 'nextcloud' ? 'https://cloud.example.com' : 'https://gpodder.example.com'}
        aria-label={t('sync_settings.server_url')}
      />
    </div>
  </div>
  {#if kind === 'nextcloud'}
    <div class="settings-row">
      <div><div class="settings-row-desc">{t('sync_settings.nextcloud_login_hint')}</div></div>
      <div class="settings-row-control">
        <button class="btn btn-secondary" disabled={!!busy || !url.trim()} onclick={nextcloudLogin}>
          {@render spin('nextcloud')}<i class="ph ph-cloud"></i>
          {busy === 'nextcloud' ? t('sync_settings.waiting_for_nextcloud') : t('sync_settings.nextcloud_login')}
        </button>
      </div>
    </div>
  {/if}
  <div class="settings-row">
    <div><div class="settings-row-label">{t('sync_settings.username')}</div></div>
    <div class="settings-row-control">
      <input type="text" class="input" style="width:280px;max-width:60vw;" bind:value={username} aria-label={t('sync_settings.username')} autocomplete="off" />
    </div>
  </div>
  <div class="settings-row">
    <div><div class="settings-row-label">{kind === 'nextcloud' ? t('sync_settings.app_password') : t('sync_settings.password')}</div></div>
    <div class="settings-row-control">
      <input
        type="password"
        class="input"
        style="width:280px;max-width:60vw;"
        bind:value={password}
        placeholder={savedSameKind ? t('sync_settings.password_keep') : ''}
        aria-label={t('sync_settings.password')}
        autocomplete="off"
      />
    </div>
  </div>
  {#if kind === 'gpodder'}
    <div class="settings-row">
      <div>
        <div class="settings-row-label">{t('sync_settings.device_name')}</div>
        <div class="settings-row-desc">{t('sync_settings.device_name_hint')}</div>
      </div>
      <div class="settings-row-control">
        <input type="text" class="input" style="width:280px;max-width:60vw;" bind:value={device} placeholder="pinepods" aria-label={t('sync_settings.device_name')} />
      </div>
    </div>
  {/if}
  {#if tested}
    <div class="settings-row">
      <div>
        {#if tested.success}
          <div class="settings-row-label" style="color:var(--success-color);">{t('sync_settings.connection_ok')}</div>
          {#if tested.devices.length}
            <div class="settings-row-desc">{t('sync_settings.remote_devices')}{tested.devices.map((d) => d.caption).join(', ')}</div>
          {/if}
          {#if tested.device_name}<div class="settings-row-desc">{t('sync_settings.syncs_as')}{tested.device_name}</div>{/if}
        {:else}
          <div class="settings-row-label" style="color:var(--error-color);">{t('sync_settings.connection_failed')}{tested.message}</div>
        {/if}
      </div>
    </div>
  {/if}
  <div class="settings-row">
    <div></div>
    <div class="settings-row-control">
      <button class="btn btn-secondary" disabled={!!busy} onclick={test}>{@render spin('test')}<i class="ph ph-check-circle"></i>{t('sync_settings.test_connection')}</button>
      <button class="btn btn-primary" disabled={!!busy} onclick={save}>{@render spin('save')}<i class="ph ph-floppy-disk"></i>{t('sync_settings.save_and_sync')}</button>
    </div>
  </div>
{/if}

{#if target}
  <div class="settings-section-subhead">{t('sync_settings.status')}</div>
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{target.url} · {target.username}</div>
      <div class="settings-row-desc">{t('sync_settings.last_success')} {fmtUnix(target.last_success_at, never)}</div>
      {#if target.last_error}
        <div class="settings-row-desc" style="color:var(--error-color);">{t('sync_settings.last_error')}{target.last_error}</div>
      {/if}
      {#if target.in_backoff}
        <div class="settings-row-desc">
          {t('sync_settings.backoff').replace('{count}', String(target.consecutive_failures)).replace('{time}', fmtUnix(target.retry_at, never))}
        </div>
      {/if}
      {#if target.needs_full_sync}<div class="settings-row-desc">{t('sync_settings.full_sync_pending')}</div>{/if}
    </div>
    <div class="settings-row-control">
      <button class="btn btn-secondary" disabled={!!busy} onclick={() => run(false)}>{@render spin('run')}<i class="ph ph-arrows-clockwise"></i>{t('sync_settings.sync_now')}</button>
      <button class="btn btn-ghost" disabled={!!busy} onclick={() => run(true)}>{@render spin('full')}{t('sync_settings.force_full_sync')}</button>
    </div>
  </div>
{/if}
