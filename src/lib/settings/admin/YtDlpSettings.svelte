<script lang="ts">
  // Port of upstream setting_components/ytdlp_settings.rs: the yt-dlp version the
  // server uses for YouTube, its update channel, auto-update, and update-now.
  import * as E from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let loaded = $state(false);
  let version = $state<string | null>(null);
  let autoUpdate = $state(true);
  let channel = $state('stable');
  let lastUpdated = $state<string | null>(null);
  let lastResult = $state<string | null>(null);
  let saving = $state(false);
  let updating = $state(false);

  function load() {
    E.getYtDlpSettings()
      .then((r) => {
        autoUpdate = r.settings.auto_update;
        channel = r.settings.channel || 'stable';
        lastUpdated = r.settings.last_updated ?? null;
        lastResult = r.settings.last_result ?? null;
        version = r.version ?? null;
        loaded = true;
      })
      .catch(() => {});
  }
  load();

  async function save() {
    saving = true;
    try {
      await E.updateYtDlpSettings(autoUpdate, channel);
      toast.info(t('ytdlp_settings.saved'));
      load();
    } catch (e) {
      toast.error(`${t('ytdlp_settings.save_error')}: ${(e as Error).message}`);
    } finally {
      saving = false;
    }
  }

  async function updateNow() {
    updating = true;
    toast.info(t('ytdlp_settings.update_started'));
    try {
      const r = await E.triggerYtDlpUpdate();
      if (r.success) toast.info(r.detail);
      else toast.error(r.detail);
      load();
    } catch (e) {
      toast.error(`${t('ytdlp_settings.update_error')}: ${(e as Error).message}`);
    } finally {
      updating = false;
    }
  }
</script>

{#if loaded}
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{t('ytdlp_settings.current_version')}</div>
      <div class="settings-row-desc">{t('ytdlp_settings.intro')}</div>
    </div>
    <div class="settings-row-control">
      <span style="font-weight:500; color: var(--text-color);">{version ?? t('ytdlp_settings.version_unknown')}</span>
    </div>
  </div>
  {#if lastUpdated}
    <div class="settings-row">
      <div>
        <div class="settings-row-label">{t('ytdlp_settings.last_update')}</div>
        <div class="settings-row-desc">{lastResult ?? ''}</div>
      </div>
      <div class="settings-row-control"><span class="settings-row-desc">{lastUpdated}</span></div>
    </div>
  {/if}
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{t('ytdlp_settings.channel')}</div>
      <div class="settings-row-desc">{t('ytdlp_settings.channel_desc')}</div>
    </div>
    <div class="settings-row-control">
      <select class="select" style="width:200px;max-width:60vw;" bind:value={channel} aria-label={t('ytdlp_settings.channel')}>
        <option value="stable">{t('ytdlp_settings.channel_stable')}</option>
        <option value="nightly">{t('ytdlp_settings.channel_nightly')}</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{t('ytdlp_settings.auto_update')}</div>
      <div class="settings-row-desc">{t('ytdlp_settings.auto_update_desc')}</div>
    </div>
    <div class="settings-row-control">
      <label class="toggle">
        <input type="checkbox" bind:checked={autoUpdate} aria-label={t('ytdlp_settings.auto_update')} />
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
      </label>
    </div>
  </div>
  <div class="settings-row">
    <div></div>
    <div class="settings-row-control" style="gap:8px;">
      <button class="btn btn-secondary" onclick={updateNow} disabled={updating}>
        <i class="ph ph-arrows-clockwise"></i><span>{updating ? t('ytdlp_settings.updating') : t('ytdlp_settings.update_now')}</span>
      </button>
      <button class="btn btn-primary" onclick={save} disabled={saving}>
        <i class="ph ph-floppy-disk"></i><span>{saving ? t('ytdlp_settings.saving') : t('ytdlp_settings.save')}</span>
      </button>
    </div>
  </div>
{/if}
