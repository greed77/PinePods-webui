<script lang="ts" module>
  export type Mode = 'export' | 'import';
</script>

<script lang="ts">
  // Ports of upstream export_settings.rs (OPML download) and import_options.rs (pick an
  // OPML file, choose feeds, import, then poll progress every 5 s).
  import { onDestroy } from 'svelte';
  import * as E from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { parseOpml } from '$lib/util/opml';

  let { mode }: { mode: Mode } = $props();

  async function exportNow() {
    try {
      E.downloadText(await E.exportOpml(), 'podcasts.opml', 'text/xml');
    } catch (e) {
      toast.error(`${t('export_settings.error_exporting_opml')}${(e as Error).message}`);
    }
  }

  let feeds = $state<{ title: string; xmlUrl: string; selected: boolean }[] | null>(null);
  let progress = $state<{ current: number; total: number; podcast: string } | null>(null);
  let poll: ReturnType<typeof setInterval> | undefined;
  onDestroy(() => clearInterval(poll));

  async function pickFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    feeds = parseOpml(await file.text()).map((f) => ({ ...f, selected: true }));
  }

  async function importNow() {
    if (!feeds) return;
    const urls = feeds.filter((f) => f.selected).map((f) => f.xmlUrl);
    if (!urls.length) return;
    progress = { current: 0, total: urls.length, podcast: '' };
    try {
      await E.importOpml(urls);
    } catch {
      progress = null;
      return toast.error(t('import_options.failed_to_import_opml'));
    }
    clearInterval(poll);
    poll = setInterval(async () => {
      try {
        const p = await E.getImportProgress();
        progress = { current: p.current, total: p.total, podcast: p.current_podcast };
        if (p.current >= p.total) {
          clearInterval(poll);
          progress = null;
          toast.info(t('import_options.opml_import_completed'));
        }
      } catch (err) {
        console.error('Failed to fetch import progress', err);
      }
    }, 5000);
  }
</script>

{#if mode === 'export'}
  <div class="settings-row">
    <div><div class="settings-row-label">{t('export_settings.export_options')}</div></div>
    <div class="settings-row-control">
      <button onclick={exportNow} class="btn btn-secondary" style="padding:6px 12px;">
        <i class="ph ph-download-simple"></i><span>{t('export_settings.download_export_opml')}</span>
      </button>
    </div>
  </div>
{:else}
  <div class="settings-row">
    <div><div class="settings-row-label">{t('import_options.import_tip')}</div></div>
    <div class="settings-row-control">
      <label class="btn btn-secondary" for="opml-file-input" style="padding:6px 12px; cursor:pointer;">
        <i class="ph ph-upload-simple"></i><span>{t('import_options.choose_file')}</span>
      </label>
      <input id="opml-file-input" style="display:none;" type="file" accept=".opml,.xml" onchange={pickFile} />
    </div>
  </div>
  {#if feeds}
    <div class="settings-row">
      <div><div class="settings-row-label">{t('import_options.import_verification_text')}</div></div>
      <div class="settings-row-control">
        <button class="btn btn-secondary" onclick={importNow} disabled={!!progress} style="padding:6px 12px;">
          <i class="ph ph-download-simple"></i><span>{t('import_options.add_them')}</span>
        </button>
      </div>
    </div>
    {#if progress}
      <div class="settings-row">
        <div>
          <div class="settings-row-label">{t('import_options.import_progress')}</div>
          <div class="settings-row-desc">{t('import_options.currently_importing')}{progress.podcast}</div>
        </div>
        <div class="settings-row-control">
          <span style="font-size:13px;color:var(--text-color);">{progress.current}/{progress.total}</span>
          <i class="ph ph-spinner animate-spin" style="font-size:18px;color:var(--text-color);"></i>
        </div>
      </div>
    {/if}
    <div style="padding: 0 20px;">
      {#each feeds as f, i (i)}
        <div class="podcast import-list" style="padding: 8px 0; border-bottom: 1px solid rgba(128,128,128,0.12); min-width: 0;">
          <label class="toggle" style="cursor:pointer; width:100%; min-width:0; justify-content:flex-start; gap:12px;">
            <input type="checkbox" bind:checked={f.selected} />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <div style="min-width:0; overflow:hidden;">
              <span style="font-size:13px;font-weight:500;color:var(--text-color);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{f.title}</span>
              <div style="font-size:11px;color:var(--text-secondary-color);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{f.xmlUrl}</div>
            </div>
          </label>
        </div>
      {/each}
    </div>
  {/if}
{/if}
