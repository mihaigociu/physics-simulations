<script lang="ts">
  /** Copies the page URL (which holds the current setup) to the clipboard. */
  import { t, type Locale } from '../i18n';

  let { lang }: { lang: Locale } = $props();
  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Clipboard can be blocked; the address bar still has the link
    }
  }
</script>

<button type="button" class="share" onclick={copy} aria-live="polite">
  {copied ? t(lang, 'ui.copied') : t(lang, 'ui.copyLink')}
</button>

<style>
  .share {
    min-height: var(--touch);
    padding-inline: var(--space-4);
    border: 2px solid var(--border);
    border-radius: 999px;
    background: var(--surface-raised);
    color: var(--brand);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }
</style>
