<script lang="ts">
  // Follow / unfollow toggle (upstream people.rs FollowButton). Optimistic; reverts
  // with a toast if the server says no.
  import * as E from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let {
    personId,
    followed,
    compact = false,
    onchange
  }: { personId: number; followed: boolean; compact?: boolean; onchange?: (following: boolean) => void } = $props();

  let following = $state(false);
  let busy = $state(false);
  $effect(() => {
    personId;
    following = followed;
  });

  async function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    const target = !following;
    following = target;
    busy = true;
    try {
      await E.setFollowing(personId, target);
      onchange?.(target);
    } catch (err) {
      following = !target;
      toast.error(`${t('people.follow_failed')}: ${(err as Error).message}`);
    } finally {
      busy = false;
    }
  }

  const title = $derived(following ? t('people.unfollow') : t('people.follow'));
</script>

<button
  type="button"
  class="pp-follow {following ? 'is-following' : ''} {compact ? 'is-compact' : ''}"
  {title}
  aria-label={title}
  aria-pressed={following}
  disabled={busy}
  onclick={toggle}
>
  <i class="ph {following ? 'ph-user-check' : 'ph-user-plus'}"></i>
  {#if !compact}<span>{following ? t('people.following') : t('people.follow')}</span>{/if}
</button>
