import { describe, expect, it } from 'vitest';
import { detectProvider, scopeString } from './oidc';

describe('oidc helpers', () => {
  it('detects the provider from its endpoints', () => {
    expect(detectProvider('https://github.com/login/oauth/authorize')).toBe('github');
    expect(detectProvider('https://accounts.google.com/o/oauth2/v2/auth')).toBe('google');
    expect(detectProvider('https://login.microsoftonline.com/x/oauth2/v2.0/authorize')).toBe('microsoft');
    expect(detectProvider('https://auth.example.com/authorize', 'https://auth.example.com/token')).toBe('standard');
  });

  it('falls back to each provider type default scopes', () => {
    expect(scopeString([], 'standard')).toBe('openid email profile');
    expect(scopeString([], 'github')).toBe('read:user,user:email');
    expect(scopeString(['openid', 'email'], 'standard')).toBe('openid email');
  });
});
