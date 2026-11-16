// "Refresh all feeds" over the backend's refresh websocket
// (/ws/api/data/episodes/{user_id}). The server streams progress, new episodes
// and errors, then closes the socket when done.
import { session } from '$lib/stores/session.svelte';
import { ui } from '$lib/stores/app.svelte';

export function refreshFeeds(): Promise<number> {
  return new Promise((resolve) => {
    if (ui.isRefreshing) return resolve(0);
    ui.isRefreshing = true;
    const base = session.serverName.replace(/^http/, 'ws');
    const url = `${base}/ws/api/data/episodes/${session.userId}?api_key=${encodeURIComponent(session.apiKey)}&nextcloud_refresh=false`;
    let added = 0;
    let ws: WebSocket;
    const done = () => {
      ui.isRefreshing = false;
      ui.feedVersion++;
      resolve(added);
    };
    try {
      ws = new WebSocket(url);
    } catch {
      return done();
    }
    ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(m.data);
        if (msg.new_episode) added++;
      } catch {
        /* ignore non-JSON frames */
      }
    };
    ws.onclose = done;
    ws.onerror = () => ws.close();
  });
}
