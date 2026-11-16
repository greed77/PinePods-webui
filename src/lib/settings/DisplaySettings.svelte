<script lang="ts">
  // Port of upstream setting_components/start_page_options.rs: start page, always use
  // podcast covers, and Gravatar avatar. (Upstream's collection "add mode" picks between
  // the picker modal and a context-menu submenu; only the modal is ported, so the
  // setting is left out for now.)
  import * as E from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  const PAGES: [string, string][] = [
    ['Home', 'home'],
    ['Feed', 'feed'],
    ['Search', 'search'],
    ['Queue', 'queue'],
    ['Saved', 'saved'],
    ['Downloads', 'downloads'],
    ['People Subscriptions', 'people_subs'],
    ['Podcasts', 'podcasts']
  ];

  let startPage = $state('');
  let loading = $state(true);
  let covers = $state(false);
  let coversLoading = $state(true);

  E.getStartPage()
    .then((r) => (startPage = r.StartPage))
    .catch((e) => console.warn('Error fetching start page', e))
    .finally(() => (loading = false));
  E.getPodcastCoverPreference()
    .then((v) => (covers = v))
    .catch(() => (covers = false))
    .finally(() => (coversLoading = false));

  async function applyStartPage() {
    if (!startPage) return;
    try {
      localStorage.setItem('selected_startpage', startPage);
    } catch {
      /* ignore */
    }
    try {
      await E.setStartPage(startPage);
      toast.info(t('start_page_options.start_page_updated_successfully'));
    } catch (e) {
      toast.error(`${t('start_page_options.failed_to_update_start_page')}${(e as Error).message}`);
    }
  }

  async function setCovers(e: Event) {
    const on = (e.currentTarget as HTMLInputElement).checked;
    covers = on;
    try {
      await E.setGlobalPodcastCoverPreference(on);
      toast.info('Podcast cover preference updated successfully');
    } catch (err) {
      covers = !on;
      toast.error(`Failed to update podcast cover preference: ${(err as Error).message}`);
    }
  }

  async function setGravatar(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const on = input.checked;
    try {
      await E.setUseGravatar(on);
      session.updateUser({ UseGravatar: on });
    } catch (err) {
      input.checked = !on;
      toast.error(`Failed to update Gravatar setting: ${(err as Error).message}`);
    }
  }
</script>

<div class="settings-row">
  <div><div class="settings-row-label">{t('start_page_options.select_start_page')}</div></div>
  <div class="settings-row-control">
    {#if loading}
      <i class="ph ph-spinner"></i>
    {:else}
      <select bind:value={startPage} class="select" aria-label={t('start_page_options.select_start_page')}>
        <option value="" disabled>{t('start_page_options.select_start_page')}</option>
        {#each PAGES as [name, route] (route)}<option value={route}>{name}</option>{/each}
      </select>
      <button onclick={applyStartPage} class="btn btn-secondary" style="padding:6px 12px;">{t('start_page_options.apply_start_page')}</button>
    {/if}
  </div>
</div>

<div class="settings-subsection-title">{t('start_page_options.podcast_cover_display')}</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('start_page_options.always_use_podcast_covers')}</div></div>
  <div class="settings-row-control">
    {#if coversLoading}
      <i class="ph ph-spinner"></i>
    {:else}
      <label class="toggle">
        <input type="checkbox" checked={covers} onchange={setCovers} aria-label={t('start_page_options.always_use_podcast_covers')} />
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
      </label>
    {/if}
  </div>
</div>

<div class="settings-subsection-title">{t('start_page_options.avatar')}</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('start_page_options.use_gravatar')}</div></div>
  <div class="settings-row-control">
    <label class="toggle">
      <input type="checkbox" checked={!!session.user?.UseGravatar} onchange={setGravatar} aria-label={t('start_page_options.use_gravatar')} />
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
  </div>
</div>
