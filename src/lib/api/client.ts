// Typed client generated from the server's OpenAPI spec (see scripts/gen-api.mjs).
// Every request goes to the current session's server with its Api-Key attached.
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { session } from '$lib/stores/session.svelte';

const auth: Middleware = {
  onRequest({ request }) {
    if (session.apiKey && !request.headers.has('Api-Key') && !request.headers.has('Authorization')) {
      request.headers.set('Api-Key', session.apiKey);
    }
    return request;
  }
};

const clients = new Map<string, ReturnType<typeof createClient<paths>>>();

/** The API client for the current server. */
export function api() {
  const base = session.serverName;
  let c = clients.get(base);
  if (!c) {
    c = createClient<paths>({ baseUrl: base });
    c.use(auth);
    clients.set(base, c);
  }
  return c;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Unwraps an openapi-fetch result, throwing ApiError on failure. Untyped
 *  responses (the spec doesn't describe every body) are cast to `T`. */
export async function unwrap<T = unknown>(
  p: Promise<{ data?: unknown; error?: unknown; response: Response }>
): Promise<T> {
  const { data, error, response } = await p;
  if (!response.ok || error !== undefined) {
    const detail =
      (error && typeof error === 'object' && ('detail' in error ? (error as any).detail : (error as any).message)) ||
      (typeof error === 'string' ? error : '') ||
      response.statusText;
    throw new ApiError(response.status, String(detail || `HTTP ${response.status}`));
  }
  return data as T;
}
