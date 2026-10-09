<script lang="ts">
  import { PLANETS, type PlanetId } from '../shared/planets';
  import { t, type Locale } from '../i18n';
  import { formatNumber } from '../shared/format';

  interface Props {
    lang: Locale;
    value: PlanetId;
    onchange: (id: PlanetId) => void;
  }

  let { lang, value, onchange }: Props = $props();
</script>

<div class="picker" role="radiogroup" aria-label={t(lang, 'ui.world')}>
  {#each PLANETS as p, i (p.id)}
    <button
      type="button"
      role="radio"
      aria-checked={value === p.id}
      style:--accent={p.accent}
      style:--sky={p.sky}
      onclick={() => value !== p.id && onchange(p.id)}
    >
      <span class="name">{t(lang, `planets.${p.id}`)}</span>
      <span class="g">g = {formatNumber(lang, p.g, 2)}</span>
      <kbd aria-hidden="true">{i + 1}</kbd>
    </button>
  {/each}
</div>

<style>
  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  button {
    position: relative;
    display: grid;
    justify-items: start;
    min-height: var(--touch);
    min-width: 6.5rem;
    padding: var(--space-1) var(--space-4);
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
    line-height: 1.2;
    text-align: left;
    cursor: pointer;
  }

  button[aria-checked='true'] {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
  }

  .name {
    font-weight: 700;
  }

  .g {
    font-size: var(--text-sm);
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
  }

  kbd {
    position: absolute;
    top: 4px;
    right: 6px;
    font: inherit;
    font-size: 0.7rem;
    opacity: 0.55;
  }

  @media (hover: none) {
    kbd {
      display: none;
    }
  }
</style>
