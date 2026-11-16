<script lang="ts">
  import { toast } from '$lib/stores/app.svelte';
</script>

<div class="toast-container">
  {#if toast.current}
    {@const c = toast.current}
    {#key c.id}
      <div class="toast-item toast-visible">
        <div class="toast {c.kind === 'error' ? 'toast-error' : 'toast-info'}">
          <div class="flex items-center justify-between">
            <div class="item_conatiner-text flex items-center">
              <i class="{c.kind === 'error' ? 'ph ph-warning-circle' : 'ph ph-info'} item_container-text text-xl mr-2"></i>
              <p class="toast-message">{c.text}</p>
            </div>
            <button class="toast-dismiss text-lg ml-2" onclick={() => toast.dismiss()} aria-label="Dismiss">
              <i class="ph ph-x"></i>
            </button>
          </div>
        </div>
      </div>
    {/key}
  {/if}
</div>
