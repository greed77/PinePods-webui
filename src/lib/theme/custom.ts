// Built-in theme list for the picker and custom-theme support
// (upstream setting_components/theme_options.rs + custom_theme_creator.rs).
import { changeTheme } from './themes.js';

export interface ThemeSwatch {
  name: string;
  bg: string;
  text: string;
  swatch1: string;
  swatch2: string;
}

export const THEMES: ThemeSwatch[] = [
  { name: 'Light', bg: '#F9F9F9', text: '#4A4A4A', swatch1: '#0099E1', swatch2: '#4A4A4A' },
  { name: 'Soft Lavender', bg: '#F5F0FF', text: '#50456E', swatch1: '#9371D9', swatch2: '#50456E' },
  { name: 'Minty Fresh', bg: '#F1F9F6', text: '#2D6E5B', swatch1: '#3D9D82', swatch2: '#2D6E5B' },
  { name: 'Warm Vanilla', bg: '#FDF6E9', text: '#6D4922', swatch1: '#C6A06D', swatch2: '#6D4922' },
  { name: 'Coastal Blue', bg: '#F0F5FA', text: '#2C5D8F', swatch1: '#4C87C5', swatch2: '#2C5D8F' },
  { name: 'Paper Cream', bg: '#FAF7F2', text: '#4A4439', swatch1: '#A19788', swatch2: '#4A4439' },
  { name: 'Dark', bg: '#2A2B33', text: '#F6F5F4', swatch1: '#4A535E', swatch2: '#F6F5F4' },
  { name: 'Nordic Light', bg: '#ECEFF4', text: '#656D76', swatch1: '#2984CE', swatch2: '#656D76' },
  { name: 'Nordic', bg: '#3C4252', text: '#F6F5F4', swatch1: '#5D80AA', swatch2: '#F6F5F4' },
  { name: 'Abyss', bg: '#000C18', text: '#F6F5F4', swatch1: '#326FEF', swatch2: '#F6F5F4' },
  { name: 'Dracula', bg: '#282A36', text: '#F6F5F4', swatch1: '#BD93F9', swatch2: '#F6F5F4' },
  { name: 'Catppuccin Mocha Mauve', bg: '#1E1E2E', text: '#CDD6F4', swatch1: '#CBA6F7', swatch2: '#CDD6F4' },
  { name: 'Midnight Ocean', bg: '#0F172A', text: '#E2E8F0', swatch1: '#38BDF8', swatch2: '#E2E8F0' },
  { name: 'Forest Depths', bg: '#1A2F1F', text: '#C9E4CA', swatch1: '#7FB685', swatch2: '#C9E4CA' },
  { name: 'Sunset Horizon', bg: '#2B1C2C', text: '#FFD9C0', swatch1: '#FF9E64', swatch2: '#FFD9C0' },
  { name: 'Arctic Frost', bg: '#1A1D21', text: '#ECEFF4', swatch1: '#88C0D0', swatch2: '#ECEFF4' },
  { name: 'Cyber Synthwave', bg: '#1A1721', text: '#EEE6FF', swatch1: '#F92AAD', swatch2: '#EEE6FF' },
  { name: 'Github Light', bg: '#FFFFFF', text: '#70777E', swatch1: '#6590FD', swatch2: '#70777E' },
  { name: 'Neon', bg: '#120E16', text: '#9F9DA1', swatch1: '#F75C1D', swatch2: '#9F9DA1' },
  { name: 'Kimbie', bg: '#221A0F', text: '#B1AD86', swatch1: '#CA9858', swatch2: '#B1AD86' },
  { name: 'Gruvbox Light', bg: '#F9F5D7', text: '#5F5750', swatch1: '#D1AC0E', swatch2: '#5F5750' },
  { name: 'Gruvbox Dark', bg: '#32302F', text: '#868729', swatch1: '#424314', swatch2: '#868729' },
  { name: 'Greenie Meanie', bg: '#142E28', text: '#489D50', swatch1: '#489D50', swatch2: '#489D50' },
  { name: 'Wildberries', bg: '#240041', text: '#CF8B3E', swatch1: '#F55385', swatch2: '#CF8B3E' },
  { name: 'Hot Dog Stand - MY EYES', bg: '#670B0A', text: '#121215', swatch1: '#EEB911', swatch2: '#121215' }
];

/** The 19 colors of a theme, in the order upstream's creator lists them. */
export const THEME_COLORS = [
  'background_color',
  'button_color',
  'container_button_color',
  'button_text_color',
  'text_color',
  'text_secondary_color',
  'border_color',
  'accent_color',
  'prog_bar_color',
  'error_color',
  'bonus_color',
  'secondary_background',
  'container_background',
  'standout_color',
  'hover_color',
  'link_color',
  'thumb_color',
  'unfilled_color',
  'check_box_color'
] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];
export type ThemeColors = Record<ThemeColor, string>;

export interface CustomTheme extends ThemeColors {
  themeid: number;
  name: string;
}

/** Sets the CSS variables for a custom theme (`background_color` -> `--background-color`). */
export function applyCustomTheme(c: ThemeColors) {
  const root = document.documentElement;
  for (const k of THEME_COLORS) root.style.setProperty(`--${k.replace(/_/g, '-')}`, c[k]);
}

export const isBuiltinTheme = (name: string) => THEMES.some((t) => t.name === name);

/** Applies a theme by name: built-ins directly, custom ones from `custom` if found. */
export function applyThemeByName(name: string, custom: CustomTheme[] = []) {
  const c = custom.find((t) => t.name === name);
  if (c && !isBuiltinTheme(name)) applyCustomTheme(c);
  else changeTheme(name);
}
