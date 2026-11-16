/** Unix seconds as a local date-time, or `never` when unset (upstream fmt_time). */
export const fmtUnix = (secs: number | null | undefined, never: string) => (secs == null ? never : new Date(secs * 1000).toLocaleString());
