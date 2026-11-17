<script lang="ts">
  // The server's backup files, as both the backup and restore sections list them.
  import type { BackupFile } from '$lib/api/endpoints';

  let {
    files,
    selected = null,
    onpick,
    ondelete,
    deleteTitle = ''
  }: { files: BackupFile[]; selected?: string | null; onpick?: (f: BackupFile) => void; ondelete?: (f: BackupFile) => void; deleteTitle?: string } = $props();

  const size = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  const date = (s: number) => (s > 0 ? new Date(s * 1000).toLocaleString() : 'Unknown date');
</script>

<div style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto;padding:0 16px 8px;">
  {#each files as f (f.filename)}
    {@const on = selected === f.filename}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      onclick={() => onpick?.(f)}
      style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:6px;{onpick ? 'cursor:pointer;' : ''}border:1px solid {on
        ? 'var(--accent-color);background:rgba(128,128,128,0.08)'
        : 'rgba(128,128,128,0.2)'};"
    >
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <i class="ph ph-file-sql" style="color:{on ? 'var(--accent-color)' : 'var(--text-secondary-color)'};font-size:18px;"></i>
        <div style="min-width:0;">
          <div style="font-size:13px;color:var(--text-color);font-weight:500;overflow:hidden;text-overflow:ellipsis;">{f.filename}</div>
          <div style="font-size:11px;color:var(--text-secondary-color);">{size(f.size)} • {date(f.modified)}</div>
        </div>
      </div>
      {#if on}<i class="ph ph-check-circle" style="color:var(--accent-color);"></i>{/if}
      {#if ondelete}
        <button class="btn btn-danger" title={deleteTitle} aria-label={deleteTitle} style="flex-shrink:0;padding:4px 8px;" onclick={() => ondelete(f)}>
          <i class="ph ph-trash"></i>
        </button>
      {/if}
    </div>
  {/each}
</div>
