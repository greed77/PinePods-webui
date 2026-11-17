<script lang="ts">
  // Port of upstream setting_components/user_settings.rs: the user table, a create-user
  // form, and an edit form (name, username, email, password, admin, delete). Only
  // fields that changed are sent; a blank password leaves it as is. The
  // background_tasks user (id 1) can't be edited, and the last admin keeps admin.
  import * as E from '$lib/api/endpoints';
  import type { ServerUser } from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { encodePassword, isValidEmail } from '$lib/util/password';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';

  let users = $state<ServerUser[]>([]);
  let mode = $state<'create' | 'edit' | null>(null);
  let editing = $state<ServerUser | null>(null);
  let confirmDelete = $state(false);
  let error = $state('');

  let username = $state('');
  let fullname = $state('');
  let email = $state('');
  let password = $state('');
  let admin = $state(false);
  let usernameError = $state(false);
  let emailError = $state(false);
  let passwordError = $state(false);
  let busy = $state(false);

  const isAdmin = (u: ServerUser) => u.isadmin === true || u.isadmin === 1;

  function load() {
    E.getUsers().then((u) => (users = u), (e) => console.warn('Error getting user info', e));
  }
  load();

  function clearErrors() {
    usernameError = emailError = passwordError = false;
  }

  function openCreate() {
    clearErrors();
    username = fullname = email = password = '';
    admin = false;
    editing = null;
    mode = 'create';
  }

  function openEdit(u: ServerUser) {
    if (u.userid === 1) return toast.error('You cannot edit the background_tasks user.');
    clearErrors();
    editing = u;
    username = u.username;
    fullname = u.fullname;
    email = u.email;
    password = '';
    admin = isAdmin(u);
    mode = 'edit';
  }

  async function create(e: SubmitEvent) {
    e.preventDefault();
    usernameError = !username.trim();
    passwordError = password.length < 6;
    emailError = !isValidEmail(email);
    if (usernameError || passwordError || emailError) return;
    busy = true;
    try {
      await E.addUser({ fullname, username, email, hash_pw: await encodePassword(password) });
      mode = null;
      error = '';
      load();
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  async function saveEdit(e: SubmitEvent) {
    e.preventDefault();
    const u = editing;
    if (!u) return;
    clearErrors();
    if (username !== u.username && !username.trim()) return (usernameError = true);
    if (email !== u.email && !isValidEmail(email)) return (emailError = true);
    if (password && password.length < 6) return (passwordError = true);

    busy = true;
    const failures: string[] = [];
    const step = async (what: string, call: () => Promise<unknown>) => {
      try {
        await call();
      } catch (err) {
        failures.push(`Error updating ${what}: ${(err as Error).message}`);
      }
    };
    if (fullname && fullname !== u.fullname) await step('name', () => E.setFullname(fullname, u.userid));
    if (username !== u.username) await step('username', () => E.setUsername(username, u.userid));
    if (email !== u.email) await step('email', () => E.setEmail(email, u.userid));
    if (password) await step('password', async () => E.setPassword(await encodePassword(password), u.userid));
    if (admin !== isAdmin(u)) {
      if (!admin && (await E.isFinalAdmin(u.userid).catch(() => false))) failures.push('Unable to remove admin status from final administrator');
      else await step('admin status', () => E.setIsAdmin(u.userid, admin));
    }
    // Keep the drawer and account section in step when editing yourself.
    if (u.userid === session.userId && username !== u.username && !failures.some((f) => f.includes('username'))) session.updateUser({ Username: username });
    busy = false;
    error = failures.join(' · ');
    if (!failures.length) mode = null;
    load();
  }

  async function remove() {
    const u = editing;
    confirmDelete = false;
    if (!u) return;
    try {
      await E.deleteUser(u.userid);
      toast.info('User deleted successfully');
      mode = null;
      load();
    } catch (err) {
      toast.error(`Failed to delete user: ${(err as Error).message}`);
    }
  }
</script>

{#snippet field(id: string, label: string, type: string, placeholder: string, value: string, set: (v: string) => void, err = '')}
  <div>
    <label for={id} style="display:block;font-size:13px;font-weight:500;color:var(--text-color);margin-bottom:6px;">{label}</label>
    <input {id} {type} {placeholder} {value} class="input" autocomplete="off" oninput={(e) => set(e.currentTarget.value)} />
    {#if err}<p style="color:var(--error-color,#f87171);font-size:11px;">{err}</p>{/if}
  </div>
{/snippet}

{#if mode}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-full max-h-full bg-black bg-opacity-25"
    onclick={(e) => e.target === e.currentTarget && (mode = null)}
  >
    <div
      class="modal-container relative w-full max-w-md rounded-lg shadow"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? t('settings.create_new_user') : t('settings.edit_existing_user')}
    >
      <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
        <h3 style="font-size:16px;font-weight:600;color:var(--text-color);">{mode === 'create' ? t('settings.create_new_user') : t('settings.edit_existing_user')}</h3>
        <button onclick={() => (mode = null)} class="iconbtn" aria-label={t('common.cancel')}><i class="ph ph-x" style="font-size:18px;"></i></button>
      </div>
      {#if mode === 'edit'}
        <p style="font-size:12px;color:var(--text-secondary-color);padding:10px 16px 0;">{t('settings.change_user_fields_instructions')}</p>
      {/if}
      <div class="p-4 md:p-5">
        <form class="space-y-4" onsubmit={mode === 'create' ? create : saveEdit}>
          {@render field('um-username', t('settings.username'), 'text', 'pinepods_user1', username, (v) => (username = v), usernameError ? t('settings.username_min_length') : '')}
          {@render field('um-fullname', t('settings.full_name'), 'text', 'Pinepods User', fullname, (v) => (fullname = v))}
          {@render field('um-email', t('settings.email'), 'email', 'user@pinepods.online', email, (v) => (email = v), emailError ? t('settings.invalid_email_address') : '')}
          {@render field(
            'um-password',
            t('settings.password'),
            'password',
            mode === 'edit' ? 'Leave blank to keep the current password' : 'my_S3creT_P@$$',
            password,
            (v) => (password = v),
            passwordError ? t('settings.password_min_length') : ''
          )}
          {#if mode === 'edit'}
            <div style="display:flex;align-items:center;gap:8px;">
              <label class="toggle" style="gap:8px;flex:1;">
                <input bind:checked={admin} type="checkbox" />
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
                <span style="font-size:13px;color:var(--text-color);">{t('settings.admin_user_question')}</span>
              </label>
              <button type="button" onclick={() => (confirmDelete = true)} class="btn btn-danger" style="padding:6px 10px;font-size:12px;">
                <i class="ph ph-trash"></i>{t('settings.delete_user')}
              </button>
            </div>
          {/if}
          <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:4px;">
            <button type="button" onclick={() => (mode = null)} class="btn btn-secondary">{t('common.cancel')}</button>
            <button type="submit" class="btn btn-primary" disabled={busy}>
              <i class="ph {mode === 'create' ? 'ph-user-plus' : 'ph-floppy-disk'}"></i>{t('settings.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

{#if confirmDelete && editing}
  <ConfirmModal
    title={t('settings.delete_user')}
    text={`Delete ${editing.username}? Their podcasts, history and settings are removed too.`}
    yes={t('settings.delete_user')}
    no={t('common.cancel')}
    onyes={remove}
    onclose={() => (confirmDelete = false)}
  />
{/if}

<div class="settings-row">
  <div><div class="settings-row-label">{t('settings.create_new_user')}</div></div>
  <div class="settings-row-control">
    <button onclick={openCreate} class="btn btn-secondary" style="padding:6px 12px;"><i class="ph ph-plus"></i><span>{t('settings.create_new_user')}</span></button>
  </div>
</div>
<div class="relative overflow-x-auto">
  {#if error}<p style="color:var(--error-color,#f87171);font-size:11px;">{error}</p>{/if}
  <table class="w-full text-sm text-left rtl:text-right">
    <thead class="text-xs uppercase table-header">
      <tr>
        <th scope="col" class="px-6 py-3">{t('settings.user_id')}</th>
        <th scope="col" class="px-6 py-3">{t('settings.fullname')}</th>
        <th scope="col" class="px-6 py-3">{t('settings.email')}</th>
        <th scope="col" class="px-6 py-3">{t('settings.username')}</th>
        <th scope="col" class="px-6 py-3">{t('settings.admin_status')}</th>
      </tr>
    </thead>
    <tbody>
      {#each users as u (u.userid)}
        <tr class="table-row border-b cursor-pointer" onclick={() => openEdit(u)}>
          <td class="px-6 py-4">{u.userid}</td>
          <td class="px-6 py-4">{u.fullname}</td>
          <td class="px-6 py-4">{u.email}</td>
          <td class="px-6 py-4">{u.username}</td>
          <td class="px-6 py-4">{isAdmin(u) ? t('settings.yes') : t('settings.no')}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
