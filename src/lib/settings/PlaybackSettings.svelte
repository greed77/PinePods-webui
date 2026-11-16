<script lang="ts">
  // Port of upstream setting_components/playback_settings.rs: default playback speed,
  // auto-complete threshold and default volume, each saved on its own. (Upstream's
  // queue add-position needs a newer server than 0.9.2, so it's left out.)
  import * as E from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let speed = $state(1);
  let autoComplete = $state(0);
  let volume = $state(100);
  let loading = $state(true);
  let success = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  Promise.allSettled([
    E.getUserPlaybackSpeed().then((v) => (speed = v), (e) => toast.error(`${t('playback_settings.failed_to_fetch_playback_speed')}${e.message}`)),
    E.getAutoCompleteSeconds().then((v) => (autoComplete = v), (e) => toast.error(`${t('playback_settings.failed_to_fetch_auto_complete_seconds')}${e.message}`)),
    E.getDefaultVolume().then((v) => (volume = v), (e) => toast.error(`${t('playback_settings.failed_to_fetch_default_volume')}${e.message}`))
  ]).finally(() => (loading = false));

  const clamp = (v: number, lo: number, hi: number, dflt: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);

  async function save(call: () => Promise<unknown>, ok: string, failed: string) {
    try {
      await call();
      success = t(ok);
      clearTimeout(timer);
      timer = setTimeout(() => (success = ''), 3000);
    } catch (e) {
      toast.error(`${t(failed)}${(e as Error).message}`);
    }
  }
</script>

{#snippet row(label: string, desc: string, unit: string, onsave: () => void, input: import('svelte').Snippet)}
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{label}</div>
      <div class="settings-row-desc">{desc}</div>
    </div>
    <div class="settings-row-control" style="display:flex;align-items:center;gap:6px;">
      {@render input()}
      <span style="font-size:12px;color:var(--text-secondary-color);">{unit}</span>
      <button class="btn btn-secondary" style="padding:6px 12px;" onclick={onsave} disabled={loading}>
        <i class="ph ph-floppy-disk"></i><span>{t('common.save')}</span>
      </button>
    </div>
  </div>
{/snippet}

{#snippet speedInput()}
  <input type="number" bind:value={speed} class="input" style="width:72px;" min="0.5" max="3.0" step="0.1" disabled={loading} aria-label={t('playback_settings.default_playback_speed')} />
{/snippet}
{#snippet autoInput()}
  <input type="number" bind:value={autoComplete} class="input" style="width:72px;" min="0" max="3600" step="1" disabled={loading} aria-label={t('playback_settings.auto_complete_episode_threshold')} />
{/snippet}
{#snippet volumeInput()}
  <input type="number" bind:value={volume} class="input" style="width:72px;" min="0" max="100" step="1" disabled={loading} aria-label={t('playback_settings.default_volume')} />
{/snippet}

{@render row(
  t('playback_settings.default_playback_speed'),
  t('playback_settings.range'),
  'x',
  () => {
    speed = clamp(speed, 0.5, 3, 1);
    save(() => E.setUserPlaybackSpeed(speed), 'playback_settings.default_playback_speed_updated_successfully', 'playback_settings.failed_to_update_playback_speed');
  },
  speedInput
)}
{@render row(
  t('playback_settings.auto_complete_episode_threshold'),
  t('playback_settings.auto_complete_description'),
  t('playback_settings.seconds'),
  () => {
    autoComplete = Math.round(clamp(autoComplete, 0, 3600, 0));
    save(() => E.updateAutoCompleteSeconds(autoComplete), 'playback_settings.auto_complete_seconds_updated_successfully', 'playback_settings.failed_to_update_auto_complete_seconds');
  },
  autoInput
)}
{@render row(
  t('playback_settings.default_volume'),
  t('playback_settings.default_volume_range'),
  '%',
  () => {
    volume = Math.round(clamp(volume, 0, 100, 100));
    save(() => E.setDefaultVolume(volume), 'playback_settings.default_volume_updated_successfully', 'playback_settings.failed_to_update_default_volume');
  },
  volumeInput
)}
{#if success}
  <div class="settings-row">
    <div class="success-message" style="font-size:12px;color:var(--hover-color);">{success}</div>
  </div>
{/if}
