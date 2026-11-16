<script lang="ts">
  // Port of upstream setting_components/mfa_settings.rs: toggling on generates a TOTP
  // secret and QR code to verify; toggling off removes MFA.
  import * as E from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let enabled = $state(false);
  let busy = $state(false);
  let setup = $state<{ secret: string; qr_code_svg: string } | null>(null);
  let code = $state('');

  function refresh() {
    E.checkMfaEnabled()
      .then((r) => (enabled = !!r.mfa_enabled))
      .catch((e) => toast.error(`${t('mfa_settings.error_getting_mfa_status')}${(e as Error).message}`));
  }
  refresh();

  async function toggle(e: MouseEvent) {
    // The checkbox shows server state; actions below update it.
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      if (enabled) {
        await E.disableMfa();
        enabled = false;
      } else {
        setup = await E.generateMfaSecret();
        code = '';
      }
    } catch (err) {
      toast.error(`${enabled ? t('mfa_settings.error_disabling_mfa') : t('mfa_settings.failed_to_generate_totp_secret')}${(err as Error).message}`);
    } finally {
      busy = false;
    }
  }

  async function verify() {
    try {
      if (await E.verifyTempMfa(code.trim())) {
        setup = null;
        refresh();
      } else toast.error(t('mfa_settings.mfa_code_verification_failed'));
    } catch (err) {
      toast.error(`${t('mfa_settings.failed_to_verify_mfa_code')}${(err as Error).message}`);
    }
  }

  // Shown as an image so markup from the server can't run anything.
  const qrSrc = $derived(setup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qr_code_svg)}` : '');
</script>

{#if setup}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    id="setup-mfa-modal"
    class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-full max-h-full bg-black bg-opacity-25"
    onclick={(e) => e.target === e.currentTarget && (setup = null)}
  >
    <div class="modal-container relative w-full max-w-md rounded-lg shadow" role="dialog" aria-modal="true" aria-label={t('mfa_settings.setup_mfa')}>
      <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
        <h3 style="font-size:16px;font-weight:600;color:var(--text-color);">{t('mfa_settings.setup_mfa')}</h3>
        <button onclick={() => (setup = null)} class="iconbtn" aria-label={t('common.cancel')}><i class="ph ph-x" style="font-size:18px;"></i></button>
      </div>
      <div class="p-4 md:p-5" style="display:flex;flex-direction:column;gap:14px;">
        <p style="font-size:13px;color:var(--text-secondary-color);">{t('mfa_settings.scan_qr_or_enter_code')}</p>
        <div style="align-self:center;background:#fff;border-radius:8px;overflow:hidden;padding:16px;box-shadow:0 4px 12px rgba(0,0,0,.2);">
          <img src={qrSrc} alt="MFA QR code" style="width:200px;height:200px;" />
        </div>
        <div class="mfa-code-box" style="padding:10px 14px;border-radius:6px;overflow-x:auto;white-space:nowrap;max-width:100%;font-size:13px;">{setup.secret}</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label for="mfa-verify-code" style="font-size:13px;font-weight:500;color:var(--text-color);">{t('mfa_settings.verify_code')}</label>
          <input id="mfa-verify-code" bind:value={code} type="text" class="input" inputmode="numeric" autocomplete="one-time-code" required />
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:0 16px 16px;">
        <button onclick={() => (setup = null)} class="btn btn-secondary">{t('common.cancel')}</button>
        <button onclick={verify} class="btn btn-primary"><i class="ph ph-check"></i>{t('mfa_settings.verify')}</button>
      </div>
    </div>
  </div>
{/if}

<div class="settings-row">
  <div><div class="settings-row-label">{t('mfa_settings.enable_mfa')}</div></div>
  <div class="settings-row-control">
    <label class="toggle">
      <input type="checkbox" disabled={busy} checked={enabled} onclick={toggle} aria-label={t('mfa_settings.enable_mfa')} />
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
  </div>
</div>
