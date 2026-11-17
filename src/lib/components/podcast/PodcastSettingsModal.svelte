<script lang="ts">
  // Port of upstream episode_layout.rs "Podcast Options" window: per-podcast toggles,
  // playback speed and auto-delete overrides (with custom/global badges), skip times,
  // silence trimming, AI auto-transcribe/ad-detect, the YouTube retention limit and
  // video filter, and categories. Toggles save at once; number fields save with
  // their button. Upstream's "refresh automatically" switch needs a newer server
  // than 0.9.2 and is left out.
  import * as E from '$lib/api/endpoints';
  import type { PodcastDetails, VideoFilter } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import ModalFrame from '../ModalFrame.svelte';
  import { untrack } from 'svelte';

  let {
    podcast,
    onclose,
    onedit,
    onchanged
  }: {
    podcast: PodcastDetails;
    onclose: () => void;
    /** Open the "Edit Podcast Info" window instead. */
    onedit: () => void;
    /** The podcast's details changed on the server (categories, feed refresh). */
    onchanged: () => Promise<void> | void;
  } = $props();

  // The window reads the podcast's values once when it opens.
  const start = untrack(() => podcast);
  const id = start.podcastid;
  const isYoutube = !!start.isyoutubechannel;

  type ToggleKey = 'download' | 'playNext' | 'queue' | 'notify' | 'favorite' | 'covers' | 'transcribe' | 'adDetect' | 'adSkip';
  let on = $state<Record<ToggleKey, boolean>>({
    download: !!start.autodownload,
    playNext: false,
    queue: false,
    notify: !!start.notificationsenabled,
    favorite: !!start.is_favorite,
    covers: false,
    transcribe: false,
    adDetect: false,
    adSkip: false
  });
  const setters: Record<ToggleKey, (v: boolean) => Promise<unknown>> = {
    download: (v) => E.setAutoDownload(id, v),
    playNext: (v) => E.setAutoPlayNext(id, v),
    queue: (v) => E.setAutoQueue(id, v),
    notify: (v) => E.setPodcastNotifications(id, v),
    favorite: (v) => E.setPodcastFavorite(id, v),
    covers: (v) => E.setPodcastCoverPref(id, v),
    transcribe: (v) => E.setAutoTranscribe(id, v),
    adDetect: (v) => E.setAutoAdDetect(id, v),
    adSkip: (v) => E.setAdSkipAutoActivate(id, v)
  };

  let speed = $state('1.0');
  let speedCustom = $state(false);
  let deleteDays = $state('0');
  let deleteCustom = $state(false);
  let deleteOnComplete = $state<'default' | 'on' | 'off'>('default');
  let deleteOnCompleteDefault = $state(false);
  let startSkip = $state('0');
  let endSkip = $state('0');
  let trim = $state(false);
  let threshold = $state(2);
  let aiAvailable = $state(false);
  let cutoffDays = $state('0');
  let filterMin = $state('');
  let filterMax = $state('');
  let filterTitle = $state('');
  let newCategory = $state('');
  let refreshing = $state(false);

  // Each read is independent: one failing (say the AI sidecar being down) leaves the rest.
  const load = <T,>(p: Promise<T>, apply: (v: T) => void) => p.then(apply, (e) => console.warn('Podcast settings:', e));
  load(E.getAutoDownload(id), (v) => (on.download = v));
  load(E.getAutoPlayNext(id), (v) => (on.playNext = !!v));
  load(E.getAutoQueue(id), (v) => (on.queue = v));
  load(E.getPodcastNotifications(id), (v) => (on.notify = v));
  load(E.getPodcastFavorite(id), (v) => (on.favorite = v));
  load(E.getPodcastCoverPref(id), (v) => (on.covers = v));
  const loadPlayDetails = () =>
    load(E.getPlayEpisodeDetails(id, isYoutube), (d) => {
      speed = d.playback_speed.toFixed(1);
      speedCustom = d.playback_speed_customized;
      startSkip = String(d.start_skip);
      endSkip = String(d.end_skip);
    });
  loadPlayDetails();
  const loadDeleteDays = () =>
    load(E.getPodcastAutoDeleteDays(id), (d) => {
      deleteDays = String(d.days);
      deleteCustom = d.customized;
    });
  loadDeleteDays();
  load(E.getDeleteOnComplete(), (d) => (deleteOnCompleteDefault = d.enabled));
  load(E.getDeleteOnComplete(id), (d) => (deleteOnComplete = !d.customized ? 'default' : d.enabled ? 'on' : 'off'));
  load(E.getSilenceTrim(id), (d) => {
    trim = d.enabled;
    threshold = d.threshold || 2;
  });
  load(E.getAiStatus(), (s) => {
    aiAvailable = s.available;
    if (!s.available) return;
    load(E.getAutoTranscribe(id), (v) => (on.transcribe = v));
    load(E.getAutoAdDetect(id), (v) => (on.adDetect = v));
    load(E.getAdSkipAutoActivate(id), (v) => (on.adSkip = v));
  });
  if (isYoutube) {
    load(E.getFeedCutoffDays(id), (v) => (cutoffDays = String(v)));
    load(E.getVideoFilter(id), (f) => {
      filterMin = f.min_minutes?.toString() ?? '';
      filterMax = f.max_minutes?.toString() ?? '';
      filterTitle = f.title_contains ?? '';
    });
  }

  async function flip(key: ToggleKey) {
    const v = !on[key];
    on[key] = v;
    try {
      await setters[key](v);
    } catch (e) {
      on[key] = !v;
      toast.error(`Error: ${(e as Error).message}`);
    }
  }

  /** Runs a save, showing `done` on success and the error otherwise. */
  async function save(fn: () => Promise<unknown>, done: string, fail = 'Error') {
    try {
      await fn();
      if (done) toast.info(done);
      return true;
    } catch (e) {
      toast.error(`${fail}: ${(e as Error).message}`);
      return false;
    }
  }

  /** Whole number, at least 0; blank or garbage counts as 0. */
  const whole = (s: string) => Math.max(0, Math.trunc(Number(s)) || 0);

  async function saveSpeed() {
    const v = Math.min(2, Math.max(0.5, Math.round((Number(speed) || 1) * 10) / 10));
    speed = v.toFixed(1);
    if (await save(() => E.setPodcastPlaybackSpeed(id, v), t('episodes_layout.playback_speed_updated'), t('episodes_layout.error_updating_playback_speed')))
      speedCustom = true;
  }
  async function resetSpeed() {
    if (await save(() => E.clearPodcastPlaybackSpeed(id), t('episodes_layout.playback_speed_updated'), t('episodes_layout.error_updating_playback_speed')))
      loadPlayDetails();
  }
  async function saveDeleteDays() {
    const days = whole(deleteDays);
    deleteDays = String(days);
    if (await save(() => E.setPodcastAutoDeleteDays(id, days), t('episodes_layout.auto_delete_updated'), t('episodes_layout.error_updating_auto_delete')))
      deleteCustom = true;
  }
  async function resetDeleteDays() {
    if (await save(() => E.clearPodcastAutoDeleteDays(id), t('episodes_layout.auto_delete_updated'), t('episodes_layout.error_updating_auto_delete')))
      loadDeleteDays();
  }
  async function changeDeleteOnComplete(value: 'default' | 'on' | 'off') {
    const prev = deleteOnComplete;
    deleteOnComplete = value;
    if (!(await save(() => E.setPodcastDeleteOnComplete(id, value === 'default' ? null : value === 'on'), ''))) deleteOnComplete = prev;
  }
  async function saveSkips() {
    const s = whole(startSkip);
    const e = whole(endSkip);
    startSkip = String(s);
    endSkip = String(e);
    await save(() => E.setSkipTimes(id, s, e), t('episodes_layout.skip_times_adjusted'));
  }
  const saveTrim = () => save(() => E.setSilenceTrim(id, trim, threshold), t('episodes_layout.silence_trim_updated'), t('episodes_layout.silence_trim_error'));
  async function saveCutoff() {
    const days = whole(cutoffDays);
    cutoffDays = String(days);
    await save(() => E.setFeedCutoffDays(id, days), t('episodes_layout.youtube_episode_limit_updated'));
  }
  async function saveFilter() {
    const minutes = (s: string) => (s.trim() === '' ? null : whole(s));
    const f: VideoFilter = { min_minutes: minutes(filterMin), max_minutes: minutes(filterMax), title_contains: filterTitle.trim() || null };
    await save(() => E.setVideoFilter(id, f), t('episodes_layout.youtube_filter_saved'), t('episodes_layout.youtube_filter_error'));
  }

  // Unique, non-blank category names.
  const categories = $derived([...new Set(Object.values(podcast.categories ?? {}).map((c) => c.trim()).filter(Boolean))]);
  async function addCategory(e: Event) {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    if (await save(() => E.addCategory(id, name), '')) {
      newCategory = '';
      await onchanged();
    }
  }
  async function removeCategory(name: string) {
    if (await save(() => E.removeCategory(id, name), '')) await onchanged();
  }

  async function refreshFromFeed() {
    refreshing = true;
    try {
      await E.refreshPodcastDetails(id, false);
      await onchanged();
      toast.info(t('episodes_layout.details_refreshed'));
      onclose();
    } catch (e) {
      toast.error(`${t('episodes_layout.details_refresh_failed')}: ${(e as Error).message}`);
    } finally {
      refreshing = false;
    }
  }
</script>

{#snippet toggle(key: ToggleKey, label: string, disabled = false)}
  <label class="inline-flex relative items-center {disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}">
    <input type="checkbox" checked={on[key]} {disabled} class="sr-only peer" aria-label={label} onchange={() => flip(key)} />
    <div
      class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"
    ></div>
  </label>
{/snippet}

{#snippet labeledToggle(key: ToggleKey, label: string)}
  <div>
    <span class="block mb-2 text-sm font-medium">{label}</span>
    {@render toggle(key, label)}
  </div>
{/snippet}

{#snippet badge(custom: boolean, customText: string, globalText: string)}
  <div class="mt-2">
    {#if custom}
      <span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        <i class="ph ph-pencil-simple"></i>{customText}
      </span>
    {:else}
      <span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
        <i class="ph ph-globe"></i>{globalText}
      </span>
    {/if}
  </div>
{/snippet}

<ModalFrame title={t('episodes_layout.podcast_options')} {onclose}>
  <div class="space-y-4">
    {@render labeledToggle('download', t('episodes_layout.download_future_episodes'))}
    {@render labeledToggle('playNext', t('episodes_layout.auto_play_next_episode'))}
    {@render labeledToggle('queue', t('episodes_layout.auto_queue_new_episodes'))}
    {@render labeledToggle('notify', t('episodes_layout.get_notifications_new_episodes'))}
    {@render labeledToggle('favorite', t('episodes_layout.favorite_podcast'))}

    <div class="mt-4">
      <label for="playback-speed" class="block mb-2 text-sm font-medium">{t('episodes_layout.default_playback_speed')}</label>
      <div class="flex items-center space-x-2">
        <input type="number" id="playback-speed" bind:value={speed} class="email-input border text-sm rounded-lg p-2.5 w-20" min="0.5" max="2.0" step="0.1" />
        <span class="text-sm">x</span>
        <button type="button" class="save-button font-bold py-2 px-4 rounded" onclick={saveSpeed}>{t('episodes_layout.save')}</button>
        <button type="button" class="clear-button bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded" onclick={resetSpeed}>
          {t('episodes_layout.reset')}
        </button>
      </div>
      {@render badge(speedCustom, t('episodes_layout.playback_speed_custom_badge'), t('episodes_layout.playback_speed_global_badge'))}
      <p class="text-xs text-gray-500 mt-1">{t('episodes_layout.playback_speed_description')}</p>
    </div>

    <div class="mt-4">
      <label for="auto-delete-days" class="block mb-2 text-sm font-medium">{t('episodes_layout.auto_delete_label')}</label>
      <div class="flex items-center space-x-2">
        <input type="number" id="auto-delete-days" bind:value={deleteDays} class="email-input border text-sm rounded-lg p-2.5 w-20" min="0" max="3650" step="1" />
        <span class="text-sm">{t('episodes_layout.auto_delete_days_unit')}</span>
        <button type="button" class="save-button font-bold py-2 px-4 rounded" onclick={saveDeleteDays}>{t('episodes_layout.save')}</button>
        <button type="button" class="clear-button bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded" onclick={resetDeleteDays}>
          {t('episodes_layout.reset')}
        </button>
      </div>
      {@render badge(deleteCustom, t('episodes_layout.auto_delete_custom_badge'), t('episodes_layout.auto_delete_global_badge'))}
      <p class="text-xs text-gray-500 mt-1">{t('episodes_layout.auto_delete_description')}</p>
    </div>

    <div class="mt-4">
      <label for="delete-on-complete" class="block mb-2 text-sm font-medium">{t('episodes_layout.delete_on_complete_label')}</label>
      <select
        id="delete-on-complete"
        class="email-input border text-sm rounded-lg p-2.5"
        value={deleteOnComplete}
        onchange={(e) => changeDeleteOnComplete(e.currentTarget.value as typeof deleteOnComplete)}
      >
        <option value="default">
          {deleteOnCompleteDefault ? t('episodes_layout.delete_on_complete_default_on') : t('episodes_layout.delete_on_complete_default_off')}
        </option>
        <option value="on">{t('episodes_layout.delete_on_complete_on')}</option>
        <option value="off">{t('episodes_layout.delete_on_complete_off')}</option>
      </select>
      <p class="text-xs text-gray-500 mt-1">{t('episodes_layout.delete_on_complete_description')}</p>
    </div>

    <div class="mt-4">
      <span class="block mb-2 text-sm font-medium">{t('episodes_layout.use_podcast_covers')}</span>
      {@render toggle('covers', t('episodes_layout.use_podcast_covers'))}
      <p class="text-xs text-gray-500 mt-1">{t('episodes_layout.podcast_cover_hint')}</p>
    </div>

    <div class="mt-4">
      <span class="block mb-2 text-sm font-medium">{t('episodes_layout.auto_skip_intros_outros')}</span>
      <div class="flex items-center space-x-2">
        <div class="flex items-center space-x-2">
          <label for="start-skip" class="block text-sm font-medium">{t('episodes_layout.start_skip_seconds')}</label>
          <input type="number" id="start-skip" min="0" bind:value={startSkip} class="email-input border text-sm rounded-lg p-2.5 w-16" />
        </div>
        <div class="flex items-center space-x-2">
          <label for="end-skip" class="block text-sm font-medium">{t('episodes_layout.end_skip_seconds')}</label>
          <input type="number" id="end-skip" min="0" bind:value={endSkip} class="email-input border text-sm rounded-lg p-2.5 w-16" />
        </div>
        <button type="button" class="download-button font-bold py-2 px-4 rounded" onclick={saveSkips}>{t('episodes_layout.confirm')}</button>
      </div>
    </div>

    <div class="mt-4">
      <span class="block mb-2 text-sm font-medium">{t('episodes_layout.trim_silence')}</span>
      <label class="inline-flex relative items-center cursor-pointer">
        <input type="checkbox" id="trim-silence" bind:checked={trim} class="sr-only peer" aria-label={t('episodes_layout.trim_silence')} />
        <div
          class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"
        ></div>
        <span class="ms-3 text-sm">{t('episodes_layout.trim_silence_desc')}</span>
      </label>
      <div class="flex items-center space-x-2 mt-3">
        <label for="silence-threshold" class="block text-sm font-medium">{t('episodes_layout.aggressiveness')}</label>
        <select id="silence-threshold" class="email-input border text-sm rounded-lg p-2.5" bind:value={threshold}>
          <option value={1}>{t('episodes_layout.silence_low')}</option>
          <option value={2}>{t('episodes_layout.silence_medium')}</option>
          <option value={3}>{t('episodes_layout.silence_high')}</option>
        </select>
        <button type="button" class="download-button font-bold py-2 px-4 rounded" onclick={saveTrim}>{t('episodes_layout.confirm')}</button>
      </div>
    </div>

    {#if aiAvailable}
      <div class="mt-4">
        <span class="block mb-2 text-sm font-medium">{t('episodes_layout.auto_transcribe')}</span>
        <div class="flex items-center">
          {@render toggle('transcribe', t('episodes_layout.auto_transcribe'))}
          <span class="ms-3 text-sm">{t('episodes_layout.auto_transcribe_desc')}</span>
        </div>
      </div>
      <div class="mt-4">
        <span class="block mb-2 text-sm font-medium">{t('episodes_layout.auto_ad_detect')}</span>
        <div class="flex items-center">
          {@render toggle('adDetect', t('episodes_layout.auto_ad_detect'), !on.transcribe)}
          <span class="ms-3 text-sm">{t('episodes_layout.auto_ad_detect_desc')}</span>
        </div>
        {#if on.adDetect && !on.download}
          <div class="ep-ad-notice">
            <i class="ph ph-warning"></i>
            <div class="ep-ad-notice-body">
              <span>{t('episodes_layout.auto_ad_detect_needs_download')}</span>
              <div class="ep-ad-notice-actions">
                <button type="button" class="ep-ai-transcript-btn" onclick={() => flip('download')}>
                  <i class="ph ph-cloud-arrow-down"></i>{t('episodes_layout.auto_ad_detect_enable_download')}
                </button>
              </div>
            </div>
          </div>
        {:else if on.adDetect}
          <div class="ep-ad-notice is-ok">
            <i class="ph ph-check-circle"></i>
            <div class="ep-ad-notice-body"><span>{t('episodes_layout.auto_ad_detect_download_ok')}</span></div>
          </div>
        {/if}
        {#if on.transcribe && on.adDetect}
          <div class="flex items-center mt-3">
            {@render toggle('adSkip', t('episodes_layout.ad_skip_auto_activate_desc'))}
            <span class="ms-3 text-sm">{t('episodes_layout.ad_skip_auto_activate_desc')}</span>
          </div>
        {/if}
      </div>
    {/if}

    {#if isYoutube}
      <div class="mt-4">
        <label for="feed-cutoff" class="block mb-2 text-sm font-medium">{t('episodes_layout.youtube_download_limit')}</label>
        <div class="flex items-center space-x-2">
          <input type="number" id="feed-cutoff" min="0" bind:value={cutoffDays} class="email-input border text-sm rounded-lg p-2.5 w-24" />
          <span class="text-sm text-gray-500">0 = No limit</span>
          <button type="button" class="download-button font-bold py-2 px-4 rounded" onclick={saveCutoff}>{t('episodes_layout.save')}</button>
        </div>
        <p class="text-xs text-gray-500 mt-1">{t('episodes_layout.youtube_limit_description')}</p>
        <div class="mt-4">
          <span class="block mb-2 text-sm font-medium">{t('episodes_layout.youtube_video_filter')}</span>
          <div class="flex flex-wrap items-end gap-2">
            <div>
              <label for="yt-min-minutes" class="block mb-1 text-xs">{t('episodes_layout.youtube_min_minutes')}</label>
              <input type="number" id="yt-min-minutes" min="0" bind:value={filterMin} class="email-input border text-sm rounded-lg p-2.5 w-24" />
            </div>
            <div>
              <label for="yt-max-minutes" class="block mb-1 text-xs">{t('episodes_layout.youtube_max_minutes')}</label>
              <input type="number" id="yt-max-minutes" min="0" bind:value={filterMax} class="email-input border text-sm rounded-lg p-2.5 w-24" />
            </div>
            <div class="flex-1 min-w-[10rem]">
              <label for="yt-title-contains" class="block mb-1 text-xs">{t('episodes_layout.youtube_title_contains')}</label>
              <input
                type="text"
                id="yt-title-contains"
                maxlength="255"
                bind:value={filterTitle}
                placeholder={t('episodes_layout.youtube_title_placeholder')}
                class="email-input border text-sm rounded-lg p-2.5 w-full"
              />
            </div>
            <button type="button" class="download-button font-bold py-2 px-4 rounded" onclick={saveFilter}>{t('episodes_layout.save')}</button>
          </div>
          <p class="text-xs text-gray-500 mt-1">{t('episodes_layout.youtube_filter_description')}</p>
        </div>
      </div>
    {/if}

    <div>
      <span class="block mb-2 text-sm font-medium">{t('episodes_layout.adjust_podcast_categories')}</span>
      <div class="flex flex-wrap gap-2">
        {#each categories as c (c)}
          <div class="category-tag">
            <span>{c}</span>
            <button type="button" class="category-remove-btn" aria-label="Remove {c}" onclick={() => removeCategory(c)}>
              <i class="ph ph-trash text-lg"></i>
            </button>
          </div>
        {:else}
          <p class="text-sm text-muted">{t('episodes_layout.no_categories_available')}</p>
        {/each}
      </div>
      <form class="relative mt-4" onsubmit={addCategory}>
        <input
          type="text"
          id="new_category"
          class="category-input w-full px-4 py-3 pr-24 rounded-lg border"
          placeholder={t('episodes_layout.new_category_placeholder')}
          aria-label={t('episodes_layout.new_category_placeholder')}
          bind:value={newCategory}
        />
        <!-- The text label is hidden on phones, so name it for screen readers. -->
        <button type="submit" class="category-add-btn" aria-label="Add category" disabled={!newCategory.trim()}>
          <i class="ph ph-plus text-lg"></i>
          <span class="hidden md:inline">{t('episodes_layout.add')}</span>
        </button>
      </form>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button type="button" class="download-button font-bold py-2 px-4 rounded" onclick={onedit}>{t('episodes_layout.modify_podcast_info')}</button>
      <button type="button" class="download-button font-bold py-2 px-4 rounded" disabled={refreshing} onclick={refreshFromFeed}>
        {t('episodes_layout.refresh_from_feed')}
      </button>
    </div>
  </div>
</ModalFrame>
