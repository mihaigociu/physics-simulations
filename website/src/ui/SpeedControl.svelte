<script module lang="ts">
  /** Preset speeds; slow motion matters more than fast-forward for teaching. */
  export const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4];
</script>

<script lang="ts">
  import { t, type Locale } from '../i18n';
  import { formatNumber } from '../shared/format';

  interface Props {
    lang: Locale;
    value: number;
    onchange: (speed: number) => void;
    /** Preset speeds to step through (default SPEEDS). */
    speeds?: readonly number[];
  }

  let { lang, value, onchange, speeds = SPEEDS }: Props = $props();

  const index = $derived(speeds.indexOf(value));
  // 0.25× and 0.5× (not 0.50×); whole numbers keep their zeros (10×, 20×)
  const label = $derived(`${value < 1 ? formatNumber(lang, value, 2).replace(/0$/, '') : formatNumber(lang, value, 0)}×`);
</script>

<div class="speed" role="group" aria-label={t(lang, 'ui.speed')}>
  <span class="title">{t(lang, 'ui.speed')}</span>
  <button type="button" aria-label={t(lang, 'ui.slower')} disabled={index <= 0} onclick={() => onchange(speeds[index - 1]!)}>−</button>
  <output aria-live="polite">{label}</output>
  <button type="button" aria-label={t(lang, 'ui.faster')} disabled={index >= speeds.length - 1} onclick={() => onchange(speeds[index + 1]!)}>+</button>
</div>

<style>
  .speed {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .title {
    font-size: var(--text-sm);
    color: var(--ink-2);
    font-weight: 700;
  }

  button {
    width: var(--touch);
    height: var(--touch);
    border: 2px solid var(--border);
    border-radius: 50%;
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  output {
    min-width: 3.2em;
    text-align: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
