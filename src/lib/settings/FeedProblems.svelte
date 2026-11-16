<script lang="ts">
  // Port of upstream setting_components/feed_problems.rs: subscribed feeds that keep
  // failing to refresh, and feeds from sync apps that couldn't be added. (Upstream's
  // "stop refreshing" needs a newer server than 0.9.2, so it's left out.)
  import * as E from '$lib/api/endpoints';
  import type { FailingFeed, FeedProblems, ImportFailure } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let problems = $state<FeedProblems | null>(null);
  let busy = $state<string | null>(null);
  let reload = $state(0);

  $effect(() => {
    reload;
    E.getFeedProblems().then((p) => (problems = p), (e) => toast.error((e as Error).message));
  });

  const KINDS: Record<string, string> = {
    gone: 'feed_problems.kind_gone',
    auth: 'feed_problems.kind_auth',
    not_feed: 'feed_problems.kind_not_feed',
    unreachable: 'feed_problems.kind_unreachable',
    server: 'feed_problems.kind_server',
    throttled: 'feed_problems.kind_throttled'
  };
  const kind = (k: string) => t(KINDS[k] ?? 'feed_problems.kind_other');
  const fmt = (secs: number) => new Date(secs * 1000).toLocaleString();

  async function run(row: string, call: () => Promise<unknown>, done?: string) {
    busy = row;
    try {
      await call();
      if (done) toast.info(done);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      busy = null;
      reload++;
    }
  }

  const unsubscribe = (f: FailingFeed) =>
    confirm(t('feed_problems.unsubscribe_confirm').replace('{name}', f.name)) && run(`feed-${f.podcast_id}`, () => E.removePodcast(f.podcast_id));
  const removeImport = (f: ImportFailure) => confirm(t('feed_problems.remove_import_confirm')) && run(`import-${f.id}`, () => E.removeImport(f.id));
</script>

{#if !problems}
  <div class="settings-row"><div class="settings-row-desc"><i class="ph ph-spinner animate-spin"></i></div></div>
{:else if problems.feeds.length === 0 && problems.imports.length === 0}
  <div class="settings-row"><div class="settings-row-desc">{t('feed_problems.none')}</div></div>
{:else}
  {#if problems.feeds.length}
    <div class="settings-subsection-title">{t('feed_problems.feeds_title')}</div>
    {#each problems.feeds as f (f.podcast_id)}
      {@const working = busy === `feed-${f.podcast_id}`}
      <div class="settings-row">
        <div>
          <div class="settings-row-label">{f.name}</div>
          <div class="settings-row-desc">{kind(f.kind)}</div>
          <div class="settings-row-desc">
            {t('feed_problems.failing_since')
              .replace('{time}', f.failing_since ? fmt(f.failing_since) : '')
              .replace('{count}', String(f.failures))}
          </div>
          {#if f.error}<div class="settings-row-desc"><code class="sync-code">{f.error}</code></div>{/if}
        </div>
        <div class="settings-row-control">
          <button class="btn btn-ghost" disabled={working} onclick={() => run(`feed-${f.podcast_id}`, () => E.refreshFailingFeed(f.podcast_id))}>
            <i class="ph {working ? 'ph-spinner animate-spin' : 'ph-arrows-clockwise'}"></i>{t('feed_problems.refresh_now')}
          </button>
          <button class="btn btn-ghost" disabled={working} onclick={() => unsubscribe(f)}><i class="ph ph-trash"></i>{t('feed_problems.unsubscribe')}</button>
        </div>
      </div>
    {/each}
  {/if}
  {#if problems.imports.length}
    <div class="settings-subsection-title">{t('feed_problems.imports_title')}</div>
    <div class="settings-row"><div class="settings-row-desc">{t('feed_problems.imports_desc')}</div></div>
    {#each problems.imports as f (f.id)}
      {@const working = busy === `import-${f.id}`}
      <div class="settings-row">
        <div style="min-width:0">
          <div class="settings-row-label" style="overflow-wrap:anywhere">{f.feed_url}</div>
          <div class="settings-row-desc">{f.source === 'target' ? t('feed_problems.from_external') : t('feed_problems.from_app')} · {kind(f.kind)}</div>
          <div class="settings-row-desc">
            {f.next_attempt_at != null ? t('feed_problems.next_retry').replace('{time}', fmt(f.next_attempt_at)) : t('feed_problems.gave_up')}
          </div>
        </div>
        <div class="settings-row-control">
          <button class="btn btn-ghost" disabled={working} onclick={() => run(`import-${f.id}`, () => E.retryImport(f.id), t('feed_problems.retry_started'))}>
            <i class="ph {working ? 'ph-spinner animate-spin' : 'ph-arrows-clockwise'}"></i>{t('feed_problems.retry')}
          </button>
          <button class="btn btn-ghost" disabled={working} onclick={() => removeImport(f)}><i class="ph ph-trash"></i>{t('feed_problems.unsubscribe')}</button>
          <button class="btn btn-ghost" disabled={working} onclick={() => run(`import-${f.id}`, () => E.dismissImport(f.id))}><i class="ph ph-x"></i>{t('feed_problems.dismiss')}</button>
        </div>
      </div>
    {/each}
  {/if}
{/if}
