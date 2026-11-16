<script lang="ts">
  // Port of upstream setting_components/auto_delete_settings.rs: delete server-side
  // downloads after N days (0 = never), and/or once an episode is completed.
  import * as E from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let days = $state(0);
  let onComplete = $state(false);
  let loading = $state(true);
  let success = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  Promise.all([E.getUserAutoDeleteDays(), E.getUserAutoDeleteOnComplete()])
    .then(([d, c]) => {
      days = d;
      onComplete = c;
    })
    .catch((e) => toast.error(`${t('auto_delete_settings.failed_to_fetch')}${(e as Error).message}`))
    .finally(() => (loading = false));

  function flash() {
    success = t('auto_delete_settings.updated_successfully');
    clearTimeout(timer);
    timer = setTimeout(() => (success = ''), 3000);
  }

  async function saveDays() {
    days = Number.isFinite(days) ? Math.min(3650, Math.max(0, Math.round(days))) : 0;
    try {
      await E.setUserAutoDeleteDays(days);
      flash();
    } catch (e) {
      toast.error(`${t('auto_delete_settings.failed_to_update')}${(e as Error).message}`);
    }
  }

  async function toggleComplete(e: Event) {
    const enabled = (e.currentTarget as HTMLInputElement).checked;
    onComplete = enabled;
    try {
      await E.setUserAutoDeleteOnComplete(enabled);
      flash();
    } catch (err) {
      onComplete = !enabled;
      toast.error(`${t('auto_delete_settings.failed_to_update')}${(err as Error).message}`);
    }
  }
</script>

<div class="settings-row">
  <div>
    <div class="settings-row-label">{t('auto_delete_settings.label')}</div>
    <div class="settings-row-desc">{t('auto_delete_settings.description')}</div>
  </div>
  <div class="settings-row-control" style="display:flex;align-items:center;gap:6px;">
    <input type="number" bind:value={days} class="input" style="width:72px;" min="0" max="3650" step="1" disabled={loading} aria-label={t('auto_delete_settings.label')} />
    <span style="font-size:12px;color:var(--text-secondary-color);">{t('auto_delete_settings.days')}</span>
    <button class="btn btn-secondary" style="padding:6px 12px;" onclick={saveDays} disabled={loading}>
      <i class="ph ph-floppy-disk"></i><span>{t('common.save')}</span>
    </button>
  </div>
</div>
<div class="settings-row">
  <div>
    <div class="settings-row-label">{t('auto_delete_settings.on_complete_label')}</div>
    <div class="settings-row-desc">{t('auto_delete_settings.on_complete_description')}</div>
  </div>
  <div class="settings-row-control">
    <label class="toggle">
      <input type="checkbox" disabled={loading} checked={onComplete} onchange={toggleComplete} aria-label={t('auto_delete_settings.on_complete_label')} />
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
  </div>
</div>
{#if days > 0}
  <div class="settings-row">
    <div class="settings-row-desc" style="display:flex;align-items:center;gap:6px;color:var(--error-color, #d9534f);">
      <i class="ph ph-warning-circle"></i><span>{t('auto_delete_settings.warning')}</span>
    </div>
  </div>
{/if}
{#if success}
  <div class="settings-row">
    <div class="success-message" style="font-size:12px;color:var(--hover-color);">{success}</div>
  </div>
{/if}
