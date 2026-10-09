/**
 * Sharp, self-resizing canvas.
 *
 * The canvas's CSS box is set by the page layout; this keeps its backing
 * store at `devicePixelRatio` times that size (crisp on phones and retina
 * screens) and scales the context so drawing code works in CSS pixels.
 */

export interface CanvasSize {
  /** CSS pixels. */
  width: number;
  height: number;
  dpr: number;
}

export interface ManagedCanvas {
  ctx: CanvasRenderingContext2D;
  readonly size: CanvasSize;
  dispose(): void;
}

export function manageCanvas(
  canvas: HTMLCanvasElement,
  onResize: (size: CanvasSize) => void = () => {},
): ManagedCanvas {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');

  let size: CanvasSize = { width: 0, height: 0, dpr: 1 };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    // Cap the ratio: 3x is plenty, and big backing stores are slow on cheap tablets
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === size.width && height === size.height && dpr === size.dpr) return;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = { width, height, dpr };
    onResize(size);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  // Moving the window to a screen with a different pixel ratio
  const dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  dprQuery.addEventListener('change', resize);
  resize();

  return {
    ctx,
    get size() {
      return size;
    },
    dispose() {
      observer.disconnect();
      dprQuery.removeEventListener('change', resize);
    },
  };
}

/** True when the visitor asked the system for reduced motion. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
