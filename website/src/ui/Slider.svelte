<script lang="ts">
  /**
   * Large, touch-friendly slider. The thumb can move on a different scale
   * from the value (e.g. logarithmic masses) via `toPosition`/`fromPosition`.
   */
  interface Props {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    /** Value shown next to the label. */
    display: string;
    color?: string;
    toPosition?: (value: number) => number;
    fromPosition?: (position: number) => number;
    onchange?: (value: number) => void;
  }

  let {
    label,
    value = $bindable(),
    min,
    max,
    step = 1,
    display,
    color = 'var(--brand)',
    toPosition,
    fromPosition,
    onchange,
  }: Props = $props();

  const id = $props.id();
  // With a custom scale the native input runs 0..1000 and we map it
  const scaled = $derived(Boolean(toPosition && fromPosition));
  const position = $derived(scaled ? Math.round(toPosition!(value) * 1000) : value);
  const fill = $derived(scaled ? position / 10 : ((value - min) / (max - min)) * 100);

  function onInput(event: Event) {
    const raw = Number((event.currentTarget as HTMLInputElement).value);
    const next = scaled ? fromPosition!(raw / 1000) : raw;
    if (next === value) return;
    value = next;
    onchange?.(next);
  }
</script>

<div class="slider" style:--color={color}>
  <label for={id}>
    <span>{label}</span>
    <output for={id}>{display}</output>
  </label>
  <input
    {id}
    type="range"
    min={scaled ? 0 : min}
    max={scaled ? 1000 : max}
    step={scaled ? 1 : step}
    value={position}
    aria-valuetext={display}
    style:--fill="{fill}%"
    oninput={onInput}
  />
</div>

<style>
  .slider {
    display: grid;
    gap: var(--space-1);
  }

  label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
    font-weight: 700;
  }

  output {
    font-variant-numeric: tabular-nums;
    color: var(--color);
  }

  input {
    appearance: none;
    width: 100%;
    height: var(--touch);
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  input::-webkit-slider-runnable-track {
    height: 10px;
    border-radius: 5px;
    background: linear-gradient(to right, var(--color) var(--fill), var(--border) var(--fill));
  }

  input::-moz-range-track {
    height: 10px;
    border-radius: 5px;
    background: linear-gradient(to right, var(--color) var(--fill), var(--border) var(--fill));
  }

  input::-webkit-slider-thumb {
    appearance: none;
    width: 28px;
    height: 28px;
    margin-top: -9px;
    border-radius: 50%;
    background: #fff;
    border: 4px solid var(--color);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
  }

  input::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    border: 4px solid var(--color);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
  }

  input:focus-visible {
    outline: none;
  }

  input:focus-visible::-webkit-slider-thumb {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  input:focus-visible::-moz-range-thumb {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
