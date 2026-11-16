<script lang="ts">
  // Port of upstream setting_components/nextcloud_options.rs (SyncOptions): the PinePods
  // gpodder server (on/off, URL and login for apps, app passwords, devices), the external
  // sync server (SyncExternal), and sync statistics.
  import * as E from '$lib/api/endpoints';
  import type { AppPassword, SyncDevice, SyncServerInfo, SyncStats, SyncTargetInfo } from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { fmtUnix } from './syncFormat';
  import SyncExternal from './SyncExternal.svelte';

  let server = $state<SyncServerInfo | null>(null);
  let target = $state<SyncTargetInfo | null | undefined>(undefined);
  let reload = $state(0);

  $effect(() => {
    reload;
    E.getSyncServer().then((s) => (server = s), (e) => toast.error((e as Error).message));
    E.getSyncTarget().then((v) => (target = v), (e) => toast.error((e as Error).message));
  });
  const changed = () => reload++;

  async function dismiss() {
    await E.dismissSyncNotice().catch((e) => toast.error((e as Error).message));
    changed();
  }

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.info(t('sync_settings.copied'));
  };

  // ---- the PinePods gpodder server ----
  let toggling = $state(false);
  async function toggleServer(e: MouseEvent) {
    e.preventDefault();
    if (!server || toggling) return;
    toggling = true;
    try {
      server = await E.setSyncServer(!server.enabled);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      toggling = false;
      changed();
    }
  }
  // Without a configured public URL, the address this browser reached Pinepods at is the best guess.
  const serverUrl = $derived(server ? (server.server_url_configured ? server.server_url : session.serverName) : '');

  // ---- app passwords ----
  let passwords = $state<AppPassword[]>([]);
  let label = $state('');
  let created = $state<{ label: string; password: string } | null>(null);
  function loadPasswords() {
    E.listAppPasswords().then((l) => (passwords = l), (e) => toast.error((e as Error).message));
  }
  async function generate() {
    try {
      created = await E.createAppPassword(label.trim());
      label = '';
      loadPasswords();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function revoke(id: number) {
    if (!confirm(t('sync_settings.revoke_confirm'))) return;
    await E.revokeAppPassword(id).catch((e) => toast.error((e as Error).message));
    loadPasswords();
  }

  // ---- devices ----
  let devices = $state<SyncDevice[]>([]);
  let editing = $state<number | null>(null);
  let caption = $state('');
  function loadDevices() {
    E.listSyncDevices().then((d) => (devices = d), (e) => toast.error((e as Error).message));
  }
  async function saveCaption() {
    if (editing === null) return;
    try {
      await E.renameSyncDevice(editing, caption.trim());
      editing = null;
    } catch (e) {
      toast.error((e as Error).message);
    }
    loadDevices();
  }
  async function removeDevice(id: number) {
    if (!confirm(t('sync_settings.remove_device_confirm'))) return;
    await E.removeSyncDevice(id).catch((e) => toast.error((e as Error).message));
    loadDevices();
  }
  const appCount = $derived(devices.filter((d) => !d.protected).length);

  $effect(() => {
    if (server?.enabled) {
      loadPasswords();
      loadDevices();
    }
  });

  // ---- statistics ----
  let statsOpen = $state(false);
  let stats = $state<SyncStats | null>(null);
  let statsRefresh = $state(0);
  $effect(() => {
    statsRefresh;
    reload;
    if (statsOpen) E.getSyncStats().then((s) => (stats = s), (e) => toast.error((e as Error).message));
  });
  const origin = (o: string, device?: string | null) =>
    o === 'pinepods' ? 'PinePods' : o === 'target' ? t('sync_settings.origin_external') : device || t('sync_settings.origin_app');
  const never = $derived(t('sync_settings.never'));
</script>

{#if !server || target === undefined}
  <div class="settings-row"><div class="settings-row-desc"><i class="ph ph-spinner animate-spin"></i></div></div>
{:else}
  {#if server.notice === 'reenter_external'}
    <div class="sync-notice">
      <i class="ph ph-warning"></i>
      <div class="sync-notice-text">{t('sync_settings.reenter_notice')}</div>
      <button class="btn btn-ghost" onclick={dismiss}>{t('sync_settings.dismiss')}</button>
    </div>
  {/if}

  <div class="settings-subsection-title">{t('sync_settings.server_title')}</div>
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{t('sync_settings.server_toggle')}</div>
      <div class="settings-row-desc">{t('sync_settings.server_desc')}</div>
    </div>
    <div class="settings-row-control">
      <label class="toggle">
        <input type="checkbox" checked={server.enabled} disabled={toggling} onclick={toggleServer} aria-label={t('sync_settings.server_toggle')} />
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
      </label>
      {#if toggling}<i class="ph ph-spinner animate-spin"></i>{/if}
    </div>
  </div>

  {#if server.enabled}
    <div class="settings-row">
      <div>
        <div class="settings-row-label">{t('sync_settings.server_url')}</div>
        <div class="settings-row-desc">{t('sync_settings.server_url_hint')}</div>
      </div>
      <div class="settings-row-control">
        <code class="sync-code">{serverUrl}</code>
        <button class="btn btn-ghost" onclick={() => copy(serverUrl)} title={t('sync_settings.copy')} aria-label={t('sync_settings.copy')}><i class="ph ph-copy"></i></button>
      </div>
    </div>
    <div class="settings-row">
      <div>
        <div class="settings-row-label">{t('sync_settings.username')}</div>
        <div class="settings-row-desc">{t('sync_settings.password_hint')}</div>
      </div>
      <div class="settings-row-control"><code class="sync-code">{server.username}</code></div>
    </div>

    {#if created}
      <div class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-full bg-black bg-opacity-25">
        <div class="modal-container relative p-4 w-full max-w-md rounded-lg shadow" role="dialog" aria-modal="true">
          <div class="flex flex-col items-start p-4 md:p-5">
            <h3 style="font-size:16px;font-weight:600;color:var(--text-color);margin-bottom:8px;">{t('sync_settings.app_password_created')}</h3>
            <p style="font-size:13px;color:var(--text-secondary-color);">{t('sync_settings.app_password_shown_once')}</p>
            <p style="font-size:13px;color:var(--text-secondary-color);margin-top:4px;">{created.label}</p>
            <div class="mfa-code-box mt-4 p-4 rounded-md overflow-x-auto whitespace-nowrap max-w-full">{created.password}</div>
            <div class="flex" style="gap:8px;margin-top:16px;">
              <button class="btn btn-secondary" onclick={() => created && copy(created.password)}><i class="ph ph-copy"></i>{t('sync_settings.copy')}</button>
              <button class="btn btn-primary" onclick={() => (created = null)}>{t('sync_settings.done')}</button>
            </div>
          </div>
        </div>
      </div>
    {/if}
    <div class="settings-section-subhead">{t('sync_settings.app_passwords')}</div>
    <div class="settings-row">
      <div><div class="settings-row-desc">{t('sync_settings.app_passwords_desc')}</div></div>
      <div class="settings-row-control">
        <input
          type="text"
          class="input"
          style="width:220px;max-width:60vw;"
          bind:value={label}
          placeholder={t('sync_settings.app_password_label_placeholder')}
          aria-label={t('sync_settings.app_password_label_placeholder')}
        />
        <button class="btn btn-secondary" onclick={generate}><i class="ph ph-key"></i>{t('sync_settings.generate_app_password')}</button>
      </div>
    </div>
    {#if passwords.length === 0}
      <div class="settings-row"><div class="settings-row-desc">{t('sync_settings.no_app_passwords')}</div></div>
    {/if}
    {#each passwords as p (p.id)}
      <div class="settings-row">
        <div>
          <div class="settings-row-label">{p.label}</div>
          <div class="settings-row-desc">
            {t('sync_settings.created')} {fmtUnix(p.created_at, never)} · {t('sync_settings.last_used')} {fmtUnix(p.last_used_at, never)}
          </div>
        </div>
        <div class="settings-row-control">
          <button class="btn btn-ghost" onclick={() => revoke(p.id)}><i class="ph ph-trash"></i>{t('sync_settings.revoke')}</button>
        </div>
      </div>
    {/each}

    <div class="settings-section-subhead">{t('sync_settings.devices')}</div>
    <div class="settings-row">
      <div><div class="settings-row-desc">{appCount === 0 ? t('sync_settings.no_devices') : t('sync_settings.devices_desc')}</div></div>
    </div>
    {#each devices as d (d.id)}
      <div class="settings-row">
        <div>
          {#if editing === d.id}
            <input type="text" class="input" style="width:220px;max-width:60vw;" bind:value={caption} aria-label={t('sync_settings.rename')} />
          {:else}
            <div class="settings-row-label">{d.protected ? t('sync_settings.this_server') : d.caption}</div>
          {/if}
          <div class="settings-row-desc">{d.name} · {d.type} · {t('sync_settings.last_seen')} {fmtUnix(d.last_seen, never)}</div>
        </div>
        {#if !d.protected}
          <div class="settings-row-control">
            {#if editing === d.id}
              <button class="btn btn-primary" onclick={saveCaption}>{t('sync_settings.save')}</button>
              <button class="btn btn-ghost" onclick={() => (editing = null)}>{t('sync_settings.cancel')}</button>
            {:else}
              <button
                class="btn btn-ghost"
                onclick={() => {
                  caption = d.caption;
                  editing = d.id;
                }}><i class="ph ph-pencil-simple"></i>{t('sync_settings.rename')}</button
              >
              <button class="btn btn-ghost" onclick={() => removeDevice(d.id)}><i class="ph ph-trash"></i>{t('sync_settings.remove')}</button>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  {/if}

  <SyncExternal {target} onchange={changed} />

  {#if server.enabled || target}
    <div class="settings-row">
      <div><div class="settings-row-label">{t('sync_settings.stats_title')}</div></div>
      <div class="settings-row-control">
        {#if statsOpen}
          <button class="btn btn-ghost" onclick={() => statsRefresh++} title={t('sync_settings.refresh')} aria-label={t('sync_settings.refresh')}><i class="ph ph-arrows-clockwise"></i></button>
        {/if}
        <button class="btn btn-ghost" onclick={() => (statsOpen = !statsOpen)} aria-label={t('sync_settings.stats_title')} aria-expanded={statsOpen}>
          <i class="ph {statsOpen ? 'ph-caret-up' : 'ph-caret-down'}"></i>
        </button>
      </div>
    </div>
    {#if statsOpen}
      {#if stats}
        <div class="sync-stats-grid">
          <div class="sync-stat"><div class="sync-stat-value">{stats.subscriptions}</div><div class="sync-stat-label">{t('sync_settings.stats_subscriptions')}</div></div>
          <div class="sync-stat"><div class="sync-stat-value">{stats.total_episode_actions}</div><div class="sync-stat-label">{t('sync_settings.stats_actions')}</div></div>
          {#if stats.server_enabled}
            <div class="sync-stat"><div class="sync-stat-value">{stats.devices}</div><div class="sync-stat-label">{t('sync_settings.devices')}</div></div>
          {/if}
          {#if stats.target}
            {@const tg = stats.target}
            <div class="sync-stat">
              <div class="sync-stat-value">{tg.pending_subscriptions != null && tg.pending_actions != null ? tg.pending_subscriptions + tg.pending_actions : '–'}</div>
              <div class="sync-stat-label">{t('sync_settings.stats_pending')}</div>
            </div>
          {/if}
        </div>
        <div class="settings-section-subhead">{t('sync_settings.recent_actions')}</div>
        {#if stats.recent_episode_actions.length === 0}
          <div class="settings-row"><div class="settings-row-desc">{t('sync_settings.no_actions')}</div></div>
        {/if}
        {#each stats.recent_episode_actions as a, i (i)}
          <div class="settings-row">
            <div>
              <div class="settings-row-label" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{a.episode}</div>
              <div class="settings-row-desc">{a.action} · {origin(a.origin, a.device)} · {fmtUnix(a.timestamp, never)}</div>
            </div>
          </div>
        {/each}
      {:else}
        <div class="settings-row"><div class="settings-row-desc"><i class="ph ph-spinner animate-spin"></i></div></div>
      {/if}
    {/if}
  {/if}
{/if}
