/**
 * Mapping between world coordinates (metres, y pointing up) and canvas
 * coordinates (CSS pixels, y pointing down).
 *
 * The world rectangle is fitted inside the pixel rectangle with the same
 * scale on both axes (so circles stay round, angles stay true). `align`
 * places it in the leftover space: 0.5/0.5 centres it (default); x 0 pins
 * it left, y 1 pins it to the bottom (spare room goes to the sky).
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Point {
  x: number;
  y: number;
}

export class WorldTransform {
  /** CSS pixels per metre. */
  readonly scale: number;
  private readonly originX: number;
  private readonly originY: number;

  constructor(
    readonly world: WorldBounds,
    readonly viewport: Rect,
    align: { x: number; y: number } = { x: 0.5, y: 0.5 },
  ) {
    const worldW = world.xMax - world.xMin;
    const worldH = world.yMax - world.yMin;
    if (worldW <= 0 || worldH <= 0) throw new Error('World bounds must have a positive size');
    this.scale = Math.min(viewport.width / worldW, viewport.height / worldH);
    // Pixel position of world (xMin, yMin): bottom-left of the placed box
    this.originX = viewport.x + (viewport.width - worldW * this.scale) * align.x;
    this.originY = viewport.y + viewport.height - (viewport.height - worldH * this.scale) * (1 - align.y);
  }

  toScreen(x: number, y: number): Point {
    return {
      x: this.originX + (x - this.world.xMin) * this.scale,
      y: this.originY - (y - this.world.yMin) * this.scale,
    };
  }

  toWorld(px: number, py: number): Point {
    return {
      x: this.world.xMin + (px - this.originX) / this.scale,
      y: this.world.yMin + (this.originY - py) / this.scale,
    };
  }

  /** A world length in pixels. */
  length(metres: number): number {
    return metres * this.scale;
  }
}
