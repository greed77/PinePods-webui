<script lang="ts">
  // Port of upstream setting_components/download_settings.rs: allow server-side
  // downloads, and what to write next to downloaded files (covers, metadata sidecars).
  import * as E from '$lib/api/endpoints';
  import type { DownloadMetadataSettings } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let enabled = $state(false);
  let loading = $state(false);
  let meta = $state<DownloadMetadataSettings | null>(null);

  E.getServerDownloadStatus().then(
    (v) => (enabled = v),
    (e) => toast.error(`${t('download_settings.error_getting_download_status')}${(e as Error).message}`)
  );
  E.getDownloadMetadataSettings().then(
    (m) => (meta = m),
    (e) => toast.error(`${t('download_settings.error_getting_metadata_settings')}${(e as Error).message}`)
  );

  async function toggleDownloads(e: MouseEvent) {
    e.preventDefault();
    loading = true;
    try {
      await E.toggleServerDownloads();
      enabled = !enabled;
    } catch (err) {
      toast.error(`${t('download_settings.error_enabling_disabling_downloads')}${(err as Error).message}`);
    } finally {
      loading = false;
    }
  }

  async function save(patch: Partial<DownloadMetadataSettings>) {
    if (!meta) return;
    const prev = meta;
    const next = { ...meta, ...patch };
    meta = next;
    try {
      await E.setDownloadMetadataSettings(next);
    } catch (err) {
      meta = prev;
      toast.error(`${t('download_settings.error_saving_metadata_settings')}${(err as Error).message}`);
    }
  }
</script>

{#snippet toggleRow(label: string, desc: string, key: 'folder_cover' | 'episode_cover' | 'metadata_sidecar' | 'metadata_subfolder', disabled: boolean)}
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{label}</div>
      {#if desc}<div class="settings-row-desc">{desc}</div>{/if}
    </div>
    <div class="settings-row-control">
      <label class="toggle">
        <input type="checkbox" {disabled} checked={!!meta?.[key]} onchange={(e) => save({ [key]: e.currentTarget.checked })} aria-label={label} />
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
      </label>
    </div>
  </div>
{/snippet}

<div class="settings-row">
  <div><div class="settings-row-label">{t('download_settings.enable_server_downloads')}</div></div>
  <div class="settings-row-control">
    <label class="toggle">
      <input type="checkbox" disabled={loading} checked={enabled} onclick={toggleDownloads} aria-label={t('download_settings.enable_server_downloads')} />
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
  </div>
</div>
{@render toggleRow(t('download_settings.folder_cover_label'), t('download_settings.folder_cover_description'), 'folder_cover', !meta)}
{@render toggleRow(t('download_settings.episode_cover_label'), t('download_settings.episode_cover_description'), 'episode_cover', !meta)}
{@render toggleRow(t('download_settings.metadata_sidecar_label'), t('download_settings.metadata_sidecar_description'), 'metadata_sidecar', !meta)}
<div class="settings-row">
  <div><div class="settings-row-label">{t('download_settings.metadata_format_label')}</div></div>
  <div class="settings-row-control">
    <select
      class="select"
      disabled={!meta || !meta.metadata_sidecar}
      value={meta?.metadata_format ?? 'json'}
      onchange={(e) => save({ metadata_format: e.currentTarget.value })}
      aria-label={t('download_settings.metadata_format_label')}
    >
      <option value="json">{t('download_settings.metadata_format_json')}</option>
      <option value="xml">{t('download_settings.metadata_format_xml')}</option>
      <option value="ffmetadata">{t('download_settings.metadata_format_ffmetadata')}</option>
      <option value="both">{t('download_settings.metadata_format_both')}</option>
    </select>
  </div>
</div>
{@render toggleRow(t('download_settings.metadata_subfolder_label'), '', 'metadata_subfolder', !meta || !meta.metadata_sidecar)}
