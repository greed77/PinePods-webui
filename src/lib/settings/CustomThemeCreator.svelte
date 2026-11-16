<script lang="ts">
  // Port of upstream setting_components/custom_theme_creator.rs: name + 19 color
  // pickers (Nordic defaults) with a live preview card.
  import * as E from '$lib/api/endpoints';
  import type { ThemeColor, ThemeColors } from '$lib/theme/custom';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { oncreated }: { oncreated: () => void } = $props();

  const FIELDS: [ThemeColor, string][] = [
    ['background_color', 'Background'],
    ['secondary_background', 'Secondary Background'],
    ['container_background', 'Container Background'],
    ['button_color', 'Button'],
    ['container_button_color', 'Container Button'],
    ['button_text_color', 'Button Text'],
    ['text_color', 'Text'],
    ['text_secondary_color', 'Secondary Text'],
    ['border_color', 'Border'],
    ['accent_color', 'Accent'],
    ['prog_bar_color', 'Progress Bar'],
    ['standout_color', 'Standout'],
    ['hover_color', 'Hover'],
    ['link_color', 'Link'],
    ['thumb_color', 'Thumb / Scrollbar'],
    ['unfilled_color', 'Unfilled'],
    ['check_box_color', 'Checkbox'],
    ['bonus_color', 'Bonus'],
    ['error_color', 'Error']
  ];

  // Nordic
  const DEFAULTS: ThemeColors = {
    background_color: '#3C4252',
    secondary_background: '#2e3440',
    container_background: '#2b2f3a',
    button_color: '#3e4555',
    container_button_color: '#3C4252',
    button_text_color: '#f6f5f4',
    text_color: '#f6f5f4',
    text_secondary_color: '#f6f5f4',
    border_color: '#000000',
    accent_color: '#6d747f',
    prog_bar_color: '#3550af',
    standout_color: '#6e8e92',
    hover_color: '#5d80aa',
    link_color: '#5d80aa',
    thumb_color: '#3550af',
    unfilled_color: '#d4d6d7',
    check_box_color: '#ffffff',
    bonus_color: '#000000',
    error_color: '#ff0000'
  };

  let name = $state('');
  let colors = $state<ThemeColors>({ ...DEFAULTS });
  let saving = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    saving = true;
    try {
      await E.createCustomTheme(n, { ...colors });
      name = '';
      colors = { ...DEFAULTS };
      oncreated();
    } catch (err) {
      toast.error(`Failed to create theme: ${(err as Error).message}`);
    } finally {
      saving = false;
    }
  }
</script>

<div class="custom-theme-creator p-6 space-y-6">
  <div class="custom-theme-preview-wrap">
    <span class="custom-theme-preview-label">{t('custom_theme_creator.preview')}</span>
    <div
      class="custom-theme-preview-card"
      style="background-color:{colors.background_color};border-radius:10px;padding:12px;min-height:74px;box-shadow:0 1px 4px rgba(0,0,0,.25);display:inline-block;min-width:160px;"
    >
      <div style="color:{colors.text_color};font-size:13px;font-weight:600;line-height:1.2;margin-bottom:6px;">{name || t('custom_theme_creator.my_theme')}</div>
      <div style="display:flex;gap:4px;">
        <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background-color:{colors.prog_bar_color};"></span>
        <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background-color:{colors.standout_color};opacity:0.6;"></span>
      </div>
    </div>
  </div>

  <form onsubmit={submit} class="space-y-4">
    <div class="custom-theme-name-row">
      <label class="custom-theme-name-label" for="custom-theme-name">{t('custom_theme_creator.theme_name')}</label>
      <input id="custom-theme-name" type="text" placeholder="My Custom Theme" bind:value={name} class="custom-theme-name-input" maxlength="255" />
    </div>
    <div class="custom-theme-colors-grid">
      {#each FIELDS as [key, label] (key)}
        <div class="custom-theme-color-row">
          <label class="custom-theme-color-label" for="ct-{key}">{label}</label>
          <div class="custom-theme-color-input-wrap">
            <input id="ct-{key}" type="color" bind:value={colors[key]} class="custom-theme-color-picker" />
            <span class="custom-theme-color-hex">{colors[key]}</span>
          </div>
        </div>
      {/each}
    </div>
    <button type="submit" class="custom-theme-submit-btn" disabled={saving || !name.trim()}>
      {#if saving}<span class="animate-spin inline-block mr-2">&#10227;</span>Saving...{:else}<i class="ph ph-plus-circle mr-1"></i>{t('custom_theme_creator.create_theme')}{/if}
    </button>
  </form>
</div>
