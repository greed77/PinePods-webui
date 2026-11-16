// Signed-in user, API key and server, persisted in localStorage under the same
// keys the stock Yew UI uses (userState / userAuthState / serverState) so the two
// can share a session when served from the same origin. Unlike upstream, the
// plain-text password is never stored.

export interface UserDetails {
  UserID: number;
  Fullname?: string | null;
  Username?: string | null;
  Email?: string | null;
  UseGravatar: boolean;
}

export interface AuthDetails {
  server_name: string;
  username?: string | null;
  password?: null;
  api_key?: string | null;
}

export interface ServerDetails {
  api_url?: string | null;
  proxy_url?: string | null;
  people_url?: string | null;
  [k: string]: unknown;
}

function read<T>(key: string, field: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return (JSON.parse(raw)?.[field] as T) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, field: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ [field]: value }));
  } catch {
    /* storage unavailable */
  }
}

class Session {
  user = $state<UserDetails | null>(null);
  auth = $state<AuthDetails | null>(null);
  server = $state<ServerDetails | null>(null);

  get apiKey() {
    return this.auth?.api_key ?? '';
  }
  get userId() {
    return this.user?.UserID ?? 0;
  }
  /** Base URL for API calls: the stored server, or this page's own origin. */
  get serverName() {
    return (this.auth?.server_name || location.origin).replace(/\/+$/, '');
  }
  get loggedIn() {
    return !!(this.user && this.apiKey);
  }

  load() {
    this.user = read<UserDetails>('userState', 'user_details');
    this.auth = read<AuthDetails>('userAuthState', 'auth_details');
    this.server = read<ServerDetails>('serverState', 'server_details');
    if (this.auth) this.auth.password = null;
  }

  set(user: UserDetails, auth: AuthDetails, server: ServerDetails) {
    this.user = user;
    this.auth = { ...auth, password: null };
    this.server = server;
    write('userState', 'user_details', this.user);
    write('userAuthState', 'auth_details', this.auth);
    write('serverState', 'server_details', this.server);
  }

  clear() {
    this.user = this.auth = this.server = null;
    for (const k of ['userState', 'userAuthState', 'serverState']) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
    try {
      sessionStorage.removeItem('isAuthenticated');
    } catch {
      /* ignore */
    }
  }
}

export const session = new Session();
