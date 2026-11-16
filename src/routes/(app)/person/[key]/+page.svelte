<script lang="ts">
  // Port of upstream pages/person.rs. The URL names the person by PinePods id
  // (/person/12), PodPeopleDB id (/person/pp-34, from Discover) or name (old links);
  // the last two are looked up and replaced with the canonical id URL.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import * as E from '$lib/api/endpoints';
  import type { Episode, PersonPodcast, PersonProfile } from '$lib/api/endpoints';
  import { episodeStatus } from '$lib/stores/app.svelte';
  import { openPodcast } from '$lib/podcastNav';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import FallbackImage from '$lib/components/FallbackImage.svelte';
  import PersonAvatar from '$lib/components/PersonAvatar.svelte';
  import FollowButton from '$lib/components/FollowButton.svelte';
  import PagedEpisodes from '$lib/components/PagedEpisodes.svelte';
  import EpisodeListItem from '$lib/components/EpisodeListItem.svelte';

  const PAGE_SIZE = 50;
  const key = $derived(page.params.key ?? '');

  let status = $state<'loading' | 'notfound' | 'ready'>('loading');
  let profile = $state<PersonProfile | null>(null);
  let tab = $state<'library' | 'elsewhere' | null>(null);
  let libraryCount = $state(0);

  /** A person key from the URL: numeric id, `pp-<PodPeopleDB id>`, or a name. */
  function parseKey(k: string): { id: number } | { podpeople_id: number } | { name: string } {
    if (/^\d+$/.test(k)) return { id: Number(k) };
    const pp = /^pp-(\d+)$/.exec(k);
    if (pp) return { podpeople_id: Number(pp[1]) };
    return { name: k };
  }

  $effect(() => {
    const k = parseKey(key);
    let cancelled = false;
    status = 'loading';
    profile = null;
    tab = null;
    (async () => {
      let id: number;
      if ('id' in k) id = k.id;
      else {
        try {
          id = await E.lookupPerson(k);
        } catch {
          if (!cancelled) status = 'notfound';
          return;
        }
        if (!cancelled) goto(`/person/${id}`, { replaceState: true });
        return;
      }
      // Episodes from outside the library may still be refreshing on the server;
      // refetch a few times until it reports done.
      for (let attempt = 0; attempt < 4; attempt++) {
        if (cancelled) return;
        try {
          const p = await E.getPersonProfile(id, PAGE_SIZE, 0);
          if (cancelled) return;
          if (attempt === 0) {
            firstPage = p.episodes;
            libraryCount = p.episodes.length;
            episodeStatus.absorb(p.episodes);
          }
          profile = p;
          status = 'ready';
          if (!p.refreshing) return;
        } catch {
          if (attempt === 0 && !cancelled) status = 'notfound';
          return;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
    })();
    return () => (cancelled = true);
  });

  // The first page came with the profile; later pages are fetched by offset.
  let firstPage: Episode[] = [];
  const personId = $derived(profile?.person.id ?? 0);
  async function loadLibrary(offset: number): Promise<E.Page> {
    const eps = offset === 0 ? firstPage : (await E.getPersonProfile(personId, PAGE_SIZE, offset)).episodes;
    // No total from the server: keep asking while pages come back full.
    return { episodes: eps, total: offset + eps.length + (eps.length >= PAGE_SIZE ? 1 : 0) };
  }

  const elsewhere = $derived(profile?.external_episodes ?? []);
  const activeTab = $derived(tab ?? (libraryCount === 0 && elsewhere.length > 0 ? 'elsewhere' : 'library'));
  const summary = $derived(
    profile
      ? t('people.profile_summary')
          .replace('{shows}', String(profile.podcasts.length))
          .replace('{library}', String(profile.podcasts.filter((s) => s.podcastid != null).length))
      : ''
  );

  function showDetail(s: PersonPodcast) {
    const roles = s.roles.join(', ');
    if (s.podcast_level) return roles;
    const count = t('people.episode_count').replace('{count}', String(s.episode_count));
    return roles ? `${roles} · ${count}` : count;
  }

  function openShow(s: PersonPodcast) {
    if (s.podcastid) return goto(`/podcast/${s.podcastid}`);
    openPodcast({
      podcastid: 0,
      podcastname: s.podcastname,
      artworkurl: s.artworkurl ?? '',
      description: '',
      episodecount: 0,
      websiteurl: '',
      feedurl: s.feedurl,
      author: '',
      categories: {},
      explicit: false,
      podcastindexid: s.podcastindexid ?? 0
    });
  }
</script>

{#snippet tabButton(which: 'library' | 'elsewhere', label: string, count: number)}
  <button type="button" role="tab" aria-selected={activeTab === which} class="ep-tab {activeTab === which ? 'is-active' : ''}" onclick={() => (tab = which)}>
    <span>{label}</span>
    {#if count > 0}<span class="ep-tab-badge">{count}</span>{/if}
  </button>
{/snippet}

<div class="main-container">
  <TopBar />
  <div class="pp-page">
    {#if status === 'notfound'}
      <div class="empty-episodes-container">
        <img src="/static/assets/favicon.png" alt="Logo" class="logo" />
        <h1 class="page-subtitles">{t('people.person_not_found')}</h1>
        <p class="page-paragraphs">{t('people.person_not_found_message')}</p>
      </div>
    {:else if status === 'ready' && profile}
      {@const person = profile.person}
      <header class="pp-profile">
        <PersonAvatar img={person.img} alt={person.name} class="pp-profile-avatar" placeholder="is-ph" />
        <div class="pp-profile-body">
          <span class="pp-eyebrow">{t('people.person')}</span>
          <h1 class="pp-profile-name">{person.name}</h1>
          <p class="pp-profile-meta">{summary}</p>
          <div class="pp-profile-actions">
            <FollowButton personId={person.id} followed={person.followed} />
            {#if person.href?.startsWith('http')}
              <a class="pp-btn" href={person.href} target="_blank" rel="noopener noreferrer">
                <i class="ph ph-link"></i><span>{t('people.website')}</span>
              </a>
            {/if}
          </div>
        </div>
      </header>

      {#if profile.podcasts.length}
        <section class="pp-section">
          <h2 class="pp-section-title">{t('people.shows')}</h2>
          <div class="pp-shows">
            {#each profile.podcasts as s (s.feedurl)}
              <button type="button" class="pp-show" title={s.podcastname} onclick={() => openShow(s)}>
                <div class="pp-show-art">
                  <FallbackImage src={s.artworkurl} alt={s.podcastname} class="pp-show-img" />
                  {#if s.podcastid == null}<span class="pp-show-badge">{t('people.not_in_library')}</span>{/if}
                </div>
                <span class="pp-show-name">{s.podcastname}</span>
                <span class="pp-show-meta">{showDetail(s)}</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <section class="pp-section">
        <div class="ep-tabs" role="tablist">
          {@render tabButton('library', t('people.in_your_library'), libraryCount)}
          {@render tabButton('elsewhere', t('people.elsewhere'), elsewhere.length)}
        </div>
        {#if profile.refreshing && activeTab === 'elsewhere'}
          <p class="pp-note"><span class="sp-spinner"></span>{t('people.looking_for_more')}</p>
        {/if}
        {#if activeTab === 'library'}
          {#if libraryCount === 0}
            <p class="pp-empty-text pp-pad">{t('people.no_library_episodes')}</p>
          {:else}
            {#key person.id}
              <PagedEpisodes load={loadLibrary} key={person.id} emptyHeader="" emptyText={t('people.no_library_episodes')} />
            {/key}
          {/if}
        {:else if elsewhere.length === 0}
          <p class="pp-empty-text pp-pad">{profile.refreshing ? t('people.looking_for_more') : t('people.no_elsewhere_episodes')}</p>
        {:else}
          {#each elsewhere as ep (ep.episodeurl)}
            <EpisodeListItem episode={ep} />
          {/each}
        {/if}
      </section>
    {:else}
      <Loading />
    {/if}
  </div>
</div>
