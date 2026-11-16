<script lang="ts">
  // Port of upstream pages/subscribed_people.rs: people the user follows, and their
  // latest episodes across every show (library and outside it), newest first.
  import { goto } from '$app/navigation';
  import * as E from '$lib/api/endpoints';
  import type { Episode, PersonInfo } from '$lib/api/endpoints';
  import { episodeStatus } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import EmptyMessage from '$lib/components/EmptyMessage.svelte';
  import PersonAvatar from '$lib/components/PersonAvatar.svelte';
  import FollowButton from '$lib/components/FollowButton.svelte';
  import EpisodeListItem from '$lib/components/EpisodeListItem.svelte';

  /** Episodes per person in the combined feed. */
  const PER_PERSON = 20;
  const FEED_LIMIT = 150;

  let people = $state<PersonInfo[] | null>(null);
  let feed = $state<Episode[] | null>(null);

  (async () => {
    const list = await E.getFollowedPeople().catch(() => [] as PersonInfo[]);
    people = list;
    const profiles = await Promise.allSettled(list.map((p) => E.getPersonProfile(p.id, PER_PERSON, 0)));
    const seen = new Set<string>();
    const episodes: Episode[] = [];
    for (const r of profiles) {
      if (r.status !== 'fulfilled') continue;
      for (const ep of [...r.value.episodes, ...r.value.external_episodes]) {
        // The same episode can credit several followed people.
        if (seen.has(ep.episodeurl)) continue;
        seen.add(ep.episodeurl);
        episodes.push(ep);
      }
    }
    episodes.sort((a, b) => (a.episodepubdate < b.episodepubdate ? 1 : a.episodepubdate > b.episodepubdate ? -1 : 0));
    const shown = episodes.slice(0, FEED_LIMIT);
    episodeStatus.absorb(shown);
    feed = shown;
  })();
</script>

<div class="main-container">
  <TopBar />
  <div class="pp-page">
    <h1 class="pp-page-title">{t('people_subs.subscribed_people')}</h1>
    {#if people === null}
      <Loading />
    {:else if people.length === 0}
      <EmptyMessage header={t('people.followed_empty_title')} paragraph={t('people.followed_empty_message')} />
    {:else}
      <section class="pp-section">
        <div class="pp-followed">
          {#each people as p (p.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="pp-followed-card" title={p.name} onclick={() => goto(`/person/${p.id}`)}>
              <PersonAvatar img={p.img} alt={p.name} class="pp-followed-avatar" placeholder="is-ph" />
              <span class="pp-followed-name">{p.name}</span>
              <FollowButton personId={p.id} followed={p.followed} compact />
            </div>
          {/each}
        </div>
      </section>
      <section class="pp-section">
        <h2 class="pp-section-title">{t('people.latest_episodes')}</h2>
        {#if feed === null}
          <p class="pp-note"><span class="sp-spinner"></span>{t('people_subs.loading_episodes')}</p>
        {:else if feed.length === 0}
          <p class="pp-empty-text pp-pad">{t('people_subs.no_recent_episodes_found')}</p>
        {:else}
          {#each feed as ep (ep.episodeurl)}
            <EpisodeListItem episode={ep} />
          {/each}
        {/if}
      </section>
    {/if}
  </div>
</div>
