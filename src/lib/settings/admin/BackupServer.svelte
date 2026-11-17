<script lang="ts">
  // Port of upstream setting_components/backup_server.rs: scheduled backups (time,
  // on/off, how many to keep), download a backup now (needs the database password
  // unless the server uses SQLite), save one to the server's backup directory, and
  // the existing backup files.
  import { onDestroy } from 'svelte';
  import * as E from '$lib/api/endpoints';
  import type { BackupFile } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import BackupFileList from './BackupFileList.svelte';

  const SCHEDULES: [string, string][] = [
    ['0 0 2 * * *', 'backup_server.daily_2am'],
    ['0 0 3 * * 0', 'backup_server.weekly_sunday_3am'],
    ['0 0 1 1 * *', 'backup_server.monthly_1st_1am'],
    ['0 0 */6 * * *', 'backup_server.every_6_hours'],
    ['0 0 */12 * * *', 'backup_server.every_12_hours']
  ];

  let schedule = $state('0 0 2 * * *');
  let enabled = $state(false);
  let retention = $state(0);
  let updatedAt = $state<string | null>(null);
  let scheduleBusy = $state(false);

  let files = $state<BackupFile[]>([]);
  let sqlite = $state(false);
  let filesLoading = $state(false);
  let dbPass = $state('');
  let busy = $state(false);
  let destroyed = false;
  onDestroy(() => (destroyed = true));

  E.getScheduledBackup().then(
    (s) => {
      enabled = !!s.enabled;
      if (s.schedule) schedule = s.schedule;
      retention = s.retention_count ?? 0;
      updatedAt = s.updated_at ?? null;
    },
    (e) => toast.error(`${t('backup_server.failed_to_load_backup_schedule')}${(e as Error).message}`)
  );

  async function loadFiles(quiet = false) {
    if (!quiet) filesLoading = true;
    try {
      ({ files, sqlite } = await E.listBackupFiles());
    } catch (e) {
      toast.error(`${t('backup_server.failed_to_load_backups')}${(e as Error).message}`);
    } finally {
      filesLoading = false;
    }
  }
  loadFiles();

  async function saveSchedule(next: { schedule?: string; enabled?: boolean; retention?: number }) {
    const prev = { schedule, enabled, retention };
    schedule = next.schedule ?? schedule;
    enabled = next.enabled ?? enabled;
    retention = Math.max(0, Math.round(next.retention ?? retention) || 0);
    scheduleBusy = true;
    try {
      await E.scheduleBackup(schedule, enabled, retention > 0 ? retention : null);
      if (next.enabled !== undefined) toast.info(enabled ? t('backup_server.scheduled_backup_enabled') : t('backup_server.scheduled_backup_disabled'));
    } catch (e) {
      ({ schedule, enabled, retention } = prev);
      toast.error(`${t('backup_server.failed_to_update_backup_schedule')}${(e as Error).message}`);
    } finally {
      scheduleBusy = false;
    }
  }

  async function download() {
    if (!dbPass.trim() && !sqlite) return toast.error(t('backup_server.database_password_empty'));
    busy = true;
    try {
      E.downloadText(await E.backupServer(dbPass.trim()), 'server_backup.sql', 'text/plain');
    } catch (e) {
      toast.error(`${t('backup_server.backup_error')}${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  // The server writes the file in the background; watch the list until it shows up.
  async function saveToDirectory() {
    busy = true;
    try {
      const r = await E.manualBackupToDirectory();
      const name = r.filename ?? 'backup file';
      toast.info(t('backup_server.manual_backup_started').replace('{}', name));
      for (let i = 0; i < 60 && !destroyed; i++) {
        await new Promise((res) => setTimeout(res, 3000));
        await loadFiles(true);
        if (files.some((f) => f.filename === name)) {
          // One more look so the size is final.
          await new Promise((res) => setTimeout(res, 3000));
          await loadFiles(true);
          break;
        }
      }
    } catch (e) {
      toast.error(`${t('backup_server.failed_to_start_manual_backup')}${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  async function remove(f: BackupFile) {
    if (!confirm(`${t('backup_server.confirm_delete_backup')} ${f.filename}`)) return;
    try {
      await E.deleteBackupFile(f.filename);
      toast.info(t('backup_server.backup_deleted'));
      loadFiles();
    } catch (e) {
      toast.error(`${t('backup_server.failed_to_delete_backup')}${(e as Error).message}`);
    }
  }
</script>

<div class="settings-subsection-title"><i class="ph ph-clock-clockwise" style="margin-right:6px;color:var(--accent-color);"></i>{t('backup_server.scheduled_backups')}</div>
<div class="settings-row">
  <div class="settings-row-label"><div>{t('backup_server.schedule_time')}</div></div>
  <div class="settings-row-control">
    <select value={schedule} onchange={(e) => saveSchedule({ schedule: e.currentTarget.value })} disabled={scheduleBusy} class="select" aria-label={t('backup_server.schedule_time')}>
      {#each SCHEDULES as [cron, key] (cron)}<option value={cron}>{t(key)}</option>{/each}
      {#if !SCHEDULES.some(([c]) => c === schedule)}<option value={schedule}>{schedule}</option>{/if}
    </select>
  </div>
</div>
<div class="settings-row">
  <div class="settings-row-label"><div>{t('backup_server.status')}</div></div>
  <div class="settings-row-control">
    <label class="toggle">
      <input
        type="checkbox"
        checked={enabled}
        disabled={scheduleBusy}
        onclick={(e) => {
          e.preventDefault();
          saveSchedule({ enabled: !enabled });
        }}
        aria-label={t('backup_server.status')}
      />
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
      <span style="font-size:13px;color:var(--text-color);">{enabled ? t('backup_server.enabled') : t('backup_server.disabled')}</span>
    </label>
  </div>
</div>
<div class="settings-row">
  <div class="settings-row-label">
    <div>{t('backup_server.retention_label')}</div>
    <div class="settings-row-desc">{t('backup_server.retention_hint')}</div>
  </div>
  <div class="settings-row-control">
    <input
      type="number"
      min="0"
      value={retention}
      onchange={(e) => saveSchedule({ retention: Number(e.currentTarget.value) })}
      disabled={scheduleBusy}
      class="input"
      style="width:90px;"
      aria-label={t('backup_server.retention_label')}
    />
  </div>
</div>
{#if updatedAt}
  <div class="settings-row">
    <div class="settings-row-label">
      <div class="settings-row-desc"><i class="ph ph-info" style="margin-right:4px;"></i>{t('backup_server.last_updated')}{updatedAt}</div>
    </div>
  </div>
{/if}

<div class="settings-subsection-title"><i class="ph ph-download-simple" style="margin-right:6px;color:var(--accent-color);"></i>{t('backup_server.manual_backup')}</div>
<div class="settings-row" style="flex-wrap: wrap;">
  <div class="settings-row-label">
    <div>{t('backup_server.download_backup_file')}</div>
    <div class="settings-row-desc">{t('backup_server.download_backup_description')}</div>
  </div>
  <div class="settings-row-control" style="flex: 1 1 200px; min-width: 0;">
    {#if !sqlite}
      <input type="password" bind:value={dbPass} disabled={busy} class="input" placeholder="mYDBp@ss!" style="flex: 1; min-width: 0;" autocomplete="off" aria-label="Database password" />
    {/if}
    <button onclick={download} disabled={busy} class="btn btn-secondary" style="flex-shrink: 0;">
      {#if busy}<i class="ph ph-spinner animate-spin"></i><span>{t('backup_server.exporting')}</span>
      {:else}<i class="ph ph-download-simple"></i><span>{sqlite ? t('backup_server.download') : t('backup_server.authenticate')}</span>{/if}
    </button>
  </div>
</div>
<div class="settings-row" style="flex-wrap: wrap;">
  <div class="settings-row-label">
    <div>{t('backup_server.save_to_backup_directory')}</div>
    <div class="settings-row-desc">{t('backup_server.save_to_backup_description')}</div>
  </div>
  <div class="settings-row-control" style="flex: 1 1 auto;">
    <button onclick={saveToDirectory} disabled={busy} class="btn btn-secondary">
      {#if busy}<i class="ph ph-spinner animate-spin"></i><span>{t('backup_server.creating')}</span>
      {:else}<i class="ph ph-folder-plus"></i><span>{t('backup_server.create_backup')}</span>{/if}
    </button>
  </div>
</div>
{#if busy}
  <div class="settings-row">
    <div class="settings-row-label">
      <div class="settings-row-desc" style="display:flex;align-items:center;gap:8px;"><i class="ph ph-spinner animate-spin"></i><span>{t('backup_server.backing_up_database')}</span></div>
      <div class="settings-row-desc">{t('backup_server.backup_loading_message')}</div>
    </div>
  </div>
{/if}

<div class="settings-subsection-title" style="display:flex;align-items:center;justify-content:space-between;">
  <span><i class="ph ph-archive" style="margin-right:6px;color:var(--accent-color);"></i>{t('backup_server.existing_backups')}</span>
  <button onclick={() => loadFiles()} disabled={filesLoading} class="btn btn-secondary" title={t('backup_server.refresh_backups')} style="padding:4px 10px;">
    <i class="ph {filesLoading ? 'ph-spinner animate-spin' : 'ph-arrows-clockwise'}"></i><span>{t('backup_server.refresh')}</span>
  </button>
</div>
<div class="settings-row"><div class="settings-row-label"><div class="settings-row-desc">{t('backup_server.existing_backups_hint')}</div></div></div>
{#if filesLoading}
  <div class="settings-row">
    <div class="settings-row-label">
      <div class="settings-row-desc" style="display:flex;align-items:center;gap:8px;"><i class="ph ph-spinner animate-spin"></i><span>{t('backup_server.loading_backups')}</span></div>
    </div>
  </div>
{:else if files.length === 0}
  <div class="settings-row">
    <div class="settings-row-label"><div class="settings-row-desc"><i class="ph ph-folder-open" style="margin-right:4px;"></i>{t('backup_server.no_backups')}</div></div>
  </div>
{:else}
  <BackupFileList {files} ondelete={remove} deleteTitle={t('backup_server.delete_backup')} />
{/if}
