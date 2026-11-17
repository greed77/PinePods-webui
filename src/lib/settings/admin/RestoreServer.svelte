<script lang="ts">
  // Port of upstream setting_components/restore_server.rs: replace the whole database
  // from an uploaded SQL file or one of the server's backups, then sign out. Asks for
  // confirmation first (upstream relies on the warning text alone).
  import { goto } from '$app/navigation';
  import * as E from '$lib/api/endpoints';
  import type { BackupFile } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import BackupFileList from './BackupFileList.svelte';

  let mode = $state<'upload' | 'select'>('upload');
  let file = $state<File | null>(null);
  let dbPass = $state('');
  let sqlite = $state(false);
  let files = $state<BackupFile[]>([]);
  let filesLoading = $state(false);
  let picked = $state<string | null>(null);
  let busy = $state(false);
  let confirming = $state(false);

  E.listBackupFiles().then((r) => (sqlite = r.sqlite), () => {});

  $effect(() => {
    if (mode !== 'select') return;
    filesLoading = true;
    E.listBackupFiles()
      .then((r) => (files = r.files))
      .catch((e) => toast.error(`${t('restore_server.failed_to_load_backup_files')}${(e as Error).message}`))
      .finally(() => (filesLoading = false));
  });

  function askUpload() {
    if (!file) return toast.error('Please select a backup file');
    if (!dbPass.trim() && !sqlite) return toast.error('Database password is required');
    confirming = true;
  }

  async function restore() {
    confirming = false;
    busy = true;
    try {
      if (mode === 'upload' && file) {
        const msg = await E.restoreServer(file, dbPass);
        toast.info(`Server restore started successfully: ${msg}`);
      } else if (picked) {
        await E.restoreBackupFile(picked);
        toast.info('Restore from backup file started successfully');
      }
      goto('/sign_out');
    } catch (e) {
      toast.error(`${mode === 'upload' ? 'Failed to restore server' : 'Failed to restore from backup file'}: ${(e as Error).message}`);
      busy = false;
    }
  }
</script>

{#if confirming}
  <ConfirmModal
    title={t('restore_server.restore_server')}
    text={t('restore_server.warning')}
    yes={t('restore_server.restore_server')}
    no={t('common.cancel')}
    onyes={restore}
    onclose={() => (confirming = false)}
  />
{/if}

<div class="settings-row">
  <div class="settings-row-label"><div style="color:var(--error-color,#ef4444);font-weight:600;font-size:13px;">{t('restore_server.warning')}</div></div>
</div>
<div class="settings-row" style="flex-wrap: wrap;">
  <div class="settings-row-label"><div>{t('restore_server.restore_method')}</div></div>
  <div class="settings-row-control" style="flex: 1 1 200px; min-width: 0;">
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-color);">
      <input type="radio" name="restore_mode" value="upload" bind:group={mode} />{t('restore_server.upload_backup_file')}
    </label>
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-color);">
      <input type="radio" name="restore_mode" value="select" bind:group={mode} />{t('restore_server.select_from_server_backups')}
    </label>
  </div>
</div>

{#if mode === 'upload'}
  <div class="settings-row">
    <div class="settings-row-label">
      <div>{t('restore_server.backup_file_sql')}</div>
      <div class="settings-row-desc">{t('restore_server.upload_backup_hint')}</div>
    </div>
    <div class="settings-row-control">
      <label class="btn btn-secondary" style="padding:6px 12px;cursor:pointer;">
        <i class="ph ph-upload-simple"></i><span>{t('restore_server.choose_file')}</span>
        <input type="file" accept=".sql" disabled={busy} onchange={(e) => (file = e.currentTarget.files?.[0] ?? null)} style="display:none;" />
      </label>
      {#if file}<span class="settings-row-desc">{t('restore_server.file_selected')} {file.name}</span>{/if}
    </div>
  </div>
  <div class="settings-row" style="flex-wrap: wrap;">
    <div class="settings-row-label">{#if !sqlite}<div>{t('restore_server.database_password')}</div>{/if}</div>
    <div class="settings-row-control" style="flex: 1 1 200px; min-width: 0;">
      {#if !sqlite}
        <input type="password" bind:value={dbPass} disabled={busy} class="input" placeholder="Database password" style="flex: 1; min-width: 0;" autocomplete="off" aria-label={t('restore_server.database_password')} />
      {/if}
      <button onclick={askUpload} disabled={busy} class="btn btn-danger" style="flex-shrink: 0;">
        {#if busy}<i class="ph ph-spinner animate-spin"></i><span>Restoring...</span>{:else}<i class="ph ph-arrow-counter-clockwise"></i><span>{t('restore_server.restore_server')}</span>{/if}
      </button>
    </div>
  </div>
{:else}
  <div class="settings-row">
    <div class="settings-row-label">
      <div>{t('restore_server.server_backup_files')}</div>
      <div class="settings-row-desc">{t('restore_server.server_backups_hint')}</div>
    </div>
  </div>
  {#if filesLoading}
    <div class="settings-row">
      <div class="settings-row-label">
        <div class="settings-row-desc" style="display:flex;align-items:center;gap:8px;"><i class="ph ph-spinner animate-spin"></i><span>{t('restore_server.loading_backup_files')}</span></div>
      </div>
    </div>
  {:else if files.length === 0}
    <div class="settings-row">
      <div class="settings-row-label"><div class="settings-row-desc"><i class="ph ph-folder-open" style="margin-right:4px;"></i>{t('restore_server.no_backup_files')}</div></div>
    </div>
  {:else}
    <BackupFileList {files} selected={picked} onpick={(f) => (picked = f.filename)} />
  {/if}
  {#if picked}
    <div class="settings-row">
      <div class="settings-row-label"><div class="settings-row-desc">{t('restore_server.selected_file_warning')}</div></div>
      <div class="settings-row-control">
        <button onclick={() => (confirming = true)} disabled={busy} class="btn btn-danger" style="padding:6px 12px;">
          {#if busy}<i class="ph ph-spinner animate-spin"></i><span>Restoring...</span>{:else}<i class="ph ph-arrow-counter-clockwise"></i><span>{t('restore_server.restore_from_selected')}</span>{/if}
        </button>
      </div>
    </div>
  {/if}
{/if}

{#if busy}
  <div class="settings-row">
    <div class="settings-row-label">
      <div class="settings-row-desc" style="display:flex;align-items:center;gap:8px;"><i class="ph ph-spinner animate-spin"></i><span>{t('restore_server.restoring_database')}</span></div>
      <div class="settings-row-desc">{t('restore_server.dont_close_window')}</div>
    </div>
  </div>
{/if}
