<script lang="ts">
  // Port of upstream setting_components/ai_settings.rs: whether the optional
  // pinepods-ai sidecar is connected, and (admins) which models it uses plus pulling
  // new ones. Upstream's live job queue needs the task websocket, which isn't ported yet.
  import * as E from '$lib/api/endpoints';
  import type { AiModels, AiStatus } from '$lib/api/endpoints';
  import { toast } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let status = $state<AiStatus>({ available: false, transcription_ready: false, ad_removal_ready: false });
  let checked = $state(false);
  let isAdmin = $state(false);
  let models = $state<AiModels>({ whisper: [], llm_local: [] });

  let transcriptionModel = $state('');
  let backend = $state('local');
  let llmModel = $state('');
  let llmUrl = $state('');
  let llmApiKey = $state('');
  let hasApiKey = $state(false);
  let saving = $state(false);

  let pullKind = $state('gguf');
  let pullModel = $state('');
  let pullRepo = $state('');
  let pullFilename = $state('');

  async function load() {
    try {
      status = await E.getAiStatus();
    } catch {
      /* not connected */
    }
    checked = true;
    try {
      const s = await E.getAiSettings();
      transcriptionModel = s.transcription_model;
      backend = s.llm_backend || 'local';
      llmModel = s.llm_model ?? '';
      llmUrl = s.llm_url ?? '';
      hasApiKey = !!s.has_api_key;
      isAdmin = true;
    } catch {
      /* not an admin */
    }
    try {
      models = await E.getAiModels();
    } catch {
      /* sidecar missing */
    }
  }
  load();

  async function save() {
    saving = true;
    try {
      await E.updateAiSettings({
        transcription_model: transcriptionModel,
        llm_backend: backend,
        llm_model: llmModel || null,
        llm_url: llmUrl || null,
        llm_api_key: llmApiKey || null,
        clear_api_key: false
      });
      llmApiKey = '';
      toast.info(t('ai_settings.saved'));
      load();
    } catch (e) {
      toast.error(`${t('ai_settings.save_error')}: ${(e as Error).message}`);
    } finally {
      saving = false;
    }
  }

  async function pull() {
    try {
      await E.pullAiModel({
        kind: pullKind,
        model: pullModel,
        repo: pullRepo || null,
        filename: pullFilename || null,
        url: pullKind === 'ollama' ? llmUrl || null : null
      });
      toast.info(t('ai_settings.pull_started'));
    } catch (e) {
      toast.error(`${t('ai_settings.pull_error')}: ${(e as Error).message}`);
    }
  }

  const remote = $derived(backend === 'remote' || backend === 'anthropic');
  const placeholders = $derived(backend === 'anthropic' ? ['https://api.z.ai/api/anthropic', 'glm-4.6'] : ['http://ollama:11434/v1', 'qwen2.5:3b']);
</script>

{#snippet capability(label: string, ready: boolean)}
  <div class="settings-row">
    <div><div class="settings-row-label">{label}</div></div>
    <div class="settings-row-control">
      <span style="color:{ready ? 'var(--success-color)' : 'var(--text-secondary-color)'};font-weight:500;">
        {ready ? t('ai_settings.ready') : t('ai_settings.not_configured')}
      </span>
    </div>
  </div>
{/snippet}

<div class="settings-row">
  <div>
    <div class="settings-row-label">{t('ai_settings.ai_service')}</div>
    <div class="settings-row-desc">{t('ai_settings.intro')}</div>
  </div>
  <div class="settings-row-control">
    {#if status.available}
      <span style="color:var(--success-color);font-weight:500;">{t('ai_settings.connected')}</span>
    {:else if checked}
      <span style="color:var(--error-color);font-weight:500;">{t('ai_settings.not_connected')}</span>
    {:else}
      <span style="color:var(--text-secondary-color);">{t('ai_settings.checking')}</span>
    {/if}
  </div>
</div>
<div class="settings-section-subhead">{t('ai_settings.capabilities')}</div>
{@render capability(t('ai_settings.transcription'), status.transcription_ready)}
{@render capability(t('ai_settings.ad_removal'), status.ad_removal_ready)}

{#if isAdmin}
  <div class="settings-section-subhead">{t('ai_settings.transcription')}</div>
  <div class="settings-row">
    <div><div class="settings-row-label">{t('ai_settings.transcription_model')}</div></div>
    <div class="settings-row-control">
      <select class="select" style="width:280px;max-width:60vw;" bind:value={transcriptionModel} aria-label={t('ai_settings.transcription_model')}>
        {#if transcriptionModel && !models.whisper.includes(transcriptionModel)}<option value={transcriptionModel}>{transcriptionModel}</option>{/if}
        {#each models.whisper as m (m)}<option value={m}>{m}</option>{/each}
      </select>
    </div>
  </div>

  <div class="settings-section-subhead">{t('ai_settings.section_ad_detection')}</div>
  <div class="settings-row">
    <div class="ep-ad-notice" style="margin-top:0;">
      <i class="ph ph-info"></i>
      <div class="ep-ad-notice-body"><span>{t('ai_settings.dynamic_ads_note')}</span></div>
    </div>
  </div>
  {#if status.available && !status.ad_removal_ready}
    <div class="settings-row"><div><div class="settings-row-desc">{t('ai_settings.ad_removal_hint')}</div></div></div>
  {/if}
  <div class="settings-row">
    <div><div class="settings-row-label">{t('ai_settings.llm_backend')}</div></div>
    <div class="settings-row-control">
      <select class="select" style="width:280px;max-width:60vw;" bind:value={backend} aria-label={t('ai_settings.llm_backend')}>
        <option value="local">{t('ai_settings.backend_local')}</option>
        <option value="remote">{t('ai_settings.backend_remote')}</option>
        <option value="anthropic">{t('ai_settings.backend_anthropic')}</option>
      </select>
    </div>
  </div>
  {#if remote}
    <div class="settings-row">
      <div><div class="settings-row-label">{t('ai_settings.llm_url')}</div></div>
      <div class="settings-row-control">
        <input type="text" class="input" style="width:280px;max-width:60vw;" placeholder={placeholders[0]} bind:value={llmUrl} aria-label={t('ai_settings.llm_url')} />
      </div>
    </div>
    <div class="settings-row">
      <div><div class="settings-row-label">{t('ai_settings.llm_model_name')}</div></div>
      <div class="settings-row-control">
        <input type="text" class="input" style="width:280px;max-width:60vw;" placeholder={placeholders[1]} bind:value={llmModel} aria-label={t('ai_settings.llm_model_name')} />
      </div>
    </div>
    <div class="settings-row">
      <div><div class="settings-row-label">{t('ai_settings.llm_api_key')}</div></div>
      <div class="settings-row-control">
        <input
          type="password"
          class="input"
          style="width:280px;max-width:60vw;"
          placeholder={hasApiKey ? t('ai_settings.api_key_set') : ''}
          bind:value={llmApiKey}
          autocomplete="off"
          aria-label={t('ai_settings.llm_api_key')}
        />
      </div>
    </div>
  {:else}
    <div class="settings-row">
      <div><div class="settings-row-label">{t('ai_settings.llm_local_model')}</div></div>
      <div class="settings-row-control">
        <select class="select" style="width:280px;max-width:60vw;" bind:value={llmModel} aria-label={t('ai_settings.llm_local_model')}>
          <option value="">{t('ai_settings.select_model')}</option>
          {#if llmModel && !models.llm_local.includes(llmModel)}<option value={llmModel}>{llmModel}</option>{/if}
          {#each models.llm_local as m (m)}<option value={m}>{m}</option>{/each}
        </select>
      </div>
    </div>
  {/if}
  <div class="settings-row">
    <div></div>
    <div class="settings-row-control">
      <button class="btn btn-primary" onclick={save} disabled={saving}>
        <i class="ph ph-floppy-disk"></i><span>{saving ? t('ai_settings.saving') : t('ai_settings.save')}</span>
      </button>
    </div>
  </div>

  <div class="settings-section-subhead">{t('ai_settings.pull_model')}</div>
  <div class="settings-row">
    <div><div class="settings-row-label">{t('ai_settings.pull_model')}</div></div>
    <div class="settings-row-control" style="flex-wrap:wrap;">
      <select class="select" style="width:200px;" bind:value={pullKind} aria-label={t('ai_settings.pull_model')}>
        <option value="gguf">GGUF (Hugging Face)</option>
        <option value="whisper">Whisper</option>
        <option value="ollama">Ollama</option>
      </select>
      {#if pullKind === 'gguf'}
        <input type="text" class="input" style="width:200px;" placeholder={t('ai_settings.hf_repo')} bind:value={pullRepo} />
        <input type="text" class="input" style="width:200px;" placeholder={t('ai_settings.hf_filename')} bind:value={pullFilename} />
      {:else}
        <input type="text" class="input" style="width:200px;" placeholder={t('ai_settings.model_name')} bind:value={pullModel} />
      {/if}
      <button class="btn btn-primary" onclick={pull}><i class="ph ph-download-simple"></i><span>{t('ai_settings.pull')}</span></button>
    </div>
  </div>
{/if}
