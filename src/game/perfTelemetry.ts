import type * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d';
import type { MapTheme } from '../types';

export interface FrameBreakdownSample {
  frameMs: number;
  courseMs: number;
  aiMs: number;
  worldStepMs: number;
  syncMs: number;
  uiMs: number;
  renderMs: number;
}

export interface PerfSnapshot {
  phase: string;
  mapTheme: MapTheme;
  isMobile: boolean;
  pixelRatio: number;
  racerCount: number;
  bodyCount: number;
  jointCount: number;
  samples: number;
  fps: number;
  frameMs: { avg: number; p50: number; p95: number; max: number };
  breakdownMs: {
    course: number;
    ai: number;
    worldStep: number;
    sync: number;
    ui: number;
    render: number;
  };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
}

declare global {
  interface Window {
    __MARBLE_PERF__?: PerfSnapshot;
  }
}

export class PerfTelemetry {
  private samples: FrameBreakdownSample[] = [];
  private readonly maxSamples = 120;
  private overlayEl: HTMLElement | null = null;
  public enabled: boolean;
  private lastHudUpdate: number = 0;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
    if (enabled) {
      this.ensureOverlay();
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.ensureOverlay();
      this.overlayEl?.classList.remove('hidden');
    } else {
      this.overlayEl?.classList.add('hidden');
    }
  }

  private ensureOverlay(): void {
    if (this.overlayEl) return;
    const el = document.createElement('div');
    el.id = 'perf-hud';
    el.className = 'perf-hud';
    document.getElementById('app')?.appendChild(el);
    this.overlayEl = el;
  }

  public resetSamples(): void {
    this.samples = [];
  }

  public recordFrame(
    sample: FrameBreakdownSample,
    meta: {
      phase: string;
      mapTheme: MapTheme;
      isMobile: boolean;
      pixelRatio: number;
      racerCount: number;
      world: RAPIER.World;
      renderer: THREE.WebGLRenderer;
    }
  ): void {
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    const sortedFrames = this.samples.map((s) => s.frameMs).sort((a, b) => a - b);
    const count = this.samples.length;
    const avgOf = (pick: (s: FrameBreakdownSample) => number) =>
      Number((this.samples.reduce((acc, s) => acc + pick(s), 0) / count).toFixed(2));

    const avgFrame = avgOf((s) => s.frameMs);
    const p50 = Number((sortedFrames[Math.floor(count * 0.5)] || 0).toFixed(2));
    const p95 = Number((sortedFrames[Math.floor(count * 0.95)] || 0).toFixed(2));
    const max = Number((sortedFrames[count - 1] || 0).toFixed(2));

    const snap: PerfSnapshot = {
      phase: meta.phase,
      mapTheme: meta.mapTheme,
      isMobile: meta.isMobile,
      pixelRatio: Number(meta.pixelRatio.toFixed(2)),
      racerCount: meta.racerCount,
      bodyCount: meta.world.bodies.len(),
      jointCount: meta.world.impulseJoints.len(),
      samples: count,
      fps: avgFrame > 0 ? Number((1000 / avgFrame).toFixed(1)) : 0,
      frameMs: { avg: avgFrame, p50, p95, max },
      breakdownMs: {
        course: avgOf((s) => s.courseMs),
        ai: avgOf((s) => s.aiMs),
        worldStep: avgOf((s) => s.worldStepMs),
        sync: avgOf((s) => s.syncMs),
        ui: avgOf((s) => s.uiMs),
        render: avgOf((s) => s.renderMs),
      },
      renderer: {
        calls: meta.renderer.info.render.calls,
        triangles: meta.renderer.info.render.triangles,
        geometries: meta.renderer.info.memory.geometries,
        textures: meta.renderer.info.memory.textures,
      },
    };

    window.__MARBLE_PERF__ = snap;

    const now = performance.now();
    if (this.enabled && now - this.lastHudUpdate > 250) {
      this.lastHudUpdate = now;
      this.ensureOverlay();
      if (this.overlayEl) {
        this.overlayEl.classList.remove('hidden');
        this.overlayEl.innerHTML =
          `<strong>📊 ${snap.fps} FPS</strong> (${snap.frameMs.avg}ms · p95 ${snap.frameMs.p95}ms)<br/>` +
          `👥 ${snap.racerCount}명 (${snap.bodyCount}B/${snap.jointCount}J) · DC ${snap.renderer.calls}<br/>` +
          `⚙️ Phys ${snap.breakdownMs.worldStep}ms · AI ${snap.breakdownMs.ai}ms · Draw ${snap.breakdownMs.render}ms`;
      }
    }
  }
}
