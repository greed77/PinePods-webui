// Ports of upstream gen_funcs.rs formatting helpers.
import DOMPurify from 'dompurify';
import { prefs } from '$lib/stores/app.svelte';

/** HH:MM:SS, like upstream `format_time`. */
export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

/** MM:SS, or HH:MM:SS past an hour (`format_time_rm_hour`). */
export function formatTimeRmHour(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

/** `M:SS`, or `H:MM:SS` once past an hour (player_ui `fmt_time`). */
export function fmtTime(seconds: number, long = false) {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return long || h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Parse a feed date. Dates without a zone are UTC, as upstream assumes. */
export function parseDate(s: string): Date {
  if (!s) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(s)) return new Date(s + 'Z');
  return new Date(s);
}

function parts(d: Date, tz: string) {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
  } catch {
    return parts(d, 'UTC');
  }
  const o: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) o[p.type] = p.value;
  return { y: o.year, mo: o.month, d: o.day, h: Number(o.hour), mi: o.minute };
}

/** Date + time in the user's zone, date format and 12/24h preference
 *  (upstream `format_datetime`). */
export function formatDateTime(s: string) {
  const date = parseDate(s);
  if (isNaN(date.getTime())) return '';
  const p = parts(date, prefs.timezone || 'UTC');
  const dayOfYear = () => {
    const start = Date.UTC(Number(p.y), 0, 1);
    const cur = Date.UTC(Number(p.y), Number(p.mo) - 1, Number(p.d));
    return String((cur - start) / 86400000 + 1).padStart(3, '0');
  };
  const dateStr = (
    {
      MDY: `${p.mo}-${p.d}-${p.y}`,
      DMY: `${p.d}-${p.mo}-${p.y}`,
      YMD: `${p.y}-${p.mo}-${p.d}`,
      JUL: `${p.y.slice(2)}/${dayOfYear()}`,
      ISO: `${p.y}-${p.mo}-${p.d}`,
      USA: `${p.mo}/${p.d}/${p.y}`,
      EUR: `${p.d}.${p.mo}.${p.y}`,
      JIS: `${p.y}-${p.mo}-${p.d}`
    } as Record<string, string>
  )[prefs.dateFormat] ?? `${p.y}-${p.mo}-${p.d}`;
  if (prefs.hourPref === 12) {
    const h12 = p.h % 12 || 12;
    return `${dateStr} ${String(h12).padStart(2, ' ')}:${p.mi} ${p.h < 12 ? 'AM' : 'PM'}`;
  }
  return `${dateStr} ${String(p.h).padStart(2, '0')}:${p.mi}`;
}

// Links in feed HTML open in a new tab, like upstream's ammonia config.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitize(html: string) {
  return DOMPurify.sanitize(html ?? '', { FORBID_TAGS: ['style', 'form', 'input', 'button'] });
}

export function sanitizeNoImages(html: string) {
  return DOMPurify.sanitize(html ?? '', { FORBID_TAGS: ['img', 'style', 'form', 'input', 'button', 'picture', 'video'] });
}

/** Plain text from HTML, for places that show a one-line description. */
export function stripHtml(html: string) {
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(html ?? '');
  return div.textContent ?? '';
}
