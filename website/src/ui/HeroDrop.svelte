<script lang="ts">
  /**
   * Home-page teaser: a ball dropped from 20 m on Earth, with a strobe
   * "photo" every 0.25 s so the widening gaps show the acceleration.
   * Also the first real user of the shared engine (loop, canvas, transform).
   */
  import { onMount } from 'svelte';
  import { FixedStepLoop } from '../engine/loop';
  import { manageCanvas, prefersReducedMotion } from '../engine/canvas';
  import { WorldTransform } from '../engine/transform';
  import { getPlanet } from '../shared/planets';

  let { label }: { label: string } = $props();

  const planet = getPlanet('earth');
  const DROP_HEIGHT = 20; // m
  const STROBE = 0.25; // s between flashes
  const BALL_R = 0.9; // m, drawn size only
  const fallTime = Math.sqrt((2 * DROP_HEIGHT) / planet.g);
  const HOLD = 1.2; // s to rest on the ground before the next drop

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const managed = manageCanvas(canvas);
    let t = 0;

    const heightAt = (time: number) => Math.max(0, DROP_HEIGHT - 0.5 * planet.g * time * time);

    const render = () => {
      const { ctx, size } = managed;
      const groundPx = 18;
      const tf = new WorldTransform(
        { xMin: -6, xMax: 6, yMin: 0, yMax: DROP_HEIGHT + BALL_R * 1.5 },
        { x: 0, y: 6, width: size.width, height: size.height - groundPx - 6 },
      );

      ctx.fillStyle = planet.sky;
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.fillStyle = planet.ground;
      ctx.fillRect(0, size.height - groundPx, size.width, groundPx);

      const fallT = Math.min(t, fallTime);
      const r = tf.length(BALL_R);

      // Strobe trail: where the ball was at each flash so far
      ctx.fillStyle = planet.accent;
      for (let s = 0; s * STROBE < fallT; s++) {
        const p = tf.toScreen(0, heightAt(s * STROBE) + BALL_R);
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const p = tf.toScreen(0, heightAt(fallT) + BALL_R);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    if (prefersReducedMotion()) {
      // One still frame showing the whole strobe picture
      t = fallTime;
      render();
      const redraw = new ResizeObserver(render);
      redraw.observe(canvas);
      return () => {
        redraw.disconnect();
        managed.dispose();
      };
    }

    const loop = new FixedStepLoop({
      update(dt) {
        t += dt;
        if (t > fallTime + HOLD) t = 0;
      },
      render,
    });
    loop.speed = 0.6; // a little slow motion makes the gaps easy to see
    loop.start();

    return () => {
      loop.stop();
      managed.dispose();
    };
  });
</script>

<div class="hero-img" role="img" aria-label={label}>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
</div>

<style>
  .hero-img,
  canvas {
    width: 100%;
    height: 100%;
    border-radius: var(--radius);
  }
</style>
