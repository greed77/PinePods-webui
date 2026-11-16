<script lang="ts">
  // Port of upstream setting_components/theme_options.rs: theme cards (current first,
  // the rest shuffled once), plus the user's custom themes with delete.
  import * as E from '$lib/api/endpoints';
  import { THEMES, applyCustomTheme, type CustomTheme, type ThemeSwatch } from '$lib/theme/custom';
  import { changeTheme } from '$lib/theme/themes.js';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { refresh = 0 }: { refresh?: number } = $props();

  let selected = $state('');
  let loading = $state(true);
  let expanded = $state(false);
  let custom = $state<CustomTheme[]>([]);

  // Shuffled once so picking a theme doesn't reorder the list.
  const shuffled = (() => {
    const idx = THEMES.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  })();

  E.getTheme()
    .then((r) => (selected = r.theme))
    .catch((e) => console.warn('Error fetching theme', e))
    .finally(() => (loading = false));

  $effect(() => {
    refresh;
    E.getCustomThemes()
      .then((v) => (custom = v))
      .catch((e) => console.warn('Error fetching custom themes', e));
  });

  const ordered = $derived.by(() => {
    const ci = THEMES.findIndex((x) => x.name === selected);
    return ci >= 0 ? [ci, ...shuffled.filter((i) => i !== ci)] : shuffled;
  });

  function remember(name: string) {
    try {
      localStorage.setItem('selected_theme', name);
    } catch {
      /* ignore */
    }
    selected = name;
    E.setTheme(name).catch((e) => toast.error(`Failed to update theme: ${(e as Error).message}`));
  }

  function pick(name: string) {
    changeTheme(name);
    remember(name);
  }

  function pickCustom(ct: CustomTheme) {
    applyCustomTheme(ct);
    remember(ct.name);
  }

  function removeCustom(ct: CustomTheme) {
    custom = custom.filter((x) => x.themeid !== ct.themeid);
    if (selected === ct.name) pick('Nordic');
    E.deleteCustomTheme(ct.themeid).catch((e) => toast.error(`Failed to delete theme: ${(e as Error).message}`));
  }

  const shadow = (on: boolean, color: string) => (on ? `0 0 0 2px ${color}, 0 1px 4px rgba(0,0,0,.25)` : '0 1px 2px rgba(0,0,0,.2)');
  const cardStyle = (bg: string, on: boolean, color: string) =>
    `background-color:${bg};border-radius:10px;padding:12px;min-height:74px;position:relative;cursor:pointer;box-shadow:${shadow(on, color)};`;
</script>

{#snippet card(th: ThemeSwatch)}
  {@const on = th.name === selected}
  <div style={cardStyle(th.bg, on, th.swatch1)} class="theme-card-item" role="button" tabindex="0" onclick={() => pick(th.name)} onkeydown={(e) => e.key === 'Enter' && pick(th.name)}>
    {#if on}<i class="ph ph-check-circle" style="position:absolute;top:8px;right:8px;color:{th.swatch1};font-size:16px;"></i>{/if}
    <div style="color:{th.text};font-size:13px;font-weight:600;line-height:1.2;margin-bottom:6px;">{th.name}</div>
    <div style="display:flex;gap:4px;">
      <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background-color:{th.swatch1};"></span>
      <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background-color:{th.swatch2};opacity:0.6;"></span>
    </div>
  </div>
{/snippet}

<div class="p-6 space-y-4">
  {#if loading}
    <div class="flex justify-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div></div>
  {:else}
    <div class="theme-card-grid">
      {#each ordered.slice(0, 3) as i (i)}{@render card(THEMES[i])}{/each}
    </div>
    {#if ordered.length > 3}
      <button class="btn btn-secondary" style="width:100%; padding:6px 12px;" onclick={() => (expanded = !expanded)}>
        {#if expanded}<i class="ph ph-caret-up"></i>{t('theme_options.show_fewer')}{:else}<i class="ph ph-caret-down"></i> Show {ordered.length - 3} more{/if}
      </button>
    {/if}
    {#if expanded}
      <div class="theme-expanded-grid">
        {#each ordered.slice(3) as i (i)}{@render card(THEMES[i])}{/each}
      </div>
    {/if}
    {#if custom.length}
      <div class="custom-themes-divider"><span>{t('theme_options.my_themes')}</span></div>
      <div class="theme-card-grid">
        {#each custom as ct (ct.themeid)}
          {@const on = ct.name === selected}
          <div style={cardStyle(ct.background_color, on, ct.prog_bar_color)} class="theme-card-item" role="button" tabindex="0" onclick={() => pickCustom(ct)} onkeydown={(e) => e.key === 'Enter' && pickCustom(ct)}>
            <button
              class="custom-theme-delete-btn"
              title="Delete theme"
              onclick={(e) => {
                e.stopPropagation();
                removeCustom(ct);
              }}><i class="ph ph-trash"></i></button
            >
            {#if on}<i class="ph ph-check-circle" style="position:absolute;top:8px;right:8px;color:{ct.prog_bar_color};font-size:16px;"></i>{/if}
            <div style="color:{ct.text_color};font-size:13px;font-weight:600;line-height:1.2;margin-bottom:6px;padding-left:20px;">{ct.name}</div>
            <div style="display:flex;gap:4px;padding-left:20px;">
              <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background-color:{ct.prog_bar_color};"></span>
              <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background-color:{ct.standout_color};opacity:0.6;"></span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
