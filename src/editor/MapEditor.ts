import * as THREE from 'three';
import type { MapTheme } from '../types';
import {
  DINO_FINISH_Z,
  FINISH_Z,
  getTrackCenterX,
  getTrackHalfWidthAtZ,
  getTrackHeightAtZ,
} from '../world/courseMath';
import {
  CUSTOM_OBSTACLE_CATALOG,
  type CustomCourseLayout,
  type CustomObstacleKind,
  type CustomObstacleSpec,
} from './editorTypes';

const STORAGE_KEY = 'marble_roulette_custom_layout_v1';

export interface MapEditorCallbacks {
  getScene: () => THREE.Scene;
  getCamera: () => THREE.PerspectiveCamera;
  getDomElement: () => HTMLElement;
  getCurrentMapTheme: () => MapTheme;
  onLayoutChanged: (layout: CustomCourseLayout | null, previewZ?: number) => void;
  onStartRace: (layout: CustomCourseLayout) => void;
  onCloseEditor: () => void;
  onPreviewZ: (z: number) => void;
}

export function encodeCustomLayoutToUrlParam(layout: CustomCourseLayout): string {
  const json = JSON.stringify(layout);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCustomLayoutFromUrlParam(encoded: string): CustomCourseLayout | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as CustomCourseLayout;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.obstacles)) {
      return parsed;
    }
  } catch {
    // Ignore malformed query param
  }
  return null;
}

export function loadSavedCustomLayout(): CustomCourseLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomCourseLayout;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.obstacles)) {
      return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function saveCustomLayout(layout: CustomCourseLayout | null): void {
  try {
    if (!layout) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    }
  } catch {
    // Ignore storage errors
  }
}

export class MapEditor {
  private callbacks: MapEditorCallbacks;
  private isOpen = false;
  private layout: CustomCourseLayout;
  private activeKind: CustomObstacleKind = 'SWEEPER';
  private selectedId: string | null = null;
  private previewZ = 45;
  private previewOffsetX = 0;

  private panelEl!: HTMLElement;
  private listEl!: HTMLElement;
  private inspectorEl!: HTMLElement;
  private zSlider!: HTMLInputElement;
  private zValEl!: HTMLElement;
  private statusEl!: HTMLElement;

  private overlayGroup: THREE.Group;
  private ghostMarker: THREE.Mesh;
  private selectedBeacon: THREE.Mesh;
  private markersGroup: THREE.Group;
  private raycaster = new THREE.Raycaster();
  private trackPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointerDownPos = { x: 0, y: 0 };

  constructor(callbacks: MapEditorCallbacks, initialLayout: CustomCourseLayout | null) {
    this.callbacks = callbacks;
    this.layout = initialLayout
      ? {
          ...initialLayout,
          obstacles: initialLayout.obstacles.map((o) => ({ ...o })),
        }
      : {
          version: 1,
          name: '나만의 커스텀 코스',
          baseMap: callbacks.getCurrentMapTheme(),
          clearBaseObstacles: false,
          obstacles: [],
        };

    const scene = callbacks.getScene();
    this.overlayGroup = new THREE.Group();
    this.overlayGroup.visible = false;
    scene.add(this.overlayGroup);

    const ghostGeo = new THREE.RingGeometry(1.1, 1.55, 24);
    ghostGeo.rotateX(-Math.PI / 2);
    this.ghostMarker = new THREE.Mesh(
      ghostGeo,
      new THREE.MeshBasicMaterial({
        color: 0x2bdfe8,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })
    );
    this.overlayGroup.add(this.ghostMarker);

    const beaconGeo = new THREE.RingGeometry(1.4, 1.9, 24);
    beaconGeo.rotateX(-Math.PI / 2);
    this.selectedBeacon = new THREE.Mesh(
      beaconGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffe14d,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      })
    );
    this.selectedBeacon.visible = false;
    this.overlayGroup.add(this.selectedBeacon);

    this.markersGroup = new THREE.Group();
    this.overlayGroup.add(this.markersGroup);

    this.buildDOM();
    this.attachCanvasListeners();
    this.refreshUI();
    this.syncMarkers();
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public getLayout(): CustomCourseLayout {
    return this.layout;
  }

  public open(): void {
    this.isOpen = true;
    this.overlayGroup.visible = true;
    this.panelEl.classList.remove('hidden');
    this.updateGhostTransform();
    this.syncMarkers();
    this.callbacks.onPreviewZ(this.previewZ);
  }

  public close(): void {
    this.isOpen = false;
    this.overlayGroup.visible = false;
    this.panelEl.classList.add('hidden');
  }

  private getFinishZ(): number {
    return this.layout.baseMap === 'DINOSAUR' ? DINO_FINISH_Z : FINISH_Z;
  }

  private buildDOM(): void {
    const app = document.getElementById('app')!;
    const panel = document.createElement('aside');
    panel.id = 'map-editor-panel';
    panel.className = 'light-card-panel map-editor-panel hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <h2>🛠️ 맵 에디터 · 커스텀 배치</h2>
        <div class="panel-header-actions">
          <span id="ed-count-badge" class="count-badge">0개 배치</span>
          <button type="button" id="ed-close-btn" class="panel-close-btn" aria-label="에디터 닫기">✕</button>
        </div>
      </div>

      <div class="ed-row-inline">
        <label class="field-label">기본 맵:</label>
        <select id="ed-base-map" class="ed-select">
          <option value="PLAYGROUND">🏫 운동장</option>
          <option value="TAEKWONDO">🥋 태비태권도</option>
          <option value="DINOSAUR">🏎️ 공룡 카트</option>
          <option value="POOL">🏊 수영장</option>
          <option value="FALLGUYS">🎪 폴가이즈</option>
        </select>
        <label class="ed-check-label">
          <input type="checkbox" id="ed-clear-base" />
          빈 트랙
        </label>
      </div>

      <div class="form-section">
        <span class="field-label">1. 배치할 장애물 선택 <small>(3D 트랙 클릭으로도 배치)</small></span>
        <div id="ed-palette" class="ed-palette"></div>
      </div>

      <div class="ed-z-scrub">
        <div class="ed-z-head">
          <span class="field-label">트랙 구간 이동 (Z): <strong id="ed-z-val">45m</strong></span>
          <button type="button" id="ed-add-here" class="ed-mini-btn accent">+ 현재 위치에 추가</button>
        </div>
        <input type="range" id="ed-z-slider" min="15" max="126" value="45" step="1" />
      </div>

      <div id="ed-inspector" class="ed-inspector hidden"></div>

      <div class="form-section">
        <span class="field-label">배치된 장애물 목록</span>
        <div id="ed-list" class="ed-list"></div>
      </div>

      <div id="ed-status" class="ed-status"></div>

      <div class="ed-actions-grid">
        <button type="button" id="ed-share-url" class="secondary-btn">🔗 공유 링크 복사</button>
        <button type="button" id="ed-export-json" class="secondary-btn">📤 JSON 복사</button>
        <button type="button" id="ed-import-json" class="secondary-btn">📥 불러오기</button>
        <button type="button" id="ed-clear-all" class="secondary-btn">🧹 전체 비우기</button>
      </div>

      <button type="button" id="ed-start-race" class="primary-cta-btn">
        🏁 이 커스텀 맵으로 레이스 출발!
      </button>
    `;
    app.appendChild(panel);
    this.panelEl = panel;
    this.listEl = panel.querySelector('#ed-list')!;
    this.inspectorEl = panel.querySelector('#ed-inspector')!;
    this.zSlider = panel.querySelector('#ed-z-slider') as HTMLInputElement;
    this.zValEl = panel.querySelector('#ed-z-val')!;
    this.statusEl = panel.querySelector('#ed-status')!;

    const paletteEl = panel.querySelector('#ed-palette')!;
    for (const item of CUSTOM_OBSTACLE_CATALOG) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ed-pal-btn ${item.kind === this.activeKind ? 'active' : ''}`;
      btn.dataset.kind = item.kind;
      btn.textContent = `${item.icon} ${item.label}`;
      btn.addEventListener('click', () => {
        this.activeKind = item.kind;
        paletteEl.querySelectorAll('.ed-pal-btn').forEach((b) =>
          b.classList.toggle('active', (b as HTMLElement).dataset.kind === item.kind)
        );
      });
      paletteEl.appendChild(btn);
    }

    const baseSelect = panel.querySelector('#ed-base-map') as HTMLSelectElement;
    baseSelect.value = this.layout.baseMap;
    baseSelect.addEventListener('change', () => {
      this.layout.baseMap = baseSelect.value as MapTheme;
      const maxZ = this.getFinishZ() - 5;
      this.zSlider.max = String(maxZ);
      this.previewZ = Math.min(this.previewZ, maxZ);
      this.commitChange();
    });

    const clearCheck = panel.querySelector('#ed-clear-base') as HTMLInputElement;
    clearCheck.checked = this.layout.clearBaseObstacles;
    clearCheck.addEventListener('change', () => {
      this.layout.clearBaseObstacles = clearCheck.checked;
      this.commitChange();
    });

    this.zSlider.addEventListener('input', () => {
      this.previewZ = Number(this.zSlider.value);
      this.zValEl.textContent = `${this.previewZ}m`;
      this.updateGhostTransform();
      this.callbacks.onPreviewZ(this.previewZ);
    });

    panel.querySelector('#ed-add-here')!.addEventListener('click', () => {
      this.placeObstacleAt(this.previewZ, this.previewOffsetX);
    });

    panel.querySelector('#ed-close-btn')!.addEventListener('click', () => {
      this.close();
      this.callbacks.onCloseEditor();
    });

    panel.querySelector('#ed-clear-all')!.addEventListener('click', () => {
      this.layout.obstacles = [];
      this.selectedId = null;
      this.commitChange();
      this.setStatus('배치된 장애물을 모두 비웠습니다.');
    });

    panel.querySelector('#ed-share-url')!.addEventListener('click', async () => {
      const encoded = encodeCustomLayoutToUrlParam(this.layout);
      const url = `${window.location.origin}${window.location.pathname}?map=${this.layout.baseMap}&custom=${encoded}`;
      try {
        await navigator.clipboard.writeText(url);
        this.setStatus('커스텀 맵 공유 링크가 클립보드에 복사되었습니다!');
      } catch {
        window.prompt('아래 링크를 복사하세요:', url);
      }
    });

    panel.querySelector('#ed-export-json')!.addEventListener('click', async () => {
      const json = JSON.stringify(this.layout, null, 2);
      try {
        await navigator.clipboard.writeText(json);
        this.setStatus('JSON 설정이 클립보드에 복사되었습니다!');
      } catch {
        window.prompt('JSON 데이터:', json);
      }
    });

    panel.querySelector('#ed-import-json')!.addEventListener('click', () => {
      const raw = window.prompt('저장해 둔 커스텀 맵 JSON을 붙여넣으세요:');
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as CustomCourseLayout;
        if (parsed && parsed.version === 1 && Array.isArray(parsed.obstacles)) {
          this.layout = parsed;
          this.selectedId = null;
          this.commitChange();
          this.setStatus(`불러오기 완료 (${parsed.obstacles.length}개 장애물)`);
        } else {
          this.setStatus('유효한 커스텀 맵 JSON 형식이 아닙니다.');
        }
      } catch {
        this.setStatus('JSON 파싱에 실패했습니다.');
      }
    });

    panel.querySelector('#ed-start-race')!.addEventListener('click', () => {
      saveCustomLayout(this.layout);
      this.close();
      this.callbacks.onStartRace(this.layout);
    });
  }

  private setStatus(msg: string): void {
    this.statusEl.textContent = msg;
    setTimeout(() => {
      if (this.statusEl.textContent === msg) this.statusEl.textContent = '';
    }, 3000);
  }

  private raycastTrackPoint(clientX: number, clientY: number): { z: number; offsetX: number } | null {
    const cam = this.callbacks.getCamera();
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, cam);

    // Intersect sloped track plane iteratively (2 steps converge on exact curved height)
    const approxY = getTrackHeightAtZ(this.previewZ);
    this.trackPlane.set(new THREE.Vector3(0, 1, 0), -approxY);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.trackPlane, hit)) {
      return null;
    }
    const z1 = THREE.MathUtils.clamp(hit.z, 14, this.getFinishZ() - 5);
    const refinedY = getTrackHeightAtZ(z1);
    this.trackPlane.set(new THREE.Vector3(0, 1, 0), -refinedY);
    if (!this.raycaster.ray.intersectPlane(this.trackPlane, hit)) {
      return null;
    }

    const z = Math.round(THREE.MathUtils.clamp(hit.z, 14, this.getFinishZ() - 5) * 2) / 2;
    const cx = getTrackCenterX(z);
    const halfW = getTrackHalfWidthAtZ(z, this.layout.baseMap);
    const offsetX = Math.round(THREE.MathUtils.clamp(hit.x - cx, -halfW + 1.4, halfW - 1.4) * 2) / 2;
    return { z, offsetX };
  }

  private attachCanvasListeners(): void {
    const dom = this.callbacks.getDomElement();
    dom.addEventListener('pointermove', (e) => {
      if (!this.isOpen) return;
      const pt = this.raycastTrackPoint(e.clientX, e.clientY);
      if (!pt) return;
      this.previewZ = pt.z;
      this.previewOffsetX = pt.offsetX;
      this.updateGhostTransform();
    });

    dom.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointerup', (e) => {
      if (!this.isOpen) return;
      const moveDist = Math.hypot(
        e.clientX - this.pointerDownPos.x,
        e.clientY - this.pointerDownPos.y
      );
      if (moveDist > 8) return;
      const pt = this.raycastTrackPoint(e.clientX, e.clientY);
      if (!pt) return;

      // Check if tapping near an existing obstacle to select it instead of placing
      const hitExisting = this.layout.obstacles.find(
        (ob) => Math.hypot(ob.z - pt.z, ob.offsetX - pt.offsetX) < 1.9
      );
      if (hitExisting) {
        this.selectedId = hitExisting.id;
        this.previewZ = hitExisting.z;
        this.refreshUI();
        this.syncMarkers();
        this.callbacks.onPreviewZ(hitExisting.z);
        return;
      }

      this.placeObstacleAt(pt.z, pt.offsetX);
    });
  }

  private placeObstacleAt(z: number, offsetX: number): void {
    const catalogItem = CUSTOM_OBSTACLE_CATALOG.find((c) => c.kind === this.activeKind)!;
    const spec: CustomObstacleSpec = {
      id: `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      kind: this.activeKind,
      z: Math.round(THREE.MathUtils.clamp(z, 14, this.getFinishZ() - 5) * 2) / 2,
      offsetX: Math.round(offsetX * 2) / 2,
      scale: catalogItem.defaultScale,
      speed: catalogItem.defaultSpeed,
      dir: catalogItem.defaultDir,
    };
    this.layout.obstacles.push(spec);
    this.selectedId = spec.id;
    this.previewZ = spec.z;
    this.commitChange();
  }

  private updateGhostTransform(): void {
    const wx = getTrackCenterX(this.previewZ) + this.previewOffsetX;
    const wy = getTrackHeightAtZ(this.previewZ) + 0.16;
    this.ghostMarker.position.set(wx, wy, this.previewZ);
  }

  private syncMarkers(): void {
    while (this.markersGroup.children.length > 0) {
      const ch = this.markersGroup.children.pop()!;
      this.markersGroup.remove(ch);
    }

    const pinGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.25, 14);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xff5fa2, transparent: true, opacity: 0.78 });

    let foundSel: CustomObstacleSpec | null = null;
    for (const ob of this.layout.obstacles) {
      const m = new THREE.Mesh(pinGeo, pinMat);
      const wx = getTrackCenterX(ob.z) + ob.offsetX;
      const wy = getTrackHeightAtZ(ob.z) + 0.2;
      m.position.set(wx, wy, ob.z);
      this.markersGroup.add(m);
      if (ob.id === this.selectedId) {
        foundSel = ob;
      }
    }

    if (foundSel) {
      const sx = getTrackCenterX(foundSel.z) + foundSel.offsetX;
      const sy = getTrackHeightAtZ(foundSel.z) + 0.22;
      this.selectedBeacon.position.set(sx, sy, foundSel.z);
      this.selectedBeacon.visible = true;
    } else {
      this.selectedBeacon.visible = false;
    }
  }

  private commitChange(): void {
    saveCustomLayout(this.layout);
    this.refreshUI();
    this.syncMarkers();
    this.callbacks.onLayoutChanged(this.layout, this.previewZ);
  }

  private refreshUI(): void {
    const countBadge = this.panelEl.querySelector('#ed-count-badge')!;
    countBadge.textContent = `${this.layout.obstacles.length}개 배치`;

    const baseSelect = this.panelEl.querySelector('#ed-base-map') as HTMLSelectElement;
    baseSelect.value = this.layout.baseMap;
    const clearCheck = this.panelEl.querySelector('#ed-clear-base') as HTMLInputElement;
    clearCheck.checked = this.layout.clearBaseObstacles;

    this.zSlider.max = String(this.getFinishZ() - 5);
    this.zSlider.value = String(Math.round(this.previewZ));
    this.zValEl.textContent = `${Math.round(this.previewZ)}m`;

    // Selected obstacle inspector
    const sel = this.layout.obstacles.find((o) => o.id === this.selectedId) || null;
    if (!sel) {
      this.inspectorEl.classList.add('hidden');
      this.inspectorEl.innerHTML = '';
    } else {
      const info = CUSTOM_OBSTACLE_CATALOG.find((c) => c.kind === sel.kind);
      this.inspectorEl.classList.remove('hidden');
      this.inspectorEl.innerHTML = `
        <div class="ed-insp-title">
          <strong>${info?.icon || '🧱'} ${info?.label || sel.kind}</strong>
          <span>Z:${sel.z}m · X:${sel.offsetX}m</span>
        </div>
        <div class="ed-insp-controls">
          <button type="button" data-act="z-minus" class="ed-mini-btn">▲ Z-2m</button>
          <button type="button" data-act="z-plus" class="ed-mini-btn">▼ Z+2m</button>
          <button type="button" data-act="x-minus" class="ed-mini-btn">◀ X-1.5</button>
          <button type="button" data-act="x-plus" class="ed-mini-btn">▶ X+1.5</button>
          <button type="button" data-act="flip" class="ed-mini-btn">⇄ 방향 (${sel.dir > 0 ? '+' : '-'})</button>
          <button type="button" data-act="scale" class="ed-mini-btn">📏 크기 (${sel.scale.toFixed(1)}x)</button>
          <button type="button" data-act="del" class="ed-mini-btn danger">🗑️ 삭제</button>
        </div>
      `;

      this.inspectorEl.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.act;
          if (act === 'z-minus') sel.z = Math.max(14, sel.z - 2);
          if (act === 'z-plus') sel.z = Math.min(this.getFinishZ() - 5, sel.z + 2);
          if (act === 'x-minus') sel.offsetX = Math.max(-7.5, sel.offsetX - 1.5);
          if (act === 'x-plus') sel.offsetX = Math.min(7.5, sel.offsetX + 1.5);
          if (act === 'flip') sel.dir = sel.dir > 0 ? -1 : 1;
          if (act === 'scale') sel.scale = sel.scale >= 1.5 ? 0.8 : Number((sel.scale + 0.35).toFixed(2));
          if (act === 'del') {
            this.layout.obstacles = this.layout.obstacles.filter((o) => o.id !== sel.id);
            this.selectedId = null;
          } else {
            this.previewZ = sel.z;
            this.callbacks.onPreviewZ(sel.z);
          }
          this.commitChange();
        });
      });
    }

    // Placed list
    this.listEl.innerHTML = '';
    if (this.layout.obstacles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ed-empty';
      empty.textContent = '트랙을 클릭하거나 "+ 현재 위치에 추가"를 눌러 장애물을 배치하세요.';
      this.listEl.appendChild(empty);
      return;
    }

    const sorted = [...this.layout.obstacles].sort((a, b) => a.z - b.z);
    for (const ob of sorted) {
      const info = CUSTOM_OBSTACLE_CATALOG.find((c) => c.kind === ob.kind);
      const row = document.createElement('div');
      row.className = `ed-item ${ob.id === this.selectedId ? 'active' : ''}`;
      row.innerHTML = `
        <span>${info?.icon || '🧱'} ${info?.label || ob.kind}</span>
        <span class="ed-item-coords">Z ${ob.z}m · X ${ob.offsetX}m</span>
      `;
      row.addEventListener('click', () => {
        this.selectedId = ob.id;
        this.previewZ = ob.z;
        this.refreshUI();
        this.syncMarkers();
        this.callbacks.onPreviewZ(ob.z);
      });
      this.listEl.appendChild(row);
    }
  }
}
