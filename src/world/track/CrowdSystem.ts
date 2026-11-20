import * as THREE from 'three';
import type { MapTheme } from '../../types';
import { getTrackCenterX, getTrackHalfWidthAtZ, getTrackHeightAtZ, getTrackYawAtZ } from '../courseMath';

interface SpectatorEntry {
  baseX: number;
  baseY: number;
  baseZ: number;
  yaw: number;
  phase: number;
  jumpBias: number;
  side: number;
}

const CROWD_PALETTE = [
  0xff5fa2, 0x2bdfe8, 0xffe14d, 0xb48cff, 0x7df7c0, 0xfb923c, 0x38bdf8, 0xf43f5e,
];

export class CrowdSystem {
  private group: THREE.Group;
  private spectators: SpectatorEntry[] = [];
  private bodyInstanced: THREE.InstancedMesh | null = null;
  private headInstanced: THREE.InstancedMesh | null = null;
  private flagInstanced: THREE.InstancedMesh | null = null;
  private dummy = new THREE.Object3D();
  private excitementTimer = 0;
  private excitementLevel = 0;
  private updateAccum = 0;

  constructor(parent: THREE.Group, mapTheme: MapTheme, finishZ: number, isMobile: boolean) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.buildStandsAndSpectators(mapTheme, finishZ, isMobile);
  }

  private buildStandsAndSpectators(mapTheme: MapTheme, finishZ: number, isMobile: boolean): void {
    const standSegments = isMobile
      ? [
          { zStart: 2, zEnd: 10, rows: 2, cols: 4 },
          { zStart: finishZ - 7, zEnd: finishZ + 5, rows: 2, cols: 6 },
        ]
      : [
          { zStart: 2, zEnd: 10, rows: 2, cols: 5 },
          { zStart: Math.round(finishZ * 0.48), zEnd: Math.round(finishZ * 0.56), rows: 2, cols: 5 },
          { zStart: finishZ - 8, zEnd: finishZ + 6, rows: 3, cols: 7 },
        ];

    const standMat = new THREE.MeshStandardMaterial({
      color: mapTheme === 'TAEKWONDO' ? 0x1e293b : mapTheme === 'DINOSAUR' ? 0x78350f : 0xf8fafc,
      roughness: 0.72,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color:
        mapTheme === 'POOL'
          ? 0x22d3ee
          : mapTheme === 'FALLGUYS'
          ? 0xff5fa2
          : mapTheme === 'TAEKWONDO'
          ? 0xdc2626
          : mapTheme === 'DINOSAUR'
          ? 0x16a34a
          : 0xfacc15,
      roughness: 0.45,
    });

    for (const seg of standSegments) {
      const zMid = (seg.zStart + seg.zEnd) * 0.5;
      const segLen = Math.max(4, seg.zEnd - seg.zStart);
      const cx = getTrackCenterX(zMid);
      const cy = getTrackHeightAtZ(zMid);
      const yaw = getTrackYawAtZ(zMid);
      const hw = getTrackHalfWidthAtZ(zMid, mapTheme);

      for (const side of [-1, 1]) {
        const standGroup = new THREE.Group();
        const standDist = hw + 3.6;
        standGroup.position.set(cx + side * standDist, cy - 0.8, zMid);
        standGroup.rotation.y = yaw;

        for (let r = 0; r < seg.rows; r++) {
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(1.45, 0.9 + r * 0.75, segLen),
            standMat
          );
          step.position.set(side * r * 1.4, (0.9 + r * 0.75) * 0.5, 0);
          standGroup.add(step);

          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.16, segLen + 0.08),
            trimMat
          );
          stripe.position.set(side * r * 1.4, 0.9 + r * 0.75 + 0.04, 0);
          standGroup.add(stripe);

          for (let c = 0; c < seg.cols; c++) {
            const localZ = -segLen * 0.42 + (c / Math.max(1, seg.cols - 1)) * (segLen * 0.84);
            const localX = side * r * 1.4 + (Math.random() - 0.5) * 0.35;
            const localY = 0.9 + r * 0.75 + 0.12;

            // Transform stand-local coordinate to world-course space
            const cosY = Math.cos(yaw);
            const sinY = Math.sin(yaw);
            const wx = cx + side * standDist + localX * cosY + localZ * sinY;
            const wz = zMid - localX * sinY + localZ * cosY;
            const wy = cy - 0.8 + localY;

            this.spectators.push({
              baseX: wx,
              baseY: wy,
              baseZ: wz,
              yaw: yaw + (side === -1 ? Math.PI * 0.5 : -Math.PI * 0.5),
              phase: Math.random() * Math.PI * 2,
              jumpBias: 0.75 + Math.random() * 0.65,
              side,
            });
          }
        }
        this.group.add(standGroup);
      }
    }

    const count = this.spectators.length;
    if (count === 0) return;

    const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.35, 4, 10);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    this.bodyInstanced = new THREE.InstancedMesh(bodyGeo, bodyMat, count);

    const headGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: mapTheme === 'FALLGUYS' ? 0xffffff : 0xfde047,
      roughness: 0.38,
    });
    this.headInstanced = new THREE.InstancedMesh(headGeo, headMat, count);

    const flagGeo = new THREE.BoxGeometry(0.1, 0.68, 0.24);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    this.flagInstanced = new THREE.InstancedMesh(flagGeo, flagMat, count);

    const colorObj = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const hex = CROWD_PALETTE[i % CROWD_PALETTE.length];
      colorObj.setHex(hex);
      this.bodyInstanced.setColorAt(i, colorObj);
      if (mapTheme === 'FALLGUYS') {
        this.headInstanced.setColorAt(i, colorObj);
      }
      this.flagInstanced.setColorAt(
        i,
        colorObj.setHex(CROWD_PALETTE[(i + 3) % CROWD_PALETTE.length])
      );
    }
    this.bodyInstanced.instanceColor && (this.bodyInstanced.instanceColor.needsUpdate = true);
    this.headInstanced.instanceColor && (this.headInstanced.instanceColor.needsUpdate = true);
    this.flagInstanced.instanceColor && (this.flagInstanced.instanceColor.needsUpdate = true);

    this.group.add(this.bodyInstanced, this.headInstanced, this.flagInstanced);
    this.syncMatrices(0);
  }

  public triggerExcitement(intensity: number = 1.0, duration: number = 2.6): void {
    this.excitementLevel = Math.max(this.excitementLevel, intensity);
    this.excitementTimer = Math.max(this.excitementTimer, duration);
  }

  private syncMatrices(elapsedTime: number): void {
    if (!this.bodyInstanced || !this.headInstanced || !this.flagInstanced) return;
    const boost = this.excitementTimer > 0 ? 1 + this.excitementLevel * 1.4 : 1;
    const speed = this.excitementTimer > 0 ? 11.5 : 4.2;

    for (let i = 0; i < this.spectators.length; i++) {
      const s = this.spectators[i];
      const wave = Math.sin(elapsedTime * speed + s.phase);
      const hop = Math.max(0, wave) * 0.34 * s.jumpBias * boost;

      // Body
      this.dummy.position.set(s.baseX, s.baseY + 0.42 + hop, s.baseZ);
      this.dummy.rotation.set(0, s.yaw, Math.sin(elapsedTime * speed * 0.5 + s.phase) * 0.08 * boost);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.bodyInstanced.setMatrixAt(i, this.dummy.matrix);

      // Head
      this.dummy.position.set(s.baseX, s.baseY + 0.96 + hop * 1.08, s.baseZ);
      this.dummy.rotation.set(wave * 0.1, s.yaw, 0);
      this.dummy.updateMatrix();
      this.headInstanced.setMatrixAt(i, this.dummy.matrix);

      // Cheering stick / pennant
      const armWave = Math.sin(elapsedTime * speed * 1.35 + s.phase) * (0.4 + 0.45 * boost);
      const stickX = s.baseX + Math.cos(s.yaw) * 0.38;
      const stickZ = s.baseZ - Math.sin(s.yaw) * 0.38;
      this.dummy.position.set(stickX, s.baseY + 0.85 + hop * 1.15, stickZ);
      this.dummy.rotation.set(armWave, s.yaw, 0.28);
      this.dummy.updateMatrix();
      this.flagInstanced.setMatrixAt(i, this.dummy.matrix);
    }

    this.bodyInstanced.instanceMatrix.needsUpdate = true;
    this.headInstanced.instanceMatrix.needsUpdate = true;
    this.flagInstanced.instanceMatrix.needsUpdate = true;
  }

  public update(dt: number, elapsedTime: number): void {
    if (this.excitementTimer > 0) {
      this.excitementTimer = Math.max(0, this.excitementTimer - dt);
      if (this.excitementTimer === 0) {
        this.excitementLevel = 0;
      }
    }
    this.updateAccum += dt;
    if (this.updateAccum < 0.033 && this.excitementTimer === 0) return;
    this.updateAccum = 0;
    this.syncMatrices(elapsedTime);
  }
}
