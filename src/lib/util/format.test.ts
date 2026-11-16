import { describe, expect, it, beforeEach } from 'vitest';
import { fmtTime, formatDateTime, formatTime, formatTimeRmHour, parseDate, sanitize, sanitizeNoImages } from './format';
import { prefs } from '$lib/stores/app.svelte';

describe('time formatting', () => {
  it('formatTime pads to HH:MM:SS like upstream format_time', () => {
    expect(formatTime(0)).toBe('00:00:00');
    expect(formatTime(2367)).toBe('00:39:27');
    expect(formatTime(3725)).toBe('01:02:05');
    expect(formatTime(-5)).toBe('00:00:00');
  });

  it('formatTimeRmHour drops the hour when zero', () => {
    expect(formatTimeRmHour(65)).toBe('01:05');
    expect(formatTimeRmHour(3665)).toBe('01:01:05');
  });

  it('fmtTime is M:SS, or H:MM:SS past an hour or when forced long', () => {
    expect(fmtTime(5)).toBe('0:05');
    expect(fmtTime(2367)).toBe('39:27');
    expect(fmtTime(3600)).toBe('1:00:00');
    expect(fmtTime(5, true)).toBe('0:00:05');
    expect(fmtTime(NaN)).toBe('0:00');
  });
});

describe('dates', () => {
  beforeEach(() => {
    prefs.timezone = 'UTC';
    prefs.hourPref = 24;
    prefs.dateFormat = 'ISO';
  });

  it('treats zone-less server timestamps as UTC', () => {
    expect(parseDate('2026-11-13T08:00:00').toISOString()).toBe('2026-11-13T08:00:00.000Z');
  });

  it('formats in the user timezone and 24h clock', () => {
    prefs.timezone = 'America/New_York';
    expect(formatDateTime('2026-11-13T08:00:00')).toBe('2026-11-13 03:00');
  });

  it('supports 12h clock and each date format', () => {
    prefs.hourPref = 12;
    expect(formatDateTime('2026-11-13T15:04:00')).toBe('2026-11-13  3:04 PM');
    prefs.hourPref = 24;
    const cases: Record<string, string> = {
      MDY: '11-13-2026',
      DMY: '13-11-2026',
      YMD: '2026-11-13',
      USA: '11/13/2026',
      EUR: '13.11.2026',
      JUL: '26/317'
    };
    for (const [fmt, expected] of Object.entries(cases)) {
      prefs.dateFormat = fmt;
      expect(formatDateTime('2026-11-13T08:00:00')).toBe(`${expected} 08:00`);
    }
  });

  it('returns empty for unparseable dates', () => {
    expect(formatDateTime('not a date')).toBe('');
  });

  it('falls back to UTC for an unknown timezone', () => {
    prefs.timezone = 'Not/AZone';
    expect(formatDateTime('2026-11-13T08:00:00')).toBe('2026-11-13 08:00');
  });
});

describe('sanitizing feed HTML', () => {
  it('removes scripts and event handlers', () => {
    const out = sanitize('<p onclick="x()">hi<script>alert(1)</script></p>');
    expect(out).toBe('<p>hi</p>');
  });

  it('opens links in a new tab', () => {
    const out = sanitize('<a href="https://example.com">x</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('strips images for list descriptions', () => {
    expect(sanitizeNoImages('<p>a<img src="x.png">b</p>')).toBe('<p>ab</p>');
  });
});
