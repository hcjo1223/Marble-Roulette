import * as THREE from 'three';
import type { CameraMode } from '../types';
import { RagdollRacer } from '../entities/RagdollRacer';
import { FINISH_Z } from '../world/ObstacleCourse';

export class CameraDirector {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'LEAD';
  public focusedRacerId: string | null = null;
  public isClimaxSlowMo: boolean = false;
  public onCanvasTap?: (clientX: number, clientY: number) => void;

  private currentPos: THREE.Vector3 = new THREE.Vector3(0, 14, -12);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 15);

  // Orbit / Free camera controls
  private orbitYaw: number = 0;
  private orbitPitch: number = 0.42;
  private orbitDist: number = 14.5;
  private topPanZ: number = 55;
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
        this.topPanZ = Math.max(0, Math.min(135, this.topPanZ - dy * 0.25));
      } else {
        this.orbitYaw -= dx * 0.0075;
        this.orbitPitch = Math.max(0.12, Math.min(1.25, this.orbitPitch + dy * 0.0065));
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isDragging && !this.isPinching) {
        const moveDist = Math.hypot(
          e.clientX - this.pointerDownPos.x,
          e.clientY - this.pointerDownPos.y
        );
        const elapsed = performance.now() - this.pointerDownTime;
        if (moveDist < 9 && elapsed < 280 && this.onCanvasTap) {
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
    }
    if (onModeChange) onModeChange(mode);
  }

  public focusOnRacer(racerId: string, onModeChange?: (mode: CameraMode) => void): void {
    this.focusedRacerId = racerId;
    this.setMode('FREE', onModeChange);
  }

  public update(
    realDt: number,
    sortedRacers: RagdollRacer[],
    decisiveRacer: RagdollRacer | null
  ): void {
    if (sortedRacers.length === 0) return;

    const activeRacers = sortedRacers.filter((r) => r.state !== 'FINISHED');
    const pool = activeRacers.length > 0 ? activeRacers : sortedRacers;

    // Pull back slightly on portrait screens so racers on outer lanes remain visible
    const portraitScale = this.camera.aspect < 0.85 ? 1.24 : 1.0;
    const effectiveDist = this.orbitDist * portraitScale;

    let desiredPos = new THREE.Vector3();
    let desiredLook = new THREE.Vector3();

    // Climax Photo-Finish Slow-Mo Camera override
    if (this.isClimaxSlowMo && decisiveRacer) {
      const p = decisiveRacer.getPosition();
      desiredPos.set(
        p.x + 5.2 * portraitScale,
        p.y + 3.4 * portraitScale,
        Math.min(FINISH_Z + 5.5, p.z + 7.2 * portraitScale)
      );
      desiredLook.set(p.x, p.y + 0.5, p.z + 1.2);
    } else if (this.mode === 'TOP') {
      // Top-down tactical overview of the course
      let centerZ = this.topPanZ;
      if (!this.isDragging && pool.length > 0) {
        const sumZ = pool.reduce((acc, r) => acc + r.getPosition().z, 0);
        centerZ = sumZ / pool.length;
        this.topPanZ = THREE.MathUtils.lerp(this.topPanZ, centerZ, realDt * 3);
      }
      const baseY = -Math.tan(0.105) * this.topPanZ;
      desiredPos.set(0, baseY + 46 * portraitScale, this.topPanZ - 14);
      desiredLook.set(0, baseY, this.topPanZ + 6);
    } else if (this.mode === 'LAST') {
      // Follow Last Place racer
      const lastRacer = pool[pool.length - 1];
      const p = lastRacer.getPosition();
      const offsetX = Math.sin(this.orbitYaw) * effectiveDist;
      const offsetZ = -Math.cos(this.orbitYaw) * effectiveDist;
      const offsetY = Math.sin(this.orbitPitch) * effectiveDist + 2.5;

      desiredPos.set(p.x + offsetX, p.y + offsetY, p.z + offsetZ);
      desiredLook.set(p.x, p.y + 0.8, p.z + 4.5);
    } else if (this.mode === 'FREE') {
      // Follow clicked racer or decisive racer with full touch/mouse orbit
      const target =
        sortedRacers.find((r) => r.id === this.focusedRacerId) ||
        decisiveRacer ||
        pool[0];
      const p = target.getPosition();
      const dist = effectiveDist * 0.82;
      const offsetX = Math.sin(this.orbitYaw) * dist;
      const offsetZ = -Math.cos(this.orbitYaw) * dist;
      const offsetY = Math.sin(this.orbitPitch) * dist + 1.8;

      desiredPos.set(p.x + offsetX, p.y + offsetY, p.z + offsetZ);
      desiredLook.set(p.x, p.y + 0.6, p.z + 2.5);
    } else {
      // 'LEAD' mode: Follow leading pack (1st & 2nd place blend)
      const leader = pool[0];
      const second = pool.length > 1 ? pool[1] : leader;
      const p1 = leader.getPosition();
      const p2 = second.getPosition();

      const blend = Math.abs(p1.z - p2.z) < 8 ? 0.3 : 0.0;
      const focusX = p1.x * (1 - blend) + p2.x * blend;
      const focusY = p1.y * (1 - blend) + p2.y * blend;
      const focusZ = p1.z * (1 - blend) + p2.z * blend;

      const offsetX = Math.sin(this.orbitYaw) * effectiveDist;
      const offsetZ = -Math.cos(this.orbitYaw) * effectiveDist;
      const offsetY = Math.sin(this.orbitPitch) * effectiveDist + 2.8;

      desiredPos.set(focusX + offsetX, focusY + offsetY, focusZ + offsetZ);
      desiredLook.set(focusX * 0.7, focusY + 0.6, focusZ + 5.5);
    }

    const smoothSpeed = this.isClimaxSlowMo ? 8.5 : 6.0;
    this.currentPos.lerp(desiredPos, Math.min(1, realDt * smoothSpeed));
    this.currentLookAt.lerp(desiredLook, Math.min(1, realDt * (smoothSpeed + 2)));

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }
}
