// Per-page sort/filter choices, stored under upstream's keys
// (`{page}_sort_preference`) so they carry over from the stock UI.
export function getPref(page: string, fallback: string) {
  try {
    return localStorage.getItem(`${page}_sort_preference`) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setPref(page: string, value: string) {
  try {
    localStorage.setItem(`${page}_sort_preference`, value);
  } catch {
    /* storage unavailable */
  }
}
