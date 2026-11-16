<script lang="ts">
  // People credited on a podcast (upstream people.rs PeopleStrip): overlapping avatars
  // plus "Hosted by A & B" on the desktop banner, or a labelled scrolling row of chips.
  // The add-people sheet is not ported yet, so an empty list renders nothing.
  import { goto } from '$app/navigation';
  import type { CreditedPerson } from '$lib/api/endpoints';
  import { t } from '$lib/i18n/index.svelte';
  import PersonAvatar from './PersonAvatar.svelte';

  let {
    people,
    layout,
    label = '',
    class: klass = ''
  }: { people: CreditedPerson[]; layout: 'banner' | 'chips'; label?: string; class?: string } = $props();

  const open = (p: CreditedPerson) => goto(`/person/${p.id}`);
  const shown = $derived(people.slice(0, 6));
  const more = $derived(people.length - shown.length);
  const sep = (i: number) => (i === 0 ? '' : i + 1 === shown.length && more === 0 ? ' & ' : ', ');
</script>

{#snippet unverified(p: CreditedPerson)}
  {#if !p.verified}<span class="pp-unverified" title={t('people.unverified')} aria-label={t('people.unverified')}></span>{/if}
{/snippet}

{#if people.length}
  {#if layout === 'banner'}
    <div class="pd-banner-hosts {klass}">
      <div class="pd-host-stack">
        {#each shown as p (p.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="pd-host-avatar-wrap" title={p.name} onclick={() => open(p)}>
            <PersonAvatar img={p.img} alt={p.name} class="pd-host-avatar" placeholder="pd-host-avatar-ph" />
          </div>
        {/each}
      </div>
      <div class="pd-host-label">
        <span class="pd-host-by">{label}</span>
        <span class="pd-host-names">
          {#each shown as p, i (p.id)}{sep(i)}<a class="pp-name-link" href="/person/{p.id}">{p.name}</a>{@render unverified(p)}{/each}
          {#if more > 0}<span class="pp-more"> +{more}</span>{/if}
        </span>
      </div>
    </div>
  {:else}
    <div class="pp-chips-section {klass}">
      <div class="pp-head">
        {#if label}<span class="pp-label">{label}</span>{/if}
      </div>
      <div class="ep-mobile-hosts-scroll">
        {#each people as p (p.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="ep-mobile-host-chip" title={p.name} onclick={() => open(p)}>
            <div class="pp-chip-avatar">
              <PersonAvatar img={p.img} alt={p.name} class="ep-mobile-host-avatar" placeholder="ep-mobile-host-placeholder" />
              {@render unverified(p)}
            </div>
            <span class="ep-mobile-host-name">{p.name}</span>
            <span class="ep-mobile-host-role">{p.role}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/if}
