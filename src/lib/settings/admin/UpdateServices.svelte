<script lang="ts">
  // Port of upstream setting_components/update_services.rs: whether the search service
  // is reachable, and Podping (instant feed refreshes from Hive announcements).
  import * as E from '$lib/api/endpoints';
  import type { UpdateServices } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { fmtUnix } from '../syncFormat';

  let info = $state<UpdateServices | null>(null);
  let toggling = $state(false);
  let reload = $state(0);

  $effect(() => {
    reload;
    E.getUpdateServices().then((i) => (info = i), (e) => toast.error((e as Error).message));
  });

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    if (!info) return;
    toggling = true;
    try {
      info = await E.setPodping(!info.podping.enabled);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      toggling = false;
    }
  }

  const following = $derived(!!(info?.podping.relay as { following?: boolean } | null | undefined)?.following);
  const relayState = $derived.by(() => {
    const p = info?.podping;
    if (!p) return '';
    if (p.relay) return following ? t('update_services.relay_following') : t('update_services.relay_behind');
    return p.relay_error ? `${t('update_services.relay_unavailable')} ${p.relay_error}` : t('update_services.relay_unavailable');
  });
</script>

{#if !info}
  <div class="settings-row"><div class="settings-row-desc"><i class="ph ph-spinner animate-spin"></i></div></div>
{:else}
  {@const s = info.search}
  {@const p = info.podping}
  <div class="settings-row">
    <div style="min-width:0">
      <div class="settings-row-label">{t('update_services.search_title')}</div>
      <div class="settings-row-desc" style="overflow-wrap:anywhere">{s.url}</div>
      <div class="settings-row-desc">
        <i class="ph {s.reachable ? 'ph-check-circle' : 'ph-warning-circle'}"></i>
        {s.reachable ? t('update_services.reachable').replace('{ms}', String(s.latency_ms ?? 0)) : `${t('update_services.unreachable')} ${s.error ?? ''}`}
      </div>
    </div>
    <div class="settings-row-control">
      <button class="btn btn-ghost" onclick={() => reload++}><i class="ph ph-arrows-clockwise"></i>{t('update_services.check_again')}</button>
    </div>
  </div>
  <div class="settings-row">
    <div>
      <div class="settings-row-label">{t('update_services.podping_toggle')}</div>
      <div class="settings-row-desc">{t('update_services.podping_desc')}</div>
    </div>
    <div class="settings-row-control">
      <label class="toggle">
        <input type="checkbox" checked={p.enabled} disabled={toggling} onclick={toggle} aria-label={t('update_services.podping_toggle')} />
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
      </label>
      {#if toggling}<i class="ph ph-spinner animate-spin"></i>{/if}
    </div>
  </div>
  {#if p.enabled}
    <div class="settings-row">
      <div style="min-width:0">
        <div class="settings-row-desc" style="overflow-wrap:anywhere">{t('update_services.relay')} {p.relay_url}</div>
        <div class="settings-row-desc">{relayState}</div>
        <div class="settings-row-desc">
          {t('update_services.client_stats')
            .replace('{pings}', String(p.client.pings_seen))
            .replace('{feeds}', String(p.client.feeds_refreshed))
            .replace('{time}', fmtUnix(p.client.last_success_at, t('update_services.never')))}
        </div>
        {#if p.client.last_error}<div class="settings-row-desc">{t('update_services.last_error')} {p.client.last_error}</div>{/if}
      </div>
    </div>
  {/if}
{/if}
