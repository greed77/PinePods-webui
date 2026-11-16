<script lang="ts">
  // Port of upstream pages/home.rs.
  import { goto } from '$app/navigation';
  import * as E from '$lib/api/endpoints';
  import type { Episode, HomeOverview, Playlist } from '$lib/api/endpoints';
  import { episodeStatus, ui } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import EpisodeListItem from '$lib/components/EpisodeListItem.svelte';
  import FallbackImage from '$lib/components/FallbackImage.svelte';

  let home = $state<HomeOverview | null>(null);
  let playlists = $state<Playlist[] | null>(null);
  let loading = $state(true);

  async function load() {
    try {
      const data = await E.getHomeOverview();
      episodeStatus.absorb([...data.recent_episodes, ...data.in_progress_episodes, ...data.queue_preview]);
      home = data;
    } catch (e) {
      console.warn('Error fetching home data', e);
    } finally {
      loading = false;
    }
    E.getPlaylists()
      .then((p) => (playlists = p))
      .catch(() => {});
  }

  $effect(() => {
    ui.feedVersion;
    load();
  });

  // Continue listening: up to 3 in-progress episodes; one finished elsewhere
  // animates out and the next slides in.
  let leaving = $state(new Set<number>());
  let removed = $state(new Set<number>());
  const continueList = $derived((home?.in_progress_episodes ?? []).filter((e) => !removed.has(e.episodeid)).slice(0, 3));
  $effect(() => {
    for (const ep of continueList) {
      const id = ep.episodeid;
      if (episodeStatus.completed.has(id) && !leaving.has(id) && !removed.has(id)) {
        leaving = new Set([...leaving, id]);
        setTimeout(() => {
          removed = new Set([...removed, id]);
          const next = new Set(leaving);
          next.delete(id);
          leaving = next;
        }, 400);
      }
    }
  });

  const weekTime = $derived.by(() => {
    const s = home?.weekly_stats.seconds_listened ?? 0;
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  });

  const quickLinks = $derived([
    { href: '/saved', icon: 'ph-star', label: t('app_drawer.saved'), count: home?.saved_count },
    { href: '/downloads', icon: 'ph-download-simple', label: t('app_drawer.downloads'), count: home?.downloaded_count },
    { href: '/playlists', icon: 'ph-playlist', label: t('home.smart_playlists') },
    { href: '/history', icon: 'ph-clock-counter-clockwise', label: t('app_drawer.history') },
    { href: '/feed', icon: 'ph-bell-ringing', label: t('app_drawer.feed') },
    { href: '/podcasts', icon: 'ph-microphone-stage', label: t('app_drawer.podcasts') }
  ]);
</script>

<div class="main-container">
  <TopBar />

  {#if loading}
    <Loading />
  {:else if home}
    {#if home.top_podcasts.length === 0}
      <div class="welcome-container">
        <div class="welcome-hero">
          <img src="/static/assets/favicon.png" alt="Pinepods" class="welcome-logo" />
          <h1 class="welcome-title">{t('home.welcome_to_pinepods')}</h1>
          <p class="welcome-subtitle">{t('home.welcome_hero_subtitle')}</p>
          <p class="welcome-intro">{t('home.welcome_intro')}</p>
          <div class="welcome-actions">
            <a href="https://pinepods.online/docs/intro" target="_blank" rel="noopener noreferrer" class="welcome-btn welcome-btn-secondary">
              <i class="ph ph-book"></i><span>{t('home.welcome_docs_button')}</span>
            </a>
            <a href="/podcasts" class="welcome-btn welcome-btn-secondary">
              <i class="ph ph-microphone-stage"></i><span>{t('home.welcome_open_podcasts')}</span>
            </a>
          </div>
        </div>
        <div class="welcome-tips">
          <h2 class="welcome-tips-heading">{t('home.welcome_get_started')} — {t('home.welcome_tips_heading')}</h2>
          <div class="welcome-tips-grid">
            {#each [['ph-magnifying-glass', 'search'], ['ph-rss', 'feed'], ['ph-binoculars', 'docs']] as [icon, k]}
              <div class="welcome-tip-card">
                <div class="welcome-tip-icon"><i class="ph {icon}"></i></div>
                <div class="welcome-tip-text">
                  <h3 class="welcome-tip-title">{t(`home.welcome_tip_${k}_title`)}</h3>
                  <p class="welcome-tip-desc">{t(`home.welcome_tip_${k}_desc`)}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <div class="space-y-8">
        <div class="section-container">
          <h2 class="text-2xl font-bold mb-4 item_container-text">{t('home.quick_links')}</h2>
          <div class="grid grid-cols-3 gap-2 md:gap-4">
            {#each quickLinks as q}
              <a href={q.href} class="quick-link-card rounded-lg">
                <i class="ph {q.icon}"></i>
                <span>{q.label}</span>
                {#if q.count && q.count > 0}<span class="quick-link-badge">{q.count}</span>{/if}
              </a>
            {/each}
          </div>
        </div>

        <div class="section-container">
          <h2 class="text-2xl font-bold mb-4 item_container-text">{t('home.this_week')}</h2>
          <div class="weekly-stats-grid grid grid-cols-2 gap-2 md:gap-4">
            <div class="weekly-stat-card quick-link-card rounded-lg">
              <i class="ph ph-clock"></i>
              <div class="weekly-stat-text">
                <span class="weekly-stat-value">{weekTime}</span>
                <span class="weekly-stat-label">{t('home.listened')}</span>
              </div>
            </div>
            <div class="weekly-stat-card quick-link-card rounded-lg">
              <i class="ph ph-check-circle"></i>
              <div class="weekly-stat-text">
                <span class="weekly-stat-value">{home.weekly_stats.episodes_completed}</span>
                <span class="weekly-stat-label">{t('home.completed')}</span>
              </div>
            </div>
          </div>
        </div>

        {#if continueList.length}
          <div class="section-container">
            <h2 class="text-2xl font-bold mb-4 item_container-text">{t('home.continue_listening')}</h2>
            <div class="continue-list">
              {#each continueList as ep (ep.episodeid)}
                <div class="continue-item {leaving.has(ep.episodeid) ? 'leaving' : ''}">
                  <EpisodeListItem episode={ep} />
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if home.queue_preview.length}
          <div class="section-container">
            <h2 class="text-2xl font-bold mb-4 item_container-text">{t('home.up_next')} ({home.queue_count})</h2>
            <div class="space-y-4">
              {#each home.queue_preview as ep (ep.episodeid)}<EpisodeListItem episode={ep} />{/each}
            </div>
          </div>
        {/if}

        <h2 class="text-2xl font-bold mb-4 item_container-text">{t('home.top_podcasts')}</h2>
        <div class="podcast-grid">
          {#each home.top_podcasts as p (p.podcastid)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="podcast-grid-item" onclick={() => goto(`/podcast/${p.podcastid}`)}>
              <div class="podcast-image-container">
                <FallbackImage src={p.artworkurl} alt="Cover for {p.podcastname}" class="podcast-image" />
              </div>
              <div class="podcast-info"><h3 class="podcast-title-grid">{p.podcastname}</h3></div>
            </div>
          {/each}
        </div>

        <div class="section-container">
          <h2 class="text-2xl font-bold mb-4 item_container-text">{t('home.smart_playlists')}</h2>
          {#if playlists}
            <div class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {#each playlists as pl (pl.playlist_id)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div class="playlist-card" onclick={() => goto(`/playlist/${pl.playlist_id}`)}>
                  <div class="playlist-card-stack">
                    <div class="playlist-card-content">
                      <i class="ph {pl.icon_name} playlist-icon"></i>
                      <div class="playlist-info">
                        <h3 class="playlist-title">{pl.name}</h3>
                        <span class="playlist-count">{pl.episode_count ?? 0} episodes</span>
                        {#if pl.description}<p class="playlist-description">{pl.description}</p>{/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="item_container-text">{t('home.no_playlists_available')}</p>
          {/if}
        </div>

        <div class="section-container">
          <h2 class="text-2xl font-bold mb-4 item_container-text">{t('home.recent_episodes')}</h2>
          {#if home.recent_episodes.length === 0}
            <p class="item_container-text">{t('home.no_recent_episodes')}</p>
          {:else}
            <div class="space-y-4">
              {#each home.recent_episodes.slice(0, 5) as ep (ep.episodeid)}<EpisodeListItem episode={ep} />{/each}
            </div>
          {/if}
        </div>
        <div class="h-30"></div>
      </div>
    {/if}
  {:else}
    <EmptyMessage header={t('home.welcome_to_pinepods')} paragraph={t('home.welcome_description')} />
  {/if}
</div>
