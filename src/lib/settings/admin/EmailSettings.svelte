<script lang="ts">
  // Port of upstream setting_components/email_settings.rs: the SMTP server used for
  // password resets. Settings can only be saved after a test email to the signed-in
  // user's address went through.
  import * as E from '$lib/api/endpoints';
  import type { EmailForm } from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let current = $state<{ ServerName: string; ServerPort: number; FromEmail: string; Encryption: string; AuthRequired: number; Username: string } | null>(null);
  let server = $state('');
  let port = $state('587');
  let from = $state('');
  let encryption = $state('StartTLS');
  let user = $state('');
  let pass = $state('');
  let auth = $state(true);
  let testing = $state(false);
  let tested = $state(false);
  let saving = $state(false);

  E.getEmailSettings().then(
    (s) => {
      current = s;
      server = s.ServerName;
      port = String(s.ServerPort);
      from = s.FromEmail;
      // Fresh servers store placeholder text here.
      encryption = ['none', 'SSL/TLS', 'StartTLS'].includes(s.Encryption) ? s.Encryption : 'StartTLS';
      user = s.Username;
      auth = s.AuthRequired === 1;
    },
    (e) => toast.error(`${t('email_settings.error_loading_email_settings')}${(e as Error).message}`)
  );

  const form = (): EmailForm => ({
    server_name: server,
    server_port: String(port),
    from_email: from,
    send_mode: 'SMTP',
    encryption,
    auth_required: auth,
    email_username: user,
    email_password: pass
  });

  // Changing anything means the settings need testing again before saving.
  $effect(() => {
    form();
    tested = false;
  });

  async function test() {
    testing = true;
    try {
      await E.sendTestEmail(
        form(),
        session.user?.Email ?? '',
        'This is a test email from PinePods! If you received this, your email settings are working correctly.'
      );
      toast.info(t('email_settings.test_email_success'));
      tested = true;
    } catch (e) {
      toast.error(`${t('email_settings.test_email_failed')}${(e as Error).message}`);
    } finally {
      testing = false;
    }
  }

  async function save() {
    saving = true;
    try {
      await E.saveEmailSettings(form());
      toast.info(t('email_settings.email_settings_saved'));
    } catch (e) {
      toast.error(`${t('email_settings.save_settings_failed')}${(e as Error).message}`);
    } finally {
      saving = false;
    }
  }
</script>

{#snippet info(label: string, value: string)}
  <div class="settings-row">
    <div><div class="settings-row-label">{label}</div></div>
    <div class="settings-row-control"><span style="font-size:13px;color:var(--text-color);">{value}</span></div>
  </div>
{/snippet}

<div class="settings-subsection-title">{t('email_settings.current_settings')}</div>
{@render info(t('email_settings.server'), current ? `${current.ServerName}:${current.ServerPort}` : '')}
{@render info(t('email_settings.from_email'), current?.FromEmail ?? '')}
{@render info(t('email_settings.encryption'), current?.Encryption ?? '')}
{@render info(t('email_settings.auth_required'), current ? (current.AuthRequired === 1 ? t('email_settings.yes') : t('email_settings.no')) : '')}
{@render info(t('email_settings.username'), current?.Username ?? '')}

<div class="settings-subsection-title">{t('email_settings.update_settings')}</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('email_settings.smtp_server')}</div></div>
  <div class="settings-row-control"><input type="text" placeholder="smtp.gmail.com" bind:value={server} class="input" aria-label={t('email_settings.smtp_server')} /></div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('email_settings.port')}</div></div>
  <div class="settings-row-control">
    <input type="text" inputmode="numeric" placeholder="587" bind:value={port} class="input" style="width:100px;" aria-label={t('email_settings.port')} />
  </div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('email_settings.from_email_address')}</div></div>
  <div class="settings-row-control">
    <input type="email" placeholder="noreply@yourdomain.com" bind:value={from} class="input" aria-label={t('email_settings.from_email_address')} />
  </div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('email_settings.encryption_method')}</div></div>
  <div class="settings-row-control">
    <select bind:value={encryption} class="select" aria-label={t('email_settings.encryption_method')}>
      <option value="none">{t('email_settings.none')}</option>
      <option value="SSL/TLS">SSL/TLS</option>
      <option value="StartTLS">StartTLS</option>
    </select>
  </div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('email_settings.require_authentication')}</div></div>
  <div class="settings-row-control">
    <label class="toggle">
      <input type="checkbox" bind:checked={auth} aria-label={t('email_settings.require_authentication')} />
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
  </div>
</div>
{#if auth}
  <div class="settings-row">
    <div><div class="settings-row-label">{t('email_settings.auth_username')}</div></div>
    <div class="settings-row-control">
      <input type="text" placeholder="your-email@domain.com" bind:value={user} class="input" autocomplete="off" aria-label={t('email_settings.auth_username')} />
    </div>
  </div>
  <div class="settings-row">
    <div><div class="settings-row-label">{t('email_settings.password')}</div></div>
    <div class="settings-row-control">
      <input type="password" placeholder="Your password or app password" bind:value={pass} class="input" autocomplete="off" aria-label={t('email_settings.password')} />
    </div>
  </div>
{/if}
<div class="settings-row">
  <div></div>
  <div class="settings-row-control">
    <button onclick={test} disabled={testing} class="btn btn-secondary" style="padding:6px 12px;">
      {#if testing}<i class="ph ph-spinner animate-spin"></i>{t('email_settings.testing')}{:else}<i class="ph ph-envelope"></i>{t('email_settings.send_test_email')}{/if}
    </button>
    {#if tested}
      <button onclick={save} disabled={saving} class="btn btn-primary" style="padding:6px 12px;">
        {#if saving}<i class="ph ph-spinner animate-spin"></i>{t('email_settings.saving')}{:else}<i class="ph ph-floppy-disk"></i>{t('email_settings.save_settings')}{/if}
      </button>
    {/if}
  </div>
</div>
<div class="settings-row">
  <div>
    <div class="settings-row-label">{t('email_settings.common_smtp_settings')}</div>
    <div class="settings-row-desc">{t('email_settings.gmail_hint')}</div>
    <div class="settings-row-desc">{t('email_settings.outlook_hint')}</div>
    <div class="settings-row-desc">{t('email_settings.yahoo_hint')}</div>
    <div class="settings-row-desc">{t('email_settings.gmail_app_password_note')}</div>
  </div>
</div>
