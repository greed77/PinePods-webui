<script lang="ts">
  // Port of upstream components/app_drawer.rs: the slide-in navigation drawer plus
  // the fixed top-left buttons (menu, home/back, refresh, favorites filter).
  import { page } from '$app/state';
  import { session } from '$lib/stores/session.svelte';
  import { prefs, ui } from '$lib/stores/app.svelte';
  import { refreshFeeds } from '$lib/refresh';
  import { t } from '$lib/i18n/index.svelte';

  let open = $state(false);
  const path = $derived(page.url.pathname);
  const username = $derived(session.user?.Username ?? 'Guest');
  const avatar = $derived(session.user?.UseGravatar && prefs.gravatarUrl ? prefs.gravatarUrl : '/static/assets/favicon.png');

  const topLevel = ['/login', '/home', '/queue', '/saved', '/downloads', '/people_subs', '/podcasts', '/user_stats', '/settings', '/search', '/feed', '/playlists'];
  const showHome = $derived(path !== '/home');
  const showRefresh = $derived(path === '/home');
  const showBack = $derived(!topLevel.includes(path));

  function toggle() {
    open = !open;
    document.body.classList.toggle('no-scroll', open);
  }
  function closeDrawer() {
    if (open) toggle();
  }

  async function refresh(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    await refreshFeeds();
  }

  const links = [
    { href: '/home', icon: 'ph-house', key: 'navigation.home' },
    { href: '/feed', icon: 'ph-bell-ringing', key: 'app_drawer.feed' },
    { href: '/search', icon: 'ph-magnifying-glass', key: 'navigation.search' },
    { href: '/queue', icon: 'ph-queue', key: 'navigation.queue' },
    { href: '/saved', icon: 'ph-bookmark-simple', key: 'navigation.collections' },
    { href: '/playlists', icon: 'ph-list-checks', key: 'navigation.playlists' },
    { href: '/history', icon: 'ph-clock-counter-clockwise', key: 'navigation.history' },
    { href: '/downloads', icon: 'ph-download-simple', key: 'app_drawer.server_downloads' },
    { href: '/people_subs', icon: 'ph-user', key: 'app_drawer.subscribed_people' },
    { href: '/discover', icon: 'ph-compass', key: 'app_drawer.discover' },
    { href: '/podcasts', icon: 'ph-microphone-stage', key: 'navigation.podcasts' },
    { href: '/settings', icon: 'ph-gear', key: 'app_drawer.settings' }
  ];
</script>

<div class="relative">
  <div
    class="fixed drawer-background top-0 left-0 z-20 h-full transition-all duration-300 transform shadow-lg md:w-64 w-less-full {open
      ? 'translate-x-0'
      : '-translate-x-full'}"
  >
    <div class="sb-brand" style="margin-top: 60px;">
      <img src="/static/assets/favicon.png" alt="Pinepods" />
      <span>{t('app_drawer.pinepods')}</span>
    </div>

    <div style="padding: 0 8px 4px;">
      <a href="/user_stats" class="sb-item" onclick={closeDrawer}>
        <img src={avatar} class="sb-avatar" alt="User avatar" />
        <span>{username}</span>
      </a>
    </div>

    <hr class="sb-hr" />

    <div style="padding: 0 8px; display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto;">
      {#each links as l}
        <div>
          <a href={l.href} class="sb-item" onclick={closeDrawer}>
            <i class="ph {l.icon}"></i>
            <span>{t(l.key)}</span>
          </a>
        </div>
      {/each}
    </div>

    <div class="sb-bottom" style="padding: 8px 8px 4px; margin-top: auto;">
      <hr class="sb-hr" />
      <div>
        <a href="/sign_out" class="sb-item" onclick={closeDrawer}>
          <i class="ph ph-sign-out"></i>
          <span>{t('app_drawer.sign_out')}</span>
        </a>
      </div>
      {#if ui.pinepodsVersion}
        <div class="sb-version">v{ui.pinepodsVersion}</div>
      {/if}
    </div>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="drawer-icon flex items-center" onclick={toggle}>
    <button class="cursor-pointer flex items-center justify-center" aria-label="Menu">
      <i class="ph ph-list text-4xl transition-transform duration-300 {open ? 'rotate-90 transform' : ''}"></i>
    </button>
    <div class="w-8 h-8 ml-3 flex items-center">
      {#if showHome}
        <a href="/home" class="rounded-lg cursor-pointer" onclick={(e) => e.stopPropagation()} aria-label="Home">
          <div class="flex flex-col items-center"><i class="ph ph-house md:text-4xl text-4xl"></i></div>
        </a>
      {/if}
      {#if showBack}
        <button
          onclick={(e) => {
            e.stopPropagation();
            history.back();
          }}
          class="back-button flex items-center space-x-2 px-4 py-2 rounded-lg"
          aria-label="Back"
        >
          <div class="flex flex-col items-center"><i class="ph ph-arrow-bend-up-left md:text-4xl text-4xl"></i></div>
        </button>
      {/if}
      {#if showRefresh}
        <button onclick={refresh} class="ml-2 rounded-lg cursor-pointer touch-manipulation" aria-label="Refresh feeds">
          <div class="flex flex-col items-center">
            <i class="ph {ui.isRefreshing ? 'ph-hourglass-medium' : 'ph-arrows-clockwise'} md:text-4xl text-4xl"></i>
          </div>
        </button>
      {/if}
      {#if !showBack}
        <button
          onclick={(e) => {
            e.stopPropagation();
            ui.favoritesOnly = !ui.favoritesOnly;
          }}
          class="ml-2 rounded-lg cursor-pointer"
          title="Toggle favorites filter"
        >
          <div class="flex flex-col items-center">
            <i class="ph ph-star md:text-4xl text-4xl {ui.favoritesOnly ? 'text-yellow-400' : ''}"></i>
          </div>
        </button>
      {/if}
    </div>
  </div>
</div>
