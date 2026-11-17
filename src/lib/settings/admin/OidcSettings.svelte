<script lang="ts">
  // Port of upstream setting_components/oidc.rs: the redirect URL to give the identity
  // provider, the configured providers, and an add/edit form (with discovery from the
  // issuer URL, scope picker, login-button look, and claim/role mapping).
  import * as E from '$lib/api/endpoints';
  import type { OidcProvider } from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import { detectProvider, scopeString } from './oidc';

  const SCOPES: { value: string; name: string; description: string; github?: boolean }[] = [
    { value: 'openid', name: 'OpenID', description: 'Provides verifiable identity' },
    { value: 'email', name: 'Email', description: 'Access to email address' },
    { value: 'profile', name: 'Profile', description: 'Basic profile info like name' },
    { value: 'read:user', name: 'Read User', description: 'Read user profile data', github: true },
    { value: 'user:email', name: 'User Email', description: 'Access to email address(es)', github: true }
  ];

  let providers = $state<OidcProvider[]>([]);
  let mode = $state<'add' | number | null>(null);
  let removing = $state<OidcProvider | null>(null);

  const empty = () => ({
    provider_name: '',
    client_id: '',
    client_secret: '',
    authorization_url: '',
    token_url: '',
    user_info_url: '',
    button_text: '',
    button_color: '#000000',
    button_text_color: '#000000',
    icon_svg: '',
    name_claim: '',
    email_claim: '',
    username_claim: '',
    roles_claim: '',
    user_role: '',
    admin_role: ''
  });
  let form = $state(empty());
  let scopes = $state<string[]>([]);
  let discoveryUrl = $state('');
  let discovering = $state(false);
  let scopesOpen = $state(false);
  let scopeBox: HTMLDivElement | undefined = $state();

  function load() {
    E.listOidcProviders().then((p) => (providers = p), (e) => toast.error(`${t('oidc.failed_to_fetch_oidc_providers')}${(e as Error).message}`));
  }
  load();

  const redirectUrl = $derived(`${session.serverName}/api/auth/callback`);
  const kind = $derived(detectProvider(form.authorization_url, form.token_url, form.user_info_url));
  const available = $derived(SCOPES.filter((s) => !s.github || kind === 'github'));

  function openAdd() {
    form = empty();
    scopes = [];
    discoveryUrl = '';
    mode = 'add';
  }

  function openEdit(p: OidcProvider) {
    form = {
      provider_name: p.provider_name,
      client_id: p.client_id,
      // Never shown; left empty keeps the current secret.
      client_secret: '',
      authorization_url: p.authorization_url,
      token_url: p.token_url,
      user_info_url: p.user_info_url,
      button_text: p.button_text,
      button_color: p.button_color,
      button_text_color: p.button_text_color,
      icon_svg: p.icon_svg ?? '',
      name_claim: p.name_claim ?? '',
      email_claim: p.email_claim ?? '',
      username_claim: p.username_claim ?? '',
      roles_claim: p.roles_claim ?? '',
      user_role: p.user_role ?? '',
      admin_role: p.admin_role ?? ''
    };
    scopes = p.scope.split(/[\s,]+/).filter(Boolean);
    discoveryUrl = '';
    mode = p.provider_id;
  }

  async function discover() {
    const url = discoveryUrl.trim();
    if (!url || discovering) return;
    discovering = true;
    try {
      const doc = await E.discoverOidc(url);
      form.authorization_url = doc.authorization_endpoint;
      form.token_url = doc.token_endpoint;
      form.user_info_url = doc.userinfo_endpoint;
      toast.info(t('oidc.discovery_succeeded'));
    } catch (e) {
      toast.error(`${t('oidc.discovery_failed')}${(e as Error).message}`);
    } finally {
      discovering = false;
    }
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const body = { ...form, scope: scopeString(scopes, kind) };
    try {
      if (mode === 'add') {
        await E.addOidcProvider(body);
        toast.info(t('oidc.oidc_provider_successfully_added'));
      } else if (typeof mode === 'number') {
        await E.updateOidcProvider(mode, body);
        toast.info(t('oidc.oidc_provider_successfully_updated'));
      }
      mode = null;
      load();
    } catch (err) {
      toast.error(`${mode === 'add' ? t('oidc.failed_to_add_provider') : t('oidc.failed_to_update_provider')}${(err as Error).message}`);
    }
  }

  async function remove(p: OidcProvider) {
    removing = null;
    try {
      await E.removeOidcProvider(p.provider_id);
      toast.info(t('oidc.provider_successfully_removed'));
      load();
    } catch (e) {
      toast.error(`${t('oidc.failed_to_remove_provider')}${(e as Error).message}`);
    }
  }

  const toggleScope = (v: string) => (scopes = scopes.includes(v) ? scopes.filter((s) => s !== v) : [...scopes, v]);
  const scopeSummary = $derived(
    scopes.length
      ? available
          .filter((s) => scopes.includes(s.value))
          .map((s) => s.name)
          .concat(scopes.filter((v) => !SCOPES.some((s) => s.value === v)))
          .join(', ')
      : kind === 'github'
        ? 'GitHub: read:user,user:email'
        : 'OpenID Connect: openid email profile'
  );
  const copy = (text: string) => navigator.clipboard?.writeText(text);
</script>

<svelte:document onclick={(e) => scopeBox && !scopeBox.contains(e.target as Node) && (scopesOpen = false)} />

{#snippet field(label: string, key: keyof typeof form, type = 'text', placeholder = '', required = false, wide = false)}
  <div style="display:flex;flex-direction:column;gap:4px;{wide ? 'grid-column:span 2;' : ''}">
    <label for="oidc-{key}" style="font-size:12px;font-weight:500;color:var(--text-color);">
      {label}
      {#if key === 'client_secret' && mode !== 'add'}<span style="font-size:11px;opacity:0.7;"> (leave empty to keep current)</span>{/if}
    </label>
    <input
      id="oidc-{key}"
      {type}
      class="input"
      style={type === 'color' ? 'height:38px;padding:4px 8px;' : ''}
      bind:value={form[key]}
      {placeholder}
      {required}
      autocomplete="off"
    />
  </div>
{/snippet}

{#snippet redirect(compact: boolean)}
  <div style="display:flex;align-items:center;gap:8px;{compact ? 'width:100%;min-width:0;' : 'padding:6px 8px;background:rgba(0,0,0,0.15);border-radius:4px;'}">
    <div style="flex:1;min-width:0;overflow-x:auto;{compact ? 'background: rgba(128,128,128,0.1); border-radius: 4px; padding: 4px 8px;' : ''}">
      <code style="font-size:12px;color:var(--text-color);{compact ? 'white-space:nowrap;display:block;' : 'word-break:break-all;'}">{redirectUrl}</code>
    </div>
    <button type="button" onclick={() => copy(redirectUrl)} class="btn btn-ghost" style="flex-shrink:0;padding:6px 8px;" title="Copy to clipboard" aria-label="Copy to clipboard">
      <i class="ph ph-copy"></i>
    </button>
  </div>
{/snippet}

<div class="settings-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
  <div>
    <div class="settings-row-label">{t('oidc.oidc_redirect_url')}</div>
    <div class="settings-row-desc">{t('oidc.use_this_url_when_configuring')}</div>
  </div>
  {@render redirect(true)}
</div>
<div class="settings-row">
  <div></div>
  <div class="settings-row-control">
    <button onclick={openAdd} class="btn btn-secondary" style="padding:6px 12px;"><i class="ph ph-plus"></i><span>{t('oidc.add_provider')}</span></button>
  </div>
</div>

{#if providers.length === 0}
  <div class="settings-row"><div><div class="settings-row-desc">{t('oidc.no_oidc_providers_configured')}</div></div></div>
{:else}
  <div style="display:flex;flex-direction:column;gap:8px;">
    {#each providers as p (p.provider_id)}
      <div class="modal-container" style="border-radius:8px;padding:12px 16px;border:1px solid rgba(128,128,128,0.2);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-size:14px;font-weight:600;color:var(--text-color);">{p.provider_name}</span>
              {#if p.initialized_from_env}
                <span style="font-size:11px;padding:2px 6px;border-radius:10px;background:rgba(99,102,241,0.15);color:var(--accent-color);border:1px solid rgba(99,102,241,0.3);">{t('oidc.environment')}</span>
              {/if}
            </div>
            <div style="font-size:11px;color:var(--text-secondary-color);margin-bottom:8px;">{p.client_id}</div>
            <div style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--text-secondary-color);overflow-wrap:anywhere;">
              <div><span style="font-weight:500;">{t('oidc.authorization_url')}: </span>{p.authorization_url}</div>
              <div><span style="font-weight:500;">{t('oidc.token_url')}: </span>{p.token_url}</div>
              <div><span style="font-weight:500;">{t('oidc.user_info_url')}: </span>{p.user_info_url}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button onclick={() => openEdit(p)} class="btn btn-secondary" style="padding:4px 10px;font-size:12px;"><i class="ph ph-pencil"></i>{t('common.edit')}</button>
            <button
              onclick={() => (removing = p)}
              class="btn btn-danger"
              style="padding:4px 10px;font-size:12px;{p.initialized_from_env ? 'opacity:0.4;cursor:not-allowed;' : ''}"
              disabled={p.initialized_from_env}
              title={p.initialized_from_env ? 'Cannot remove environment-initialized providers' : undefined}><i class="ph ph-trash"></i>{t('common.remove')}</button
            >
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

{#if removing}
  {@const p = removing}
  <ConfirmModal
    title={t('common.remove')}
    text={`Remove ${p.provider_name}? Its login button disappears from the login page.`}
    yes={t('common.remove')}
    no={t('common.cancel')}
    onyes={() => remove(p)}
    onclose={() => (removing = null)}
  />
{/if}

{#if mode !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-full max-h-full bg-black bg-opacity-25"
    onclick={(e) => e.target === e.currentTarget && (mode = null)}
  >
    <div
      class="modal-container relative w-full max-w-2xl rounded-lg shadow"
      style="max-height:90vh;display:flex;flex-direction:column;"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'add' ? t('oidc.add_oidc_provider') : t('oidc.edit_oidc_provider')}
    >
      <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t" style="flex-shrink:0;">
        <h3 style="font-size:16px;font-weight:600;color:var(--text-color);">{mode === 'add' ? t('oidc.add_oidc_provider') : t('oidc.edit_oidc_provider')}</h3>
        <button onclick={() => (mode = null)} class="iconbtn" aria-label={t('common.cancel')}><i class="ph ph-x" style="font-size:18px;"></i></button>
      </div>
      <div class="p-4 md:p-5" style="overflow-y:auto;flex:1;">
        <div style="padding:12px;border-radius:8px;background:rgba(128,128,128,0.08);border:1px solid rgba(128,128,128,0.2);margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <i class="ph ph-info" style="color:var(--accent-color);"></i>
            <span style="font-size:13px;font-weight:500;color:var(--text-color);">{t('oidc.oidc_redirect_url')}</span>
          </div>
          {@render redirect(false)}
          <p style="font-size:11px;color:var(--text-secondary-color);margin-top:6px;">{t('oidc.use_this_url_when_configuring')}</p>
        </div>
        <form class="space-y-4" onsubmit={submit}>
          <div class="grid grid-cols-2 gap-4">
            {@render field(t('oidc.provider_name'), 'provider_name', 'text', 'Google', true)}
            {@render field(t('oidc.client_id'), 'client_id', 'text', '', true)}
            {@render field(t('oidc.client_secret'), 'client_secret', 'password', '', mode === 'add')}
            <div style="display:flex;flex-direction:column;gap:4px;grid-column:span 2;">
              <label for="oidc-discovery" style="font-size:12px;font-weight:500;color:var(--text-color);">{t('oidc.discovery_url')}</label>
              <div style="display:flex;gap:8px;">
                <input id="oidc-discovery" type="url" class="input" style="flex:1;" bind:value={discoveryUrl} placeholder="https://auth.example.com/application/o/pinepods/" />
                <button type="button" class="btn btn-secondary" onclick={discover} disabled={discovering || !discoveryUrl.trim()}>
                  <i class="ph {discovering ? 'ph-spinner animate-spin' : 'ph-magnifying-glass'}"></i><span>{t('oidc.discover')}</span>
                </button>
              </div>
              <p style="font-size:11px;color:var(--text-secondary-color);">{t('oidc.discovery_hint')}</p>
            </div>
            {@render field(t('oidc.authorization_url'), 'authorization_url', 'url', 'https://provider.com/oauth2/auth', true)}
            {@render field(t('oidc.token_url'), 'token_url', 'url', 'https://provider.com/oauth2/token', true)}
            {@render field(t('oidc.user_info_url'), 'user_info_url', 'url', 'https://provider.com/oauth2/userinfo', true)}

            <div style="display:flex;flex-direction:column;gap:4px;grid-column:span 2;">
              <span style="font-size:12px;font-weight:500;color:var(--text-color);">{t('oidc.scopes')}</span>
              <div class="relative" bind:this={scopeBox}>
                <button type="button" onclick={() => (scopesOpen = !scopesOpen)} class="input" style="display:flex;align-items:center;text-align:left;cursor:pointer;width:100%;" aria-expanded={scopesOpen}>
                  <span class="flex-grow text-left">{scopeSummary}</span>
                  <i class="ph ph-caret-down transition-transform duration-200 {scopesOpen ? 'rotate-180' : ''}"></i>
                </button>
                {#if scopesOpen}
                  <div class="absolute z-50 mt-1 w-full rounded-lg shadow-lg modal-container">
                    <div class="max-h-[400px] overflow-y-auto p-2 space-y-1">
                      {#if kind === 'github'}
                        <div style="padding:8px;border-radius:6px;background:rgba(128,128,128,0.1);margin-bottom:8px;">
                          <div style="display:flex;align-items:center;gap:6px;">
                            <i class="ph ph-info" style="color:var(--accent-color);"></i>
                            <span style="font-size:12px;font-weight:500;color:var(--text-color);">{t('oidc.github_provider_detected')}</span>
                          </div>
                          <p style="font-size:11px;color:var(--text-secondary-color);margin-top:4px;">{t('oidc.github_no_standard_scopes')}</p>
                        </div>
                      {/if}
                      {#each [[t('oidc.standard_oidc_scopes'), available.filter((s) => !s.github)], [t('oidc.github_scopes'), available.filter((s) => s.github)]] as [title, group] (title)}
                        {#if (group as typeof SCOPES).length}
                          <div style="margin-bottom:8px;">
                            <div style="font-size:11px;font-weight:500;color:var(--text-secondary-color);margin-bottom:4px;padding:0 8px;">{title}</div>
                            {#each group as typeof SCOPES as s (s.value)}
                              {@const on = scopes.includes(s.value)}
                              <label style="display:flex;align-items:flex-start;padding:8px;border-radius:6px;cursor:pointer;{on ? 'background:rgba(128,128,128,0.15);' : ''}">
                                <input type="checkbox" style="width:14px;height:14px;margin-top:2px;accent-color:var(--accent-color);" checked={on} onchange={() => toggleScope(s.value)} />
                                <div style="margin-left:10px;flex:1;">
                                  <div style="font-size:13px;font-weight:500;color:var(--text-color);">{s.name}</div>
                                  <div style="font-size:11px;color:var(--text-secondary-color);margin-top:2px;">{s.description}</div>
                                  <code style="font-size:10px;color:var(--text-secondary-color);opacity:0.7;display:block;margin-top:2px;">{s.value}</code>
                                </div>
                                {#if on}<i class="ph ph-check" style="font-size:18px;color:var(--accent-color);flex-shrink:0;"></i>{/if}
                              </label>
                            {/each}
                          </div>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            {@render field(t('oidc.button_text'), 'button_text', 'text', 'Login with Provider', true)}
            {@render field(t('oidc.button_color'), 'button_color', 'color')}
            {@render field(t('oidc.button_text_color'), 'button_text_color', 'color')}
            <div style="display:flex;flex-direction:column;gap:4px;grid-column:span 2;">
              <label for="oidc-icon" style="font-size:12px;font-weight:500;color:var(--text-color);">{t('oidc.icon_svg_optional')}</label>
              <textarea id="oidc-icon" class="input" style="min-height:80px;" bind:value={form.icon_svg} placeholder="<svg>...</svg>"></textarea>
            </div>
            {@render field(t('oidc.name_claim'), 'name_claim')}
            {@render field(t('oidc.email_claim'), 'email_claim')}
            {@render field(t('oidc.username_claim'), 'username_claim')}
            {@render field(t('oidc.roles_claim'), 'roles_claim')}
            {@render field(t('oidc.user_role'), 'user_role')}
            {@render field(t('oidc.admin_role'), 'admin_role')}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:4px;">
            <button type="button" onclick={() => (mode = null)} class="btn btn-secondary">{t('common.cancel')}</button>
            <button type="submit" class="btn btn-primary">{mode === 'add' ? t('common.add') : t('common.update')}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}
