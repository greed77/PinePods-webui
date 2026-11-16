<script lang="ts">
  // One titled block on the settings page (upstream pages/settings.rs markup).
  import type { Snippet } from 'svelte';

  let { icon, title, info, id, children }: { icon: string; title: string; info?: string; id?: string; children: Snippet } = $props();
</script>

<div class="settings-section" id={id ? `settings-${id}` : undefined}>
  <div class="settings-section-head">
    <i class="ph {icon}"></i>
    <div>
      <div class="settings-section-title-row">
        <div class="settings-section-title">{title}</div>
        {#if info}<button class="info-btn" title={info}>?</button>{/if}
      </div>
    </div>
  </div>
  <div class="settings-section-body">{@render children()}</div>
</div>
