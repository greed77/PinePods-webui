<script lang="ts">
  // A person's picture through the server's image proxy, or a user icon when there's
  // none or it fails to load (upstream components/people.rs PersonAvatar).
  import { proxiedImage } from '$lib/api/endpoints';

  let {
    img,
    alt = '',
    class: klass,
    placeholder
  }: { img: string | null | undefined; alt?: string; class: string; placeholder: string } = $props();

  let failed = $state(false);
  $effect(() => {
    img;
    failed = false;
  });
</script>

{#if img && !failed}
  <img src={proxiedImage(img)} {alt} class={klass} loading="lazy" onerror={() => (failed = true)} />
{:else}
  <div class="{klass} {placeholder}"><i class="ph ph-user"></i></div>
{/if}
