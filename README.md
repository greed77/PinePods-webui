# PinePods Web UI (Svelte)

An alternative web front end for a [PinePods](https://github.com/madeofpendletonwool/PinePods) server, built with SvelteKit as a static single-page app. It talks to the server only through its HTTP API and websockets, and reuses the upstream stylesheet, icons, themes and translations so it looks and reads like the stock UI.

## Setup

```sh
npm install
cp .env.example .env.local   # set PINEPODS_DEV_SERVER to your server
npm run dev                  # http://localhost:5173, /api and /ws proxied to the server
```

During development Vite proxies `/api` and `/ws` to `PINEPODS_DEV_SERVER`, so the app treats its own origin as the server, the same way it does in production.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static build into `build/` |
| `npm run check` | Type-check with svelte-check |
| `npm run gen:api` | Regenerate `src/lib/api/schema.d.ts` from the server's `/api/openapi.json` |

## Deploying

`npm run build` outputs plain static files in `build/`. Serve them from the same origin as the API: for example, mount them over `/var/www/html` in the PinePods container, which nginx already serves with an `index.html` fallback. Unknown paths have to fall back to `index.html`.

## Layout

- `src/lib/api`: generated OpenAPI types (`schema.d.ts`), the client, and endpoint wrappers (`endpoints.ts`) with types for responses the spec leaves untyped.
- `src/lib/player`: the playback engine (`player.svelte.ts`) and player UI. It ports upstream `audio.rs`: history, queue bump, listen-time tracking, completion, skip segments and auto-advance.
- `src/lib/stores`: session (same localStorage keys as upstream, minus the password), shared episode status, queue, toasts.
- `src/lib/components`: ports of the upstream Yew components, keeping their CSS class names.
- `src/routes`: `/` (login), `/oauth/callback`, and the signed-in pages under `(app)`.
- `static/static`: copied from upstream `web/static` (stylesheet, icons, fonts, art).
- `src/lib/i18n/translations`: copied from upstream `web/src/translations`.

## Status

Stage 1 (done): login (password, MFA, OIDC, first-login preferences), home, podcasts, podcast page, episode page, player, queue panel and queue page.

Stage 2: search and discover, feed, saved/collections, history, downloads, playlists.

Stage 3: people, YouTube, user settings, admin settings.

Pages not built yet show a placeholder; the stock UI on the server still covers them.

## License

GPL-3.0-or-later. Assets, styles and translations come from PinePods, which is GPL-3.0.
