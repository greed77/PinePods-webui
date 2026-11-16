<script lang="ts">
  // Port of upstream setting_components/local_podcast.rs: add a podcast from a folder
  // of audio files on the server (browsable under /opt/pinepods/local-media), with
  // optional artwork. (Upstream's auto-refresh toggle needs a newer server than 0.9.2.)
  import { onDestroy } from 'svelte';
  import * as E from '$lib/api/endpoints';
  import type { LocalDirEntry } from '$lib/api/endpoints';
  import { session } from '$lib/stores/session.svelte';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let name = $state('');
  let dir = $state('');
  let author = $state('');
  let description = $state('');
  let explicit = $state(false);
  let artwork = $state<File | null>(null);
  let preview = $state<string | null>(null);
  let detectedCover = $state<string | null>(null);
  let busy = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  let browsing = $state(false);
  let browserPath = $state('');
  let entries = $state<LocalDirEntry[]>([]);
  let browserLoading = $state(false);

  onDestroy(() => preview && URL.revokeObjectURL(preview));

  function pickArtwork(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
    if (preview) URL.revokeObjectURL(preview);
    artwork = f;
    preview = f ? URL.createObjectURL(f) : null;
  }

  function clearArtwork() {
    if (preview) URL.revokeObjectURL(preview);
    artwork = null;
    preview = null;
    if (fileInput) fileInput.value = '';
  }

  async function detectCover(path: string) {
    if (!path.trim()) return (detectedCover = null);
    try {
      const rel = await E.detectLocalCover(path);
      detectedCover = rel ? `${session.serverName}${rel}` : null;
    } catch {
      detectedCover = null;
    }
  }

  async function navigate(path: string) {
    browserLoading = true;
    try {
      const listing = await E.listLocalDirectories(path);
      browserPath = listing.current_path;
      entries = listing.directories;
    } catch (e) {
      toast.error(`Failed to list directories: ${(e as Error).message}`);
    } finally {
      browserLoading = false;
    }
  }

  function openBrowser() {
    browsing = true;
    navigate('');
  }

  function selectFolder() {
    dir = browserPath;
    browsing = false;
    detectCover(dir);
  }

  const parent = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

  async function add() {
    if (!name.trim() || !dir.trim()) return toast.error('Podcast name and directory path are required.');
    busy = true;
    try {
      const podcast = await E.addLocalPodcast({
        directory_path: dir,
        podcast_name: name,
        description: description || null,
        author: author || null,
        explicit
      });
      if (artwork) await E.addLocalPodcastArtwork(podcast.podcastid, artwork).catch((e) => console.warn('Artwork upload failed', e));
      toast.info(t('local_podcast.podcast_added'));
      name = dir = author = description = '';
      explicit = false;
      detectedCover = null;
      clearArtwork();
    } catch (e) {
      toast.error(`${t('local_podcast.failed_to_add')}${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }

  const shown = $derived(preview ?? detectedCover);
</script>

<div class="settings-row">
  <div><div class="settings-row-label">{t('local_podcast.podcast_name_placeholder')}</div></div>
  <div class="settings-row-control">
    <input bind:value={name} class="input" placeholder={t('local_podcast.podcast_name_placeholder')} aria-label={t('local_podcast.podcast_name_placeholder')} />
  </div>
</div>
<div class="settings-row">
  <div>
    <div class="settings-row-label">{t('local_podcast.directory_path_placeholder')}</div>
    <div class="settings-row-desc">{t('local_podcast.directory_path_help')}</div>
  </div>
  <div class="settings-row-control" style="display:flex; gap:8px; align-items:center;">
    <input
      bind:value={dir}
      onblur={() => detectCover(dir)}
      class="input"
      placeholder={t('local_podcast.directory_path_placeholder')}
      aria-label={t('local_podcast.directory_path_placeholder')}
    />
    <button type="button" onclick={openBrowser} class="btn btn-secondary" style="padding:6px 12px; white-space:nowrap;">
      <i class="ph ph-folder-open"></i>{t('local_podcast.browse')}
    </button>
  </div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('local_podcast.author_placeholder')}</div></div>
  <div class="settings-row-control">
    <input bind:value={author} class="input" placeholder={t('local_podcast.author_placeholder')} aria-label={t('local_podcast.author_placeholder')} />
  </div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('local_podcast.description_placeholder')}</div></div>
  <div class="settings-row-control">
    <textarea bind:value={description} class="input" placeholder={t('local_podcast.description_placeholder')} aria-label={t('local_podcast.description_placeholder')} rows="3"></textarea>
  </div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('local_podcast.explicit_label')}</div></div>
  <div class="settings-row-control">
    <label class="toggle">
      <input type="checkbox" bind:checked={explicit} aria-label={t('local_podcast.explicit_label')} />
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
  </div>
</div>
<div class="settings-row">
  <div><div class="settings-row-label">{t('local_podcast.artwork_label')}</div></div>
  <div class="settings-row-control">
    <div class="image-picker">
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <label class="btn btn-secondary" for="local-podcast-artwork" style="padding:6px 12px; cursor:pointer;">
          <i class="ph ph-image"></i><span>Choose Image</span>
        </label>
        <input
          bind:this={fileInput}
          id="local-podcast-artwork"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          style="display:none;"
          onchange={pickArtwork}
        />
        {#if artwork}
          <span style="font-size:13px; color: var(--text-secondary-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;">{artwork.name}</span>
          <button type="button" class="btn btn-ghost" onclick={clearArtwork} style="padding:4px 8px;" aria-label="Remove image"><i class="ph ph-x"></i></button>
        {/if}
      </div>
      {#if shown}
        <div style="margin-top:10px;">
          <img src={shown} alt="preview" style="max-width:160px; max-height:160px; border-radius:8px; object-fit:cover; border:1px solid rgba(128,128,128,0.2);" />
          {#if !artwork}<div class="settings-row-desc" style="margin-top:4px;">Auto-detected from folder</div>{/if}
        </div>
      {/if}
      <div class="settings-row-desc" style="margin-top:6px;">Supported formats: JPG, PNG, GIF, WebP</div>
    </div>
  </div>
</div>
<div class="settings-row">
  <div></div>
  <div class="settings-row-control">
    <button onclick={add} class="btn btn-secondary" style="padding:6px 12px;" disabled={busy}><i class="ph ph-plus"></i>{t('local_podcast.add_button')}</button>
  </div>
</div>

{#if browsing}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="fixed top-0 right-0 left-0 z-50 flex justify-center items-center w-full h-full max-h-full bg-black bg-opacity-25"
    onclick={(e) => e.target === e.currentTarget && (browsing = false)}
  >
    <div class="modal-container relative p-4 w-full max-w-lg max-h-full rounded-lg shadow" role="dialog" aria-modal="true" aria-label={t('local_podcast.select_a_folder')}>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="font-weight:600; margin:0;">{t('local_podcast.select_a_folder')}</h3>
        <button type="button" class="btn btn-ghost" onclick={() => (browsing = false)} style="padding:4px 8px;" aria-label={t('local_podcast.cancel')}><i class="ph ph-x"></i></button>
      </div>
      <div class="settings-row-desc" style="margin-bottom:8px;">/opt/pinepods/local-media/{browserPath}</div>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <button type="button" class="btn btn-secondary" style="padding:4px 10px;" onclick={() => navigate(parent(browserPath))} disabled={!browserPath}>
          <i class="ph ph-arrow-up"></i>Up
        </button>
      </div>
      <div style="max-height:320px; overflow-y:auto; border:1px solid rgba(128,128,128,0.18); border-radius:8px;">
        {#if browserLoading}
          <div style="padding:16px; text-align:center;"><i class="ph ph-spinner animate-spin" style="font-size:20px;"></i></div>
        {:else if entries.length === 0}
          <div class="settings-row-desc" style="padding:16px; text-align:center;">{t('local_podcast.no_subfolders')}</div>
        {:else}
          {#each entries as entry (entry.path)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              onclick={() => navigate(entry.path)}
              style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; cursor:pointer; border-bottom:1px solid rgba(128,128,128,0.12);"
            >
              <span style="display:flex; align-items:center; gap:8px; min-width:0;">
                <i class="ph ph-folder" style="color:var(--text-secondary-color);"></i>
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{entry.name}</span>
              </span>
              <span class="settings-row-desc" style="white-space:nowrap; margin-left:12px;">{entry.audio_count} audio file{entry.audio_count === 1 ? '' : 's'}</span>
            </div>
          {/each}
        {/if}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
        <button type="button" class="btn btn-ghost" onclick={() => (browsing = false)} style="padding:6px 12px;">{t('local_podcast.cancel')}</button>
        <button type="button" class="btn btn-secondary" onclick={selectFolder} style="padding:6px 12px;" disabled={!browserPath}>
          <i class="ph ph-check"></i>{t('local_podcast.select_this_folder')}
        </button>
      </div>
    </div>
  </div>
{/if}
