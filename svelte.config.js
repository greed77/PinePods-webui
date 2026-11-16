import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  // The markup mirrors upstream's (clickable <li>/<div> rows etc.); keyboard and
  // ARIA improvements are a separate pass, so silence those warnings for now.
  warningFilter: (w) => !w.code.startsWith('a11y_'),
  kit: {
    // Pure client-side SPA: every unknown path falls back to index.html,
    // the same way the stock nginx config serves the Yew build.
    adapter: adapter({ fallback: 'index.html' }),
    alias: { $api: 'src/lib/api' }
  }
};
