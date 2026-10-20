<script lang="ts">
  /**
   * A pedal you press and hold with a finger or the mouse. Where you press
   * sets how hard: near the top is a light touch, lower down is harder, and
   * sliding up or down while holding changes it. Letting go springs it back
   * to zero. Each pedal tracks its own pointer, so gas and brake can be held
   * with two fingers at once.
   */

  interface Props {
    kind: 'gas' | 'brake';
    label: string;
    /** How far it is pressed now, 0–1 (also moved by the arrow keys). */
    depth: number;
    /** Text under the label, e.g. "2,0 m/s²". */
    detail: string;
    disabled?: boolean;
    onchange: (depth: number) => void;
  }

  let { kind, label, depth, detail, disabled = false, onchange }: Props = $props();

  let pointer: number | null = null;

  function depthAt(e: PointerEvent, el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    const raw = (e.clientY - rect.top) / rect.height;
    // At least a light press, in 5% steps so the readouts stay tidy
    return Math.min(1, Math.max(0.1, Math.round(raw * 20) / 20));
  }

  function down(e: PointerEvent) {
    if (disabled || pointer !== null) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    pointer = e.pointerId;
    onchange(depthAt(e, el));
  }

  function move(e: PointerEvent) {
    if (e.pointerId !== pointer) return;
    onchange(depthAt(e, e.currentTarget as HTMLElement));
  }

  function up(e: PointerEvent) {
    if (e.pointerId !== pointer) return;
    pointer = null;
    onchange(0);
  }
</script>

<button
  type="button"
  class="pedal pedal--{kind}"
  class:pedal--down={depth > 0}
  style:--depth={depth}
  aria-label={label}
  aria-pressed={depth > 0}
  {disabled}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onlostpointercapture={up}
  oncontextmenu={(e) => e.preventDefault()}
>
  <span class="face" aria-hidden="true">
    <span class="grip"></span><span class="grip"></span><span class="grip"></span>
  </span>
  <span class="fill" aria-hidden="true"></span>
  <span class="text">
    <span class="label">{label}</span>
    <span class="detail">{detail}</span>
  </span>
</button>

<style>
  .pedal {
    --c: #00873a;
    position: relative;
    display: grid;
    grid-template-columns: 1fr;
    place-items: center;
    width: 100%;
    height: 100%;
    padding: var(--space-2);
    border: 3px solid var(--c);
    border-radius: 14px;
    background: #fff;
    color: var(--ink);
    font: inherit;
    overflow: hidden;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .pedal--brake {
    --c: #c62828;
  }

  .pedal:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* The pressed part fills from the top down, like the pedal sinking */
  .fill {
    position: absolute;
    inset: 0 0 auto;
    height: calc(var(--depth) * 100%);
    background: color-mix(in srgb, var(--c) 22%, transparent);
    pointer-events: none;
  }

  .face {
    position: absolute;
    inset: 12% 18%;
    display: grid;
    align-content: space-evenly;
    border-radius: 10px;
    background: #3a3a3a;
    transform: perspective(300px) rotateX(calc(var(--depth) * 28deg)) scale(calc(1 - var(--depth) * 0.08));
    transition: transform 0.06s;
    pointer-events: none;
  }

  .grip {
    height: 4px;
    margin-inline: 14%;
    border-radius: 2px;
    background: #6a6a6a;
  }

  .text {
    position: relative;
    display: grid;
    justify-items: center;
    padding: var(--space-1) var(--space-2);
    border-radius: 8px;
    background: rgb(255 255 255 / 0.92);
    line-height: 1.2;
    pointer-events: none;
  }

  .label {
    font-weight: 700;
    color: var(--c);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .detail {
    font-size: 0.8125rem;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .pedal--down {
    box-shadow: inset 0 0 0 2px var(--c);
  }
</style>
