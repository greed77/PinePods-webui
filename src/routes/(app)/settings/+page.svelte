<script lang="ts">
  // Port of upstream pages/settings.rs: User / Admin tabs of settings sections.
  // `?section=<id>` opens the user tab scrolled to that section.
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import * as E from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import SettingsSection from '$lib/settings/SettingsSection.svelte';
  import ThemeOptions from '$lib/settings/ThemeOptions.svelte';
  import CustomThemeCreator from '$lib/settings/CustomThemeCreator.svelte';
  import AccountSettings from '$lib/settings/AccountSettings.svelte';
  import PlaybackSettings from '$lib/settings/PlaybackSettings.svelte';
  import AutoDeleteSettings from '$lib/settings/AutoDeleteSettings.svelte';
  import AiSettings from '$lib/settings/AiSettings.svelte';
  import MfaSettings from '$lib/settings/MfaSettings.svelte';
  import ImportExport from '$lib/settings/ImportExport.svelte';
  import DisplaySettings from '$lib/settings/DisplaySettings.svelte';
  import NotificationSettings from '$lib/settings/NotificationSettings.svelte';
  import CustomFeed from '$lib/settings/CustomFeed.svelte';
  import LocalPodcast from '$lib/settings/LocalPodcast.svelte';
  import SyncSettings from '$lib/settings/SyncSettings.svelte';
  import FeedProblems from '$lib/settings/FeedProblems.svelte';
  import RssFeeds from '$lib/settings/RssFeeds.svelte';
  import PodcastIndexMatching from '$lib/settings/PodcastIndexMatching.svelte';
  import ApiKeys from '$lib/settings/ApiKeys.svelte';
  import SharedLinks from '$lib/settings/SharedLinks.svelte';
  import UserManagement from '$lib/settings/admin/UserManagement.svelte';
  import OidcSettings from '$lib/settings/admin/OidcSettings.svelte';
  import UpdateServices from '$lib/settings/admin/UpdateServices.svelte';
  import DownloadSettings from '$lib/settings/admin/DownloadSettings.svelte';
  import YtDlpSettings from '$lib/settings/admin/YtDlpSettings.svelte';
  import SelfService from '$lib/settings/admin/SelfService.svelte';
  import EmailSettings from '$lib/settings/admin/EmailSettings.svelte';
  import BackupServer from '$lib/settings/admin/BackupServer.svelte';
  import RestoreServer from '$lib/settings/admin/RestoreServer.svelte';

  let tab = $state<'user' | 'admin'>('user');
  let isAdmin = $state(false);
  let customThemes = $state(0);

  E.isUserAdmin()
    .then((v) => (isAdmin = v))
    .catch((e) => toast.error(`${t('settings.admin_check_error')}: ${(e as Error).message}`));

  $effect(() => {
    const section = page.url.searchParams.get('section');
    if (!section) return;
    tab = 'user';
    tick().then(() => setTimeout(() => document.getElementById(`settings-${section}`)?.scrollIntoView(), 150));
  });
</script>

<div class="main-container">
  <TopBar />
  <div class="my-4 settings-page">
    <div class="screen-title">{t('settings.settings')}</div>
    <div class="settings-tabs">
      <button class="settings-tab {tab === 'user' ? 'is-active' : ''}" onclick={() => (tab = 'user')}>{t('settings.user_settings')}</button>
      {#if isAdmin}
        <button class="settings-tab {tab === 'admin' ? 'is-active' : ''}" onclick={() => (tab = 'admin')}>{t('settings.admin_settings')}</button>
      {/if}
    </div>

    {#if tab === 'user'}
      <SettingsSection icon="ph-paint-roller" title={t('settings.change_theme')} info={t('settings.choose_preferred_theme')}>
        <ThemeOptions refresh={customThemes} />
      </SettingsSection>
      <SettingsSection icon="ph-palette" title={t('settings.custom_themes')} info="Create your own themes with custom colors">
        <CustomThemeCreator oncreated={() => customThemes++} />
      </SettingsSection>
      <SettingsSection icon="ph-user-circle" title={t('settings.account_settings')}>
        <AccountSettings />
      </SettingsSection>
      <SettingsSection icon="ph-play-circle" title={t('settings.playback_settings')} info={t('playback_settings.playback_preferences_description')}>
        <PlaybackSettings />
      </SettingsSection>
      <SettingsSection icon="ph-trash" title={t('settings.auto_delete_settings')} info={t('auto_delete_settings.description')}>
        <AutoDeleteSettings />
      </SettingsSection>
      <SettingsSection icon="ph-text-aa" title={t('settings.ai')}>
        <AiSettings />
      </SettingsSection>
      <SettingsSection icon="ph-shield-check" title={t('settings.mfa_settings')} info={t('mfa_settings.mfa_description')}>
        <MfaSettings />
      </SettingsSection>
      <SettingsSection icon="ph-download-simple" title={t('settings.export_backup_podcasts')} info={t('export_settings.export_description')}>
        <ImportExport mode="export" />
      </SettingsSection>
      <SettingsSection icon="ph-upload-simple" title={t('settings.import_podcasts')} info={t('import_options.import_description')}>
        <ImportExport mode="import" />
      </SettingsSection>
      <SettingsSection icon="ph-monitor" title={t('settings.display_settings')} info={t('start_page_options.start_page_description')}>
        <DisplaySettings />
      </SettingsSection>
      <SettingsSection icon="ph-bell-ringing" title={t('settings.notification_settings')}>
        <NotificationSettings />
      </SettingsSection>
      <SettingsSection icon="ph-rss" title={t('settings.add_custom_feed')} info={t('custom_feed.add_feed_description')}>
        <CustomFeed />
      </SettingsSection>
      <SettingsSection icon="ph-hard-drives" title={t('settings.add_local_podcast')} info={t('local_podcast.description')}>
        <LocalPodcast />
      </SettingsSection>
      <SettingsSection icon="ph-arrows-clockwise" title={t('settings.podcast_sync')} info={t('nextcloud_options.gpodder_sync_description')}>
        <SyncSettings />
      </SettingsSection>
      <SettingsSection icon="ph-warning-circle" title={t('feed_problems.title')} info={t('feed_problems.description')} id="feed_problems">
        <FeedProblems />
      </SettingsSection>
      <SettingsSection icon="ph-wifi" title={t('settings.enable_disable_rss_feeds')} info={t('rss_feeds.rss_feed_description')}>
        <RssFeeds />
      </SettingsSection>
      <SettingsSection icon="ph-magnifying-glass" title={t('settings.match_podcasts_podcast_index')}>
        <PodcastIndexMatching />
      </SettingsSection>
      <SettingsSection icon="ph-key" title={t('settings.api_keys')} info={t('api_keys.api_keys_description')}>
        <ApiKeys />
      </SettingsSection>
      <SettingsSection icon="ph-share-network" title={t('settings.shared_links')} info={t('shared_links.description')}>
        <SharedLinks />
      </SettingsSection>
    {:else}
      <SettingsSection icon="ph-users" title={t('settings.user_management')} info={t('settings.user_management_description')}>
        <UserManagement />
      </SettingsSection>
      <SettingsSection icon="ph-lock-key" title={t('settings.oidc_sso_settings')}>
        <OidcSettings />
      </SettingsSection>
      <SettingsSection icon="ph-broadcast" title={t('update_services.title')} info={t('update_services.description')}>
        <UpdateServices />
      </SettingsSection>
      <SettingsSection icon="ph-download-simple" title={t('settings.download_settings')} info={t('download_settings.server_download_description')}>
        <DownloadSettings />
      </SettingsSection>
      <SettingsSection icon="ph-youtube-logo" title={t('settings.ytdlp_management')}>
        <YtDlpSettings />
      </SettingsSection>
      <SettingsSection icon="ph-gear" title={t('settings.user_self_service_settings')} info={t('user_self_service.self_service_description')}>
        <SelfService />
      </SettingsSection>
      <SettingsSection icon="ph-envelope" title={t('settings.email_settings')} info={t('email_settings.email_settings_description')}>
        <EmailSettings />
      </SettingsSection>
      <SettingsSection icon="ph-database" title={t('settings.backup_server')}>
        <BackupServer />
      </SettingsSection>
      <SettingsSection icon="ph-database-backup" title={t('settings.restore_server')}>
        <RestoreServer />
      </SettingsSection>
    {/if}
  </div>
</div>
