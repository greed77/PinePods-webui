<script lang="ts">
  // Port of upstream setting_components/user_self_settings.rs. Text fields only send
  // what was typed; language, timezone and formats are prefilled and saved each time.
  import * as E from '$lib/api/endpoints';
  import type { MyUserInfo } from '$lib/api/endpoints';
  import { prefs, toast } from '$lib/stores/app.svelte';
  import { session } from '$lib/stores/session.svelte';
  import { setLanguage, t } from '$lib/i18n/index.svelte';
  import { encodePassword, isValidEmail } from '$lib/util/password';

  let info = $state<MyUserInfo | null>(null);
  let languages = $state<{ code: string; name: string }[]>([]);

  let username = $state('');
  let fullname = $state('');
  let email = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let timezone = $state('');
  let dateFormat = $state('');
  let timeFormat = $state('');
  let language = $state('en');

  let usernameError = $state(false);
  let emailError = $state(false);
  let passwordError = $state(false);
  let matchError = $state(false);
  let success = $state('');

  const zones: string[] = (Intl as any).supportedValuesOf?.('timeZone') ?? ['UTC'];

  function load() {
    E.getMyUserInfo()
      .then((i) => {
        info = i;
        timezone = i.timezone;
        timeFormat = String(i.timeformat);
        dateFormat = i.dateformat;
        language = i.language;
      })
      .catch((e) => toast.error(`Failed to fetch user info: ${(e as Error).message}`));
  }
  load();
  E.availableLanguages()
    .then((r) => (languages = r.languages))
    .catch((e) => console.warn('Failed to fetch available languages', e));

  /** Runs one update; on success shows the message and refreshes the shown values. */
  async function run(what: string, call: () => Promise<unknown>, after?: () => void) {
    try {
      await call();
      success = t('settings.successfully_updated_user_values');
      after?.();
      load();
    } catch (e) {
      toast.error(`Failed to update ${what}: ${(e as Error).message}`);
    }
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    usernameError = emailError = passwordError = matchError = false;
    success = '';

    if (username && !username.trim()) return (usernameError = true);
    if (email && !isValidEmail(email)) return (emailError = true);
    if (newPassword || confirmPassword) {
      if (!newPassword || !confirmPassword || newPassword !== confirmPassword) return (matchError = true);
      if (newPassword.length < 6) return (passwordError = true);
    }

    const jobs: Promise<void>[] = [];
    if (username)
      jobs.push(
        run('username', () => E.setUsername(username), () => {
          session.updateUser({ Username: username });
          username = '';
        })
      );
    if (email) jobs.push(run('email', () => E.setEmail(email), () => (email = '')));
    if (fullname) jobs.push(run('full name', () => E.setFullname(fullname), () => (fullname = '')));
    if (newPassword) {
      const pw = newPassword;
      jobs.push(
        run('password', async () => E.setPassword(await encodePassword(pw)), () => {
          newPassword = confirmPassword = '';
        })
      );
    }
    if (timezone) jobs.push(run('timezone', () => E.updateTimezone(timezone), () => (prefs.timezone = timezone)));
    if (dateFormat) jobs.push(run('date format', () => E.updateDateFormat(dateFormat), () => (prefs.dateFormat = dateFormat)));
    const hour = Number(timeFormat);
    if (hour) jobs.push(run('time format', () => E.updateTimeFormat(hour), () => (prefs.hourPref = hour)));
    if (language) jobs.push(run('language', () => E.updateUserLanguage(language), () => setLanguage(language)));
    await Promise.all(jobs);
  }
</script>

<form onsubmit={submit}>
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{t('settings.username')}</div>
      {#if info}<div class="settings-row-desc">{info.username}</div>{/if}
    </div>
    <div class="settings-row-control">
      <input type="text" bind:value={username} class="input" placeholder={t('settings.enter_username')} aria-label={t('settings.username')} />
      {#if usernameError}<p class="error-text">{t('settings.username_min_length')}</p>{/if}
    </div>
  </div>

  <div class="settings-row">
    <div>
      <div class="settings-row-label">{t('settings.full_name')}</div>
      {#if info}<div class="settings-row-desc">{info.fullname}</div>{/if}
    </div>
    <div class="settings-row-control">
      <input type="text" bind:value={fullname} class="input" placeholder={t('settings.enter_full_name')} aria-label={t('settings.full_name')} />
    </div>
  </div>

  <div class="settings-row">
    <div>
      <div class="settings-row-label">{t('settings.email')}</div>
      {#if info}<div class="settings-row-desc">{info.email}</div>{/if}
    </div>
    <div class="settings-row-control">
      <input type="email" bind:value={email} class="input" placeholder={t('settings.enter_email')} aria-label={t('settings.email')} />
      {#if emailError}<p class="error-text">{t('settings.please_enter_valid_email')}</p>{/if}
    </div>
  </div>

  <div class="settings-subsection-title">{t('settings.change_password')}</div>

  <div class="settings-row">
    <div><div class="settings-row-label">{t('settings.new_password')}</div></div>
    <div class="settings-row-control">
      <input type="password" bind:value={newPassword} class="input" placeholder={t('settings.enter_new_password')} aria-label={t('settings.new_password')} autocomplete="new-password" />
      {#if passwordError}<p class="error-text">{t('settings.password_min_length')}</p>{/if}
    </div>
  </div>

  <div class="settings-row">
    <div><div class="settings-row-label">{t('settings.confirm_password')}</div></div>
    <div class="settings-row-control">
      <input type="password" bind:value={confirmPassword} class="input" placeholder={t('settings.confirm_new_password')} aria-label={t('settings.confirm_password')} autocomplete="new-password" />
      {#if matchError}<p class="error-text">{t('settings.passwords_do_not_match')}</p>{/if}
    </div>
  </div>

  <div class="settings-subsection-title">{t('settings.regional_settings')}</div>

  <div class="settings-row">
    <div><div class="settings-row-label">{t('settings.language')}</div></div>
    <div class="settings-row-control">
      <select class="select" bind:value={language} aria-label={t('settings.language')}>
        {#each languages as l (l.code)}<option value={l.code}>{l.name}</option>{/each}
      </select>
    </div>
  </div>

  <div class="settings-row">
    <div><div class="settings-row-label">{t('settings.timezone')}</div></div>
    <div class="settings-row-control">
      <select class="select" bind:value={timezone} aria-label={t('settings.timezone')}>
        <option value="">Select timezone...</option>
        {#if timezone && !zones.includes(timezone)}<option value={timezone}>{timezone}</option>{/if}
        {#each zones as z (z)}<option value={z}>{z}</option>{/each}
      </select>
    </div>
  </div>

  <div class="settings-row">
    <div><div class="settings-row-label">{t('settings.date_format')}</div></div>
    <div class="settings-row-control">
      <select class="select" bind:value={dateFormat} aria-label={t('settings.date_format')}>
        <option value="">Select date format...</option>
        <option value="MDY">MM-DD-YYYY</option>
        <option value="DMY">DD-MM-YYYY</option>
        <option value="YMD">YYYY-MM-DD</option>
        <option value="JUL">YY/DDD (Julian)</option>
        <option value="ISO">ISO 8601</option>
        <option value="USA">MM/DD/YYYY</option>
        <option value="EUR">DD.MM.YYYY</option>
        <option value="JIS">YYYY-MM-DD</option>
      </select>
    </div>
  </div>

  <div class="settings-row">
    <div><div class="settings-row-label">{t('settings.time_format')}</div></div>
    <div class="settings-row-control">
      <select class="select" bind:value={timeFormat} aria-label={t('settings.time_format')}>
        <option value="12">12 Hour</option>
        <option value="24">24 Hour</option>
      </select>
    </div>
  </div>

  <div class="settings-row">
    <div>{#if success}<div class="success-message">{success}</div>{/if}</div>
    <div class="settings-row-control">
      <button type="submit" class="btn btn-secondary" style="padding:6px 12px;">
        <i class="ph ph-floppy-disk"></i>
        {t('settings.save_changes')}
      </button>
    </div>
  </div>
</form>
