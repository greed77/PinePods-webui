<script lang="ts">
  // Port of upstream setting_components/user_self_service.rs: let people create
  // their own accounts from the login page.
  import * as E from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let enabled = $state(false);
  let loading = $state(false);

  E.selfServiceStatus().then((r) => (enabled = !!r.status), (e) => console.warn('Error getting self service status', e));

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    loading = true;
    try {
      await E.toggleSelfService();
      enabled = !enabled;
    } catch (err) {
      toast.error(`Error enabling/disabling self service: ${(err as Error).message}`);
    } finally {
      loading = false;
    }
  }
</script>

<div class="settings-row">
  <div><div class="settings-row-label">{t('user_self_service.enable_user_self_service')}</div></div>
  <div class="settings-row-control">
    <label class="toggle">
      <input type="checkbox" disabled={loading} checked={enabled} onclick={toggle} aria-label={t('user_self_service.enable_user_self_service')} />
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
  </div>
</div>
