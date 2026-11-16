import { describe, expect, it } from 'vitest';
import { session } from './session.svelte';

describe('session persistence', () => {
  it('uses the upstream localStorage keys and never stores a password', () => {
    session.set(
      { UserID: 3, Username: 'test', UseGravatar: false },
      { server_name: 'https://pods.example', api_key: 'abc', password: 'secret' as never },
      { api_url: 'x' }
    );
    expect(JSON.parse(localStorage.getItem('userState')!)).toEqual({ user_details: expect.objectContaining({ UserID: 3 }) });
    const auth = JSON.parse(localStorage.getItem('userAuthState')!).auth_details;
    expect(auth.api_key).toBe('abc');
    expect(auth.password).toBeNull();
    expect(JSON.parse(localStorage.getItem('serverState')!)).toEqual({ server_details: { api_url: 'x' } });
  });

  it('reloads a stored session and strips any stored password', () => {
    localStorage.setItem('userState', JSON.stringify({ user_details: { UserID: 7, Username: 'u', UseGravatar: true } }));
    localStorage.setItem('userAuthState', JSON.stringify({ auth_details: { server_name: 'https://s', api_key: 'k', password: 'old' } }));
    localStorage.setItem('serverState', JSON.stringify({ server_details: {} }));
    session.load();
    expect(session.loggedIn).toBe(true);
    expect(session.userId).toBe(7);
    expect(session.serverName).toBe('https://s');
    expect(session.auth?.password).toBeNull();
  });

  it('clear() signs out', () => {
    session.set({ UserID: 1, UseGravatar: false }, { server_name: 'https://s', api_key: 'k' }, {});
    session.clear();
    expect(session.loggedIn).toBe(false);
    expect(localStorage.getItem('userAuthState')).toBeNull();
  });

  it('falls back to the page origin when no server is stored', () => {
    session.clear();
    expect(session.serverName).toBe(location.origin);
  });
});
