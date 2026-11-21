import * as THREE from 'three';
import type { RagdollRacer } from '../entities/RagdollRacer';

export type HighlightEventKind = 'TUBE' | 'SPLASH' | 'DUCK' | 'WAVE';

interface HighlightVisualStyle {
  badge: string;
  title: string;
  headerClass: string;
  priority: number;
}

const HIGHLIGHT_STYLES: Record<HighlightEventKind, HighlightVisualStyle> = {
  TUBE: {
    badge: 'LIVE CAM',
    title: '🛟 튜브 부스터!',
    headerClass: 'pip-theme-tube',
    priority: 1,
  },
  WAVE: {
    badge: 'LIVE CAM',
    title: '🌊 파도 존 돌입!',
    headerClass: 'pip-theme-wave',
    priority: 2,
  },
  SPLASH: {
    badge: 'IMPACT!',
    title: '💦 물벼락 직격!',
    headerClass: 'pip-theme-splash',
    priority: 3,
  },
  DUCK: {
    badge: 'IMPACT!',
    title: '🦆 오리 폭격!',
    headerClass: 'pip-theme-duck',
    priority: 3,
  },
};

export interface HighlightTriggerOptions {
  racer: RagdollRacer;
  kind: HighlightEventKind;
  subtitle: string;
  /** true면 띄우지 않는다 (결승 직전·결승 슬로모션 중 등 메인 화면에 집중해야 할 때). */
  suppress: boolean;
}

export class HighlightPipDirector {
  public readonly pipCamera: THREE.PerspectiveCamera;
  private cardEl!: HTMLElement;
  private headerEl!: HTMLElement;
  private badgeEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private rankEl!: HTMLElement;
  private viewportSlotEl!: HTMLElement;
  private flashEl!: HTMLElement;
  private subChipEl!: HTMLElement;
  private swatchEl!: HTMLElement;
  private nameEl!: HTMLElement;

  private active = false;
  private activeRacerId: string | null = null;
  private activePriority = 0;
  private activeTimer = 0;
  private readonly displayDuration = 2.4;
  private cooldownTimer = 0;
  private flashTimer = 0;
  private age = 0;

  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private desiredPos = new THREE.Vector3();
  private desiredLook = new THREE.Vector3();
  private renderSize = new THREE.Vector2();
  private lastThemeClass = '';

  private onSelectRacer: (racerId: string) => void;

  constructor(onSelectRacer: (racerId: string) => void) {
    this.onSelectRacer = onSelectRacer;
    this.pipCamera = new THREE.PerspectiveCamera(48, 320 / 172, 0.3, 95);
    this.buildDOM();
  }

  private buildDOM(): void {
    const app = document.getElementById('app')!;
    const card = document.createElement('div');
    card.id = 'highlight-pip-modal';
    card.className = 'highlight-pip-card hidden';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.title = '클릭하면 메인 화면 카메라가 이 친구를 따라갑니다';

    card.innerHTML = `
      <div class="pip-header" id="pip-header">
        <div class="pip-live-group">
          <span class="pip-dot"></span>
          <span id="pip-badge" class="pip-live-badge">LIVE CAM</span>
        </div>
        <span id="pip-title" class="pip-title">💦 물벼락 직격!</span>
        <div class="pip-header-right">
          <span id="pip-rank" class="pip-rank">#1위</span>
          <button type="button" id="pip-close-btn" class="pip-close-btn" aria-label="미니 화면 닫기">✕</button>
        </div>
      </div>
      <div class="pip-viewport-slot" id="pip-viewport-slot">
        <div class="pip-flash-overlay" id="pip-flash"></div>
        <div class="pip-sub-chip" id="pip-sub-chip">파도 타고 고속 질주!</div>
      </div>
      <div class="pip-footer">
        <div class="pip-player-id">
          <span id="pip-swatch" class="pip-swatch"></span>
          <span id="pip-name" class="pip-name">1번</span>
        </div>
        <span class="pip-hint">클릭: 추적</span>
      </div>
    `;

    app.appendChild(card);

    this.cardEl = card;
    this.headerEl = card.querySelector('#pip-header')!;
    this.badgeEl = card.querySelector('#pip-badge')!;
    this.titleEl = card.querySelector('#pip-title')!;
    this.rankEl = card.querySelector('#pip-rank')!;
    this.viewportSlotEl = card.querySelector('#pip-viewport-slot')!;
    this.flashEl = card.querySelector('#pip-flash')!;
    this.subChipEl = card.querySelector('#pip-sub-chip')!;
    this.swatchEl = card.querySelector('#pip-swatch')!;
    this.nameEl = card.querySelector('#pip-name')!;

    card.querySelector('#pip-close-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide(true);
    });

    card.addEventListener('click', () => {
      if (this.active && this.activeRacerId) {
        this.onSelectRacer(this.activeRacerId);
      }
    });
  }

  private isBlockedByOtherPanels(): boolean {
    const setupEl = document.getElementById('setup-panel');
    const setupOpen = Boolean(setupEl && !setupEl.classList.contains('collapsed'));
    const editorEl = document.getElementById('map-editor-panel');
    const editorOpen = Boolean(editorEl && !editorEl.classList.contains('hidden'));
    const modalEl = document.getElementById('winner-modal');
    const modalOpen = Boolean(modalEl && !modalEl.classList.contains('hidden'));
    return setupOpen || editorOpen || modalOpen;
  }

  /**
   * 하이라이트 미니 화면 띄우기 시도.
   * 메인 화면에 이미 보이는지는 호출하는 쪽(main)에서 걸러서, 안 보이는 장면만 들어온다.
   */
  public tryTrigger(opts: HighlightTriggerOptions): boolean {
    const { racer, kind, subtitle, suppress } = opts;
    if (racer.state === 'FINISHED') return false;
    if (suppress) return false;
    if (this.isBlockedByOtherPanels()) return false;

    const style = HIGHLIGHT_STYLES[kind];

    if (this.active) {
      if (style.priority <= this.activePriority) return false;
    } else if (this.cooldownTimer > 0) {
      return false;
    }

    this.active = true;
    this.activeRacerId = racer.id;
    this.activePriority = style.priority;
    this.activeTimer = this.displayDuration;
    this.flashTimer = 0.22;
    this.age = 0;

    if (this.lastThemeClass) {
      this.headerEl.classList.remove(this.lastThemeClass);
    }
    this.headerEl.classList.add(style.headerClass);
    this.lastThemeClass = style.headerClass;

    this.badgeEl.textContent = style.badge;
    this.titleEl.textContent = style.title;
    this.rankEl.textContent = `#${racer.rank}위`;
    this.nameEl.textContent = racer.name;
    this.swatchEl.style.background = racer.color;
    this.subChipEl.textContent = subtitle;

    const p = racer.getPosition();
    this.camPos.set(p.x + 3.4, p.y + 1.8, p.z + 3.8);
    this.camLook.set(p.x, p.y + 0.5, p.z);

    this.cardEl.classList.remove('hidden');
    this.cardEl.classList.remove('pip-pop');
    void this.cardEl.offsetWidth;
    this.cardEl.classList.add('pip-pop');
    this.flashEl.style.opacity = '0.85';

    return true;
  }

  public hide(applyCooldown: boolean = true): void {
    if (!this.active) return;
    this.active = false;
    this.activeRacerId = null;
    this.activePriority = 0;
    this.activeTimer = 0;
    this.cardEl.classList.add('hidden');
    if (applyCooldown) {
      this.cooldownTimer = 4.8;
    }
  }

  public reset(): void {
    this.cooldownTimer = 0;
    this.hide(false);
  }

  public isActive(): boolean {
    return this.active;
  }

  public update(
    realDt: number,
    racers: RagdollRacer[],
    trackCenterXAtZ: (z: number) => number,
    suppress: boolean
  ): void {
    if (this.cooldownTimer > 0 && !this.active) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - realDt);
    }

    if (!this.active) return;

    if (suppress || this.isBlockedByOtherPanels()) {
      this.hide(false);
      return;
    }

    this.age += realDt;
    this.activeTimer -= realDt;

    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - realDt);
      this.flashEl.style.opacity = String((this.flashTimer / 0.22) * 0.85);
    } else if (this.flashEl.style.opacity !== '0') {
      this.flashEl.style.opacity = '0';
    }

    const target = racers.find((r) => r.id === this.activeRacerId);
    if (!target || target.state === 'FINISHED' || this.activeTimer <= 0) {
      this.hide(true);
      return;
    }

    this.rankEl.textContent = `#${target.rank}위`;

    const p = target.getPosition();
    const cx = trackCenterXAtZ(p.z);
    // Position camera inside track corridor toward center side so side walls never block close-up
    const sideSign = p.x >= cx ? -1 : 1;
    const orbit = 0.55 + Math.sin(this.age * 1.45) * 0.25;
    const dist = 5.4;
    const offX = sideSign * Math.sin(orbit) * dist;
    const offZ = Math.cos(orbit) * dist * 0.85;
    const clampedX = THREE.MathUtils.clamp(p.x + offX, cx - 7.4, cx + 7.4);

    this.desiredPos.set(clampedX, p.y + 1.9, p.z + offZ);
    this.desiredLook.set(p.x, p.y + 0.5, p.z + 0.35);

    this.camPos.lerp(this.desiredPos, Math.min(1, realDt * 14));
    this.camLook.lerp(this.desiredLook, Math.min(1, realDt * 18));
    this.pipCamera.position.copy(this.camPos);
    this.pipCamera.lookAt(this.camLook);
  }

  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    if (!this.active || this.isBlockedByOtherPanels()) return;

    const rect = this.viewportSlotEl.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) return;

    renderer.getSize(this.renderSize);
    const fullW = this.renderSize.x;
    const fullH = this.renderSize.y;

    const x = Math.max(0, Math.round(rect.left));
    const y = Math.max(0, Math.round(fullH - rect.bottom));
    const w = Math.min(fullW - x, Math.round(rect.width));
    const h = Math.min(fullH - y, Math.round(rect.height));
    if (w < 16 || h < 16) return;

    const nextAspect = w / h;
    if (Math.abs(this.pipCamera.aspect - nextAspect) > 0.01) {
      this.pipCamera.aspect = nextAspect;
      this.pipCamera.updateProjectionMatrix();
    }

    const prevShadowAuto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setScissorTest(true);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.render(scene, this.pipCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, fullW, fullH);
    renderer.setScissor(0, 0, fullW, fullH);
    renderer.shadowMap.autoUpdate = prevShadowAuto;
  }
}
