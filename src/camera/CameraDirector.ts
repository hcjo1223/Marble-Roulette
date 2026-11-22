import * as THREE from 'three';
import type { CameraMode } from '../types';
import { RagdollRacer } from '../entities/RagdollRacer';
import { FINISH_Z } from '../world/ObstacleCourse';
import { getTrackHeightAtZ } from '../world/courseMath';

/** 카메라가 따라가는 높이의 상한: 트랙 바닥 + 이 값(m). 함정에 날아간 레이서를 따라 하늘만 비추지 않게 한다. */
const CAMERA_FOCUS_MAX_ABOVE_TRACK = 2.5;
/** 탑뷰가 화면에 담는 상위 인원 수. */
const TOP_VIEW_FOCUS_COUNT = 5;
/** 탑뷰 카메라 높이 범위(m). 상위권이 몰려 있을수록 낮아진다. (기존 고정 46m) */
const TOP_VIEW_MIN_HEIGHT = 24;
const TOP_VIEW_MAX_HEIGHT = 40;
/** 카메라를 기준점에서 뒤로 뺀 거리 / 높이 (기존 14/46, 내려다보는 각도 약 66°). */
const TOP_VIEW_BACK_RATIO = 14 / 46;
/** 바라보는 지점(화면 세로 중앙)의 기준점 앞 거리 / 높이 (기존 6/46). */
const TOP_VIEW_LOOK_AHEAD_RATIO = 6 / 46;
/** 맨 뒤 사람이 기준점보다 뒤로 둘 수 있는 거리 / 높이 (화면 아래 끝 -0.38h, 버튼 줄 여유 포함). */
const TOP_VIEW_REAR_MARGIN_RATIO = 0.25;
/** 선두가 기준점보다 앞으로 둘 수 있는 거리 / 높이 (화면 위 끝 +0.95h, 위쪽 HUD는 약 +0.73h부터 가림 → 이름표·카메라 지연 여유 포함). */
const TOP_VIEW_FRONT_MARGIN_RATIO = 0.5;
/** HUD를 피해 상위권을 담을 수 있는 앞뒤 길이 / 높이 (-0.25h ~ +0.5h). */
const TOP_VIEW_USABLE_DEPTH_RATIO = TOP_VIEW_REAR_MARGIN_RATIO + TOP_VIEW_FRONT_MARGIN_RATIO;
/** 맵 에디터 탑뷰 높이(m). */
const TOP_VIEW_EDITOR_HEIGHT = 36;
/** 카메라 초점의 좌우 한계: 트랙 중심 ± 이 값(m). */
const CAMERA_FOCUS_MAX_LATERAL = 12;

export class CameraDirector {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'LEAD';
  public focusedRacerId: string | null = null;
  public isClimaxSlowMo: boolean = false;
  public editorMode: boolean = false;
  public onCanvasTap?: (clientX: number, clientY: number) => void;

  private currentPos: THREE.Vector3 = new THREE.Vector3(0, 14, -12);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 15);

  // Orbit / Free camera controls
  private orbitYaw: number = 0;
  private orbitPitch: number = 0.42;
  private orbitDist: number = 14.5;
  private topPanZ: number = 55;
  /** 탑뷰 카메라 현재 높이(m, 세로 화면 배율 적용 전). */
  private topHeight: number = TOP_VIEW_MAX_HEIGHT;
  private currentFinishZ: number = FINISH_Z;
  private isDragging: boolean = false;
  private prevPointer = { x: 0, y: 0 };
  private pointerDownPos = { x: 0, y: 0 };
  private pointerDownTime: number = 0;

  // Multi-touch pinch state
  private isPinching: boolean = false;
  private prevPinchDist: number = 0;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);

    this.attachPointerAndTouchControls(domElement);
  }

  private attachPointerAndTouchControls(domElement: HTMLElement): void {
    // Mouse & Single-Touch Drag + Tap Detection
    domElement.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.isPinching) return;
      this.isDragging = true;
      this.prevPointer = { x: e.clientX, y: e.clientY };
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.pointerDownTime = performance.now();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging || this.isPinching) return;
      const dx = e.clientX - this.prevPointer.x;
      const dy = e.clientY - this.prevPointer.y;
      this.prevPointer = { x: e.clientX, y: e.clientY };

      if (this.mode === 'TOP') {
        this.topPanZ = Math.max(0, Math.min(this.currentFinishZ + 4, this.topPanZ - dy * 0.25));
      } else {
        this.orbitYaw -= dx * 0.0075;
        this.orbitPitch = Math.max(0.06, Math.min(1.25, this.orbitPitch + dy * 0.0065));
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isDragging && !this.isPinching) {
        const moveDist = Math.hypot(
          e.clientX - this.pointerDownPos.x,
          e.clientY - this.pointerDownPos.y
        );
        const elapsed = performance.now() - this.pointerDownTime;
        if (moveDist < 9 && elapsed < 280 && !this.editorMode && this.onCanvasTap) {
          this.onCanvasTap(e.clientX, e.clientY);
        }
      }
      this.isDragging = false;
    });

    // Two-Finger Pinch-to-Zoom for Mobile
    domElement.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          this.isPinching = true;
          this.isDragging = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.prevPinchDist = Math.hypot(dx, dy);
        }
      },
      { passive: true }
    );

    domElement.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && this.isPinching) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const delta = this.prevPinchDist - dist;
          this.prevPinchDist = dist;

          this.orbitDist = Math.max(6.5, Math.min(52, this.orbitDist + delta * 0.055));
        }
      },
      { passive: false }
    );

    domElement.addEventListener(
      'touchend',
      (e) => {
        if (e.touches.length < 2) {
          this.isPinching = false;
        }
      },
      { passive: true }
    );

    // Desktop Mouse Wheel Zoom
    domElement.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.orbitDist = Math.max(6.5, Math.min(52, this.orbitDist + e.deltaY * 0.015));
      },
      { passive: false }
    );
  }

  public updateAspectAndFov(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    // Widen vertical FOV on narrow portrait screens so the full 18m track width fits
    this.camera.fov = aspect < 0.85 ? 68 : aspect < 1.1 ? 62 : 56;
    this.camera.updateProjectionMatrix();
  }

  public setMode(mode: CameraMode, onModeChange?: (mode: CameraMode) => void): void {
    this.mode = mode;
    if (mode !== 'FREE') {
      this.orbitYaw = 0;
    } else {
      this.orbitPitch = Math.min(this.orbitPitch, 0.34);
    }
    if (onModeChange) onModeChange(mode);
  }

  public setTopPanZ(z: number): void {
    this.topPanZ = Math.max(0, Math.min(this.currentFinishZ + 4, z));
  }

  public focusOnRacer(racerId: string, onModeChange?: (mode: CameraMode) => void): void {
    this.focusedRacerId = racerId;
    this.orbitYaw = 0;
    this.orbitPitch = 0.34;
    this.setMode('FREE', onModeChange);
  }

  private readonly _focusPos = new THREE.Vector3();
  private readonly _focusPos2 = new THREE.Vector3();
  private focusToggle = false;

  /** 레이서 위치를 트랙 근처로 제한한 카메라 초점 (반환 벡터는 다음 두 번 호출까지만 유효). */
  private focusPos(
    racer: RagdollRacer,
    trackCenterXAtZ?: (z: number) => number
  ): THREE.Vector3 {
    this.focusToggle = !this.focusToggle;
    const out = (this.focusToggle ? this._focusPos : this._focusPos2).copy(racer.getPosition());
    out.y = Math.min(out.y, getTrackHeightAtZ(out.z) + CAMERA_FOCUS_MAX_ABOVE_TRACK);
    if (trackCenterXAtZ) {
      const cx = trackCenterXAtZ(out.z);
      out.x = THREE.MathUtils.clamp(out.x, cx - CAMERA_FOCUS_MAX_LATERAL, cx + CAMERA_FOCUS_MAX_LATERAL);
    }
    return out;
  }

  private readonly _projected = new THREE.Vector3();

  /** 메인 카메라 화면 안(가장자리 margin 제외)에 보이는 위치인지. */
  public isOnScreen(worldPos: THREE.Vector3, margin: number = 0.85): boolean {
    this.camera.updateMatrixWorld();
    const v = this._projected.copy(worldPos).project(this.camera);
    return v.z < 1 && Math.abs(v.x) <= margin && Math.abs(v.y) <= margin;
  }

  public update(
    realDt: number,
    sortedRacers: RagdollRacer[],
    decisiveRacer: RagdollRacer | null,
    trackCenterXAtZ?: (z: number) => number,
    finishZ: number = FINISH_Z
  ): void {
    this.currentFinishZ = finishZ;
    if (sortedRacers.length === 0) return;

    const activeRacers = sortedRacers.filter((r) => r.state !== 'FINISHED');
    const pool = activeRacers.length > 0 ? activeRacers : sortedRacers;
    const isKartRace = pool[0]?.isKartMode ?? false;

    // Pull back slightly on portrait screens so racers on outer lanes remain visible
    const portraitScale = this.camera.aspect < 0.85 ? 1.24 : 1.0;
    const effectiveDist = this.orbitDist * portraitScale;

    let desiredPos = new THREE.Vector3();
    let desiredLook = new THREE.Vector3();

    // Climax Photo-Finish Slow-Mo Camera override
    if (this.isClimaxSlowMo && decisiveRacer) {
      const p = this.focusPos(decisiveRacer, trackCenterXAtZ);
      desiredPos.set(
        p.x + 5.2 * portraitScale,
        p.y + 3.4 * portraitScale,
        Math.min(finishZ + 5.5, p.z + 7.2 * portraitScale)
      );
      desiredLook.set(p.x, p.y + 0.5, p.z + 1.2);
    } else if (this.mode === 'TOP') {
      // Top-down tactical overview of the course
      // 탑뷰: 꼴찌까지 다 담지 않고 상위 TOP_VIEW_FOCUS_COUNT명만 가깝게 내려다본다.
      // 상위권이 몰려 있으면 더 낮게(근접), 벌어지면 그만큼 높여 모두 화면에 들어오게 한다.
      const focusGroup = pool.slice(0, TOP_VIEW_FOCUS_COUNT);
      let targetHeight = TOP_VIEW_EDITOR_HEIGHT;
      if (!this.isDragging && !this.editorMode && focusGroup.length > 0) {
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (const r of focusGroup) {
          const z = r.getPosition().z;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }
        // 비스듬히 내려다보는 구도라 화면에 보이는 바닥은 기준점(topPanZ)에서
        // 뒤로 약 0.38h, 앞으로 약 0.95h로 앞쪽이 훨씬 길다 (h = 카메라 높이).
        // 아래쪽 버튼 줄을 피해 맨 뒤 사람은 -0.25h 안쪽, 위쪽 HUD를 피해 선두는 +0.5h 안쪽에 오도록 높이를 정한다.
        const spread = maxZ - minZ;
        targetHeight = THREE.MathUtils.clamp(
          spread / TOP_VIEW_USABLE_DEPTH_RATIO,
          TOP_VIEW_MIN_HEIGHT,
          TOP_VIEW_MAX_HEIGHT
        );
        const h = targetHeight * portraitScale;
        // 무리가 짧으면 화면 한가운데(기준점 +0.13h)에, 길면 맨 뒤 사람이 아래 버튼 줄 바로 위에 오게
        // 높이 상한 때문에 다 못 담으면 1등을 우선해 화면 위쪽 안에 둔다 (뒤쪽 순위가 아래로 빠짐)
        const desiredPanZ = Math.max(
          Math.min(
            (minZ + maxZ) * 0.5 - h * TOP_VIEW_LOOK_AHEAD_RATIO,
            minZ + h * TOP_VIEW_REAR_MARGIN_RATIO
          ),
          maxZ - h * TOP_VIEW_FRONT_MARGIN_RATIO
        );
        // 달리는 상위권을 늦게 따라가 선두가 위쪽 HUD에 가리지 않도록 추적 속도를 높게 둔다
        this.topPanZ = THREE.MathUtils.lerp(this.topPanZ, desiredPanZ, Math.min(1, realDt * 6));
      } else if (!this.editorMode) {
        targetHeight = this.topHeight;
      }
      // 높이는 천천히 따라가 화면이 출렁이지 않게 한다.
      this.topHeight = THREE.MathUtils.lerp(this.topHeight, targetHeight, Math.min(1, realDt * 1.6));
      const cx = trackCenterXAtZ ? trackCenterXAtZ(this.topPanZ) : 0;
      const baseY = -Math.tan(0.088) * this.topPanZ;
      const topHeight = this.topHeight * portraitScale;
      // 내려다보는 각도는 기존(높이 46, 뒤 14, 앞 6)과 같은 비율로 유지
      desiredPos.set(cx, baseY + topHeight, this.topPanZ - topHeight * TOP_VIEW_BACK_RATIO);
      desiredLook.set(cx, baseY, this.topPanZ + topHeight * TOP_VIEW_LOOK_AHEAD_RATIO);
    } else if (this.mode === 'LAST') {
      // Follow Last Place racer
      const lastRacer = pool[pool.length - 1];
      const p = this.focusPos(lastRacer, trackCenterXAtZ);
      const offsetX = Math.sin(this.orbitYaw) * effectiveDist;
      const offsetZ = -Math.cos(this.orbitYaw) * effectiveDist;
      const offsetY = Math.sin(this.orbitPitch) * effectiveDist + 2.5;

      desiredPos.set(p.x + offsetX, p.y + offsetY, p.z + offsetZ);
      desiredLook.set(p.x, p.y + 0.8, p.z + 5.5);
    } else if (this.mode === 'FREE') {
      // Tight third-person character focus camera (above pack shoulders, well below overhead signs)
      const target =
        sortedRacers.find((r) => r.id === this.focusedRacerId) ||
        decisiveRacer ||
        pool[0];
      if (!this.focusedRacerId && target) {
        this.focusedRacerId = target.id;
      }
      const p = this.focusPos(target, trackCenterXAtZ);
      const dist = effectiveDist * 0.44;
      const offsetX = Math.sin(this.orbitYaw) * dist;
      const offsetZ = -Math.cos(this.orbitYaw) * dist;
      const offsetY = Math.sin(this.orbitPitch) * dist + 1.45;

      desiredPos.set(p.x + offsetX, p.y + offsetY, p.z + offsetZ);
      desiredLook.set(p.x, p.y + 0.65, p.z + 0.85);
    } else {
      // 'LEAD' mode: Follow leading pack & look ahead down the curved track
      const leader = pool[0];
      const second = pool.length > 1 ? pool[1] : leader;
      const p1 = this.focusPos(leader, trackCenterXAtZ);
      const p2 = this.focusPos(second, trackCenterXAtZ);

      const blend = Math.abs(p1.z - p2.z) < 8 ? 0.35 : 0.0;
      const focusX = p1.x * (1 - blend) + p2.x * blend;
      const focusY = p1.y * (1 - blend) + p2.y * blend;
      const focusZ = p1.z * (1 - blend) + p2.z * blend;

      const offsetX = Math.sin(this.orbitYaw) * effectiveDist;
      const offsetZ = -Math.cos(this.orbitYaw) * effectiveDist;
      const offsetY = Math.sin(this.orbitPitch) * effectiveDist + 3.2;

      const aheadZ = focusZ + (isKartRace ? 15.0 : 12.0);
      const aheadCX = trackCenterXAtZ ? trackCenterXAtZ(aheadZ) : focusX;

      desiredPos.set(focusX + offsetX, focusY + offsetY, focusZ + offsetZ);
      desiredLook.set(
        focusX * 0.45 + aheadCX * 0.55,
        focusY + 0.2,
        focusZ + (isKartRace ? 9.0 : 7.5)
      );
    }

    const smoothSpeed = this.isClimaxSlowMo
      ? 8.5
      : this.mode === 'FREE'
      ? 10.0
      : isKartRace
      ? 8.2
      : 6.0;
    this.currentPos.lerp(desiredPos, Math.min(1, realDt * smoothSpeed));
    this.currentLookAt.lerp(desiredLook, Math.min(1, realDt * (smoothSpeed + 2.5)));

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }
}
