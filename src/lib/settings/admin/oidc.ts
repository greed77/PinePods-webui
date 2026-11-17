// OIDC provider helpers (upstream setting_components/oidc.rs).
export type ProviderKind = 'standard' | 'github' | 'google' | 'microsoft';

/** Which provider the endpoints point at (upstream detect_provider). */
export function detectProvider(...urls: string[]): ProviderKind {
  for (const u of urls) {
    if (u.includes('github.com')) return 'github';
    if (u.includes('google') || u.includes('googleapis.com')) return 'google';
    if (u.includes('microsoft') || u.includes('azure') || u.includes('microsoftonline')) return 'microsoft';
  }
  return 'standard';
}

/** The scope string sent to the server; empty selection means the provider's defaults. */
export function scopeString(selected: string[], kind: ProviderKind) {
  if (selected.length) return selected.join(' ');
  return kind === 'github' ? 'read:user,user:email' : 'openid email profile';
}
