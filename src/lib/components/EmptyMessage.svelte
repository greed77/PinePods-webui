<script lang="ts">
  let { header, paragraph }: { header: string; paragraph: string } = $props();
</script>

<div class="empty-episodes-container">
  <img src="/static/assets/favicon.png" alt="Logo" class="logo" />
  <h1 class="page-paragraphs">{header}</h1>
  <p class="page-paragraphs">{paragraph}</p>
</div>
