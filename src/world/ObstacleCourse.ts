import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MapTheme } from '../types';
import {
  GROUP_ENV,
  GROUP_LIMB,
  GROUP_TORSO,
  makeCollisionGroups,
  RagdollRacer,
} from '../entities/RagdollRacer';
import { ParticleSystem } from '../effects/ParticleSystem';
import { SoundManager } from '../audio/SoundManager';

export const TRACK_LENGTH = 146;
export const FINISH_Z = 132;
export const TRACK_SLOPE = 0.088;

interface SweeperData {
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  center: THREE.Vector3;
  armLength: number;
  speed: number;
  angle: number;
  blades: number;
  hitCooldowns: Map<string, number>;
}

interface MysteryDoorData {
  pivotGroup: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  basePos: THREE.Vector3;
  yaw: number;
  isPassable: boolean;
  isOpened: boolean;
  openAngle: number;
  hitCooldowns: Map<string, number>;
}

interface PopupBumperData {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  phase: number;
  freq: number;
  radius: number;
  hitCooldowns: Map<string, number>;
}

interface PinballBumperData {
  pos: THREE.Vector3;
  mesh: THREE.Group;
  radius: number;
  pulseScale: number;
  hitCooldowns: Map<string, number>;
}

interface WindFanData {
  zMin: number;
  zMax: number;
  dirX: number;
  force: number;
  bladesMesh: THREE.Group;
  streamParticles: THREE.Points;
}

interface ConveyorData {
  zMin: number;
  zMax: number;
  sideOffsetMin: number;
  sideOffsetMax: number;
  speedZ: number;
  texture: THREE.CanvasTexture;
}

interface PendulumData {
  body: RAPIER.RigidBody;
  pivotGroup: THREE.Group;
  pivotPos: THREE.Vector3;
  yaw: number;
  armLength: number;
  freq: number;
  phase: number;
  maxAngle: number;
  hitCooldowns: Map<string, number>;
}

export class ObstacleCourse {
  private world: RAPIER.World;
  private scene: THREE.Scene;
  public readonly mapTheme: MapTheme;
  private courseGroup: THREE.Group;
  private bodies: RAPIER.RigidBody[] = [];

  private startGateBody!: RAPIER.RigidBody;
  private startGateMesh!: THREE.Mesh;
  private gateOpen: boolean = false;
  private gateOpenProgress: number = 0;

  private sweepers: SweeperData[] = [];
  private mysteryDoors: MysteryDoorData[] = [];
  private popupBumpers: PopupBumperData[] = [];
  private pinballBumpers: PinballBumperData[] = [];
  private windFans: WindFanData[] = [];
  private conveyors: ConveyorData[] = [];
  private pendulums: PendulumData[] = [];

  private elapsedTime: number = 0;

  constructor(world: RAPIER.World, scene: THREE.Scene, mapTheme: MapTheme = 'PLAYGROUND') {
    this.world = world;
    this.scene = scene;
    this.mapTheme = mapTheme;
    this.courseGroup = new THREE.Group();
    this.scene.add(this.courseGroup);

    this.buildCurvedTrackAndScenery();
    this.buildStartGate();
    this.buildZone1Obstacles();
    this.buildZone2MysteryDoorsAndBumpers();
    this.buildZone3WindAndConveyors();
    this.buildZone4Bottleneck();
    this.buildZone5FinishArch();
  }

  private createBody(desc: RAPIER.RigidBodyDesc): RAPIER.RigidBody {
    const body = this.world.createRigidBody(desc);
    this.bodies.push(body);
    return body;
  }

  public dispose(): void {
    for (const body of this.bodies) {
      if (this.world.bodies.contains(body.handle)) {
        this.world.removeRigidBody(body);
      }
    }
    this.bodies = [];
    this.scene.remove(this.courseGroup);
  }

  public getTrackCenterX(z: number): number {
    // Keep starting grid & initial sprint (z <= 14) 100% straight so racers never snag at start
    if (z <= 14) return 0;
    const s = z - 14;
    const ease = Math.min(1, s / 18);
    const smoothEase = ease * ease * (3 - 2 * ease);
    return smoothEase * (Math.sin(s * 0.036) * 8.2 - Math.sin(s * 0.014) * 2.0);
  }

  public getTrackYawAtZ(z: number): number {
    const dz = 0.5;
    const dx = this.getTrackCenterX(z + dz) - this.getTrackCenterX(z - dz);
    return Math.atan2(dx, dz * 2);
  }

  public getTrackHeightAtZ(z: number): number {
    return -Math.tan(TRACK_SLOPE) * z;
  }

  public getTrackHalfWidthAtZ(z: number): number {
    // Narrow bottleneck bridge in Zone 4 (Z = 102 .. 124)
    if (z >= 98 && z < 105) {
      const t = (z - 98) / 7;
      return 9.0 * (1 - t) + 4.8 * t;
    }
    if (z >= 105 && z <= 122) {
      return 4.8;
    }
    if (z > 122 && z <= 128) {
      const t = (z - 122) / 6;
      return 4.8 * (1 - t) + 9.0 * t;
    }
    return 9.0;
  }

  public getZoneLabelAtZ(z: number): string {
    if (this.mapTheme === 'TAEKWONDO') {
      if (z < 42) return '🥋 태권도장';
      if (z < 72) return '🪵 송판 격파';
      if (z < 100) return '🌪️ 장풍 수련';
      if (z < FINISH_Z) return '⚔️ 대련장';
      return '🏆 승단 심사';
    }
    if (z < 42) return '🏠 교실';
    if (z < 72) return '❓ 복도 관문';
    if (z < 100) return '💨 강풍 통로';
    if (z < FINISH_Z) return '🏃 운동장';
    return '🏁 결승선';
  }

  private envCollisionGroup(): number {
    return makeCollisionGroups(GROUP_ENV, GROUP_TORSO | GROUP_LIMB | GROUP_ENV);
  }

  private createWoodFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#facc6b';
    ctx.fillRect(0, 0, 256, 256);

    const plankWidth = 32;
    for (let x = 0; x < 256; x += plankWidth) {
      ctx.fillStyle = (x / plankWidth) % 2 === 0 ? '#fcd34d' : '#f5be4f';
      ctx.fillRect(x, 0, plankWidth, 256);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(180, 83, 9, 0.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    return tex;
  }

  private createTaekwondoMatTexture(c1: string, c2: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Classic Blue & Red interlocking Taekwondojang EVA puzzle mat
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = c2;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);

    // Subtle puzzle seam lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 120, 120);
    ctx.strokeRect(132, 4, 120, 120);
    ctx.strokeRect(4, 132, 120, 120);
    ctx.strokeRect(132, 132, 120, 120);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    return tex;
  }

  private createPastelTileTexture(c1: string, c2: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = c2;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private createAthleticTrackTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#fff7ed';
    for (let i = 1; i < 6; i++) {
      ctx.fillRect((256 / 6) * i - 2, 0, 4, 256);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private createCheckeredTexture(c1: string, c2: string, rx: number, ry: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = c2;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillRect(64, 64, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    return tex;
  }

  private buildCurvedTrackAndScenery(): void {
    const envGroup = this.envCollisionGroup();
    const isTkd = this.mapTheme === 'TAEKWONDO';

    const zone1Mat = new THREE.MeshStandardMaterial({
      map: isTkd
        ? this.createTaekwondoMatTexture('#2563eb', '#dc2626')
        : this.createWoodFloorTexture(),
      roughness: 0.58,
      metalness: 0.05,
    });
    const zone2Mat = new THREE.MeshStandardMaterial({
      map: isTkd
        ? this.createWoodFloorTexture()
        : this.createPastelTileTexture('#bae6fd', '#e0f2fe'),
      roughness: 0.5,
      metalness: 0.05,
    });
    const zone3Mat = new THREE.MeshStandardMaterial({
      map: isTkd
        ? this.createTaekwondoMatTexture('#1d4ed8', '#f59e0b')
        : this.createPastelTileTexture('#a5f3fc', '#cffafe'),
      roughness: 0.45,
      metalness: 0.05,
    });
    const zone4Mat = new THREE.MeshStandardMaterial({
      map: isTkd
        ? this.createTaekwondoMatTexture('#b91c1c', '#1e40af')
        : this.createAthleticTrackTexture(),
      roughness: 0.68,
      metalness: 0.02,
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: isTkd ? 0xfef3c7 : 0xf8fafc,
      roughness: 0.65,
    });
    const wallCapMat = new THREE.MeshStandardMaterial({
      color: isTkd ? 0x92400e : 0xfbbf24,
      roughness: 0.4,
    });

    // Pure X-slope quaternion (zero Y-yaw!) for floor slabs so ALL floor pieces lie on the EXACT same mathematical plane with zero vertical step!
    const coplanarFloorQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(TRACK_SLOPE, 0, 0)
    );

    const stepZ = 4.0;
    for (let z0 = -4; z0 < 146; z0 += stepZ) {
      const z1 = z0 + stepZ;
      const zMid = (z0 + z1) * 0.5;
      const x0 = this.getTrackCenterX(z0);
      const x1 = this.getTrackCenterX(z1);
      const xMid = (x0 + x1) * 0.5;
      const yMid = this.getTrackHeightAtZ(zMid);

      const dx = x1 - x0;
      const dz = z1 - z0;
      const yaw = Math.atan2(dx, dz);
      const wallSegLen = Math.hypot(dx, dz) / Math.cos(TRACK_SLOPE) + 0.95;
      const floorSegLen = dz / Math.cos(TRACK_SLOPE) + 0.4;
      const halfW = this.getTrackHalfWidthAtZ(zMid);
      // Widen floor slab slightly by |dx| so curved walls are 100% supported without rotating the floor around Y
      const floorHalfW = halfW + Math.abs(dx) * 0.6 + 0.45;

      const wallQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(TRACK_SLOPE, yaw, 0, 'YXZ')
      );

      let floorMat = zone1Mat;
      if (zMid >= 42 && zMid < 72) floorMat = zone2Mat;
      else if (zMid >= 72 && zMid < 100) floorMat = zone3Mat;
      else if (zMid >= 100) floorMat = zone4Mat;

      const floorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(floorHalfW * 2, 1.2, floorSegLen),
        floorMat
      );
      floorMesh.position.set(xMid, yMid - 0.6, zMid);
      floorMesh.quaternion.copy(coplanarFloorQuat);
      floorMesh.receiveShadow = true;
      this.courseGroup.add(floorMesh);

      const floorBody = this.createBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(xMid, yMid - 0.6, zMid)
          .setRotation({
            x: coplanarFloorQuat.x,
            y: coplanarFloorQuat.y,
            z: coplanarFloorQuat.z,
            w: coplanarFloorQuat.w,
          })
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(floorHalfW, 0.6, floorSegLen * 0.5)
          .setFriction(0.12)
          .setRestitution(0.15)
          .setCollisionGroups(envGroup),
        floorBody
      );

      // Side walls
      const isBridge = zMid >= 103 && zMid <= 123;
      const wallHeight = zMid < 72 ? 3.2 : isBridge ? 0.9 : 1.7;
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);

      for (const side of [-1, 1]) {
        const wx = xMid + side * rightX * (halfW + 0.35);
        const wz = zMid + side * rightZ * (halfW + 0.35);
        const wy = yMid + wallHeight * 0.5;

        const wallMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, wallHeight, wallSegLen),
          wallMat
        );
        wallMesh.position.set(wx, wy, wz);
        wallMesh.quaternion.copy(wallQuat);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        this.courseGroup.add(wallMesh);

        if (!isBridge) {
          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(0.78, 0.22, wallSegLen),
            zMid >= 100
              ? new THREE.MeshStandardMaterial({ color: isTkd ? 0xdc2626 : 0x22c55e })
              : wallCapMat
          );
          cap.position.set(wx, yMid + wallHeight + 0.1, wz);
          cap.quaternion.copy(wallQuat);
          this.courseGroup.add(cap);
        }

        const wallBody = this.createBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(wx, wy, wz)
            .setRotation({ x: wallQuat.x, y: wallQuat.y, z: wallQuat.z, w: wallQuat.w })
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.38, wallHeight * 0.5 + 0.2, wallSegLen * 0.5)
            .setFriction(0.0)
            .setRestitution(0.4)
            .setCollisionGroups(envGroup),
          wallBody
        );
      }

      // Zone 1 Wall Decorations
      if (zMid >= 10 && zMid <= 40 && Math.round(z0) % 12 === 0) {
        for (const side of [-1, 1]) {
          const decoX = xMid + side * rightX * (halfW - 0.05);
          const decoZ = zMid + side * rightZ * (halfW - 0.05);
          const decoY = yMid + 2.0;

          if (isTkd) {
            // Taekwondo Dojo Banner ("태권도 · 백절불굴") or Hanji Lattice Window
            const board = new THREE.Mesh(
              new THREE.BoxGeometry(0.18, 1.5, 4.2),
              new THREE.MeshStandardMaterial({
                color: side === -1 ? 0x1e3a8a : 0x991b1b,
                roughness: 0.5,
              })
            );
            board.position.set(decoX, decoY, decoZ);
            board.quaternion.copy(wallQuat);
            this.courseGroup.add(board);
          } else if (side === -1) {
            const board = new THREE.Mesh(
              new THREE.BoxGeometry(0.18, 1.5, 4.4),
              new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 })
            );
            board.position.set(decoX, decoY, decoZ);
            board.quaternion.copy(wallQuat);
            this.courseGroup.add(board);
          } else {
            const win = new THREE.Mesh(
              new THREE.BoxGeometry(0.18, 1.4, 3.4),
              new THREE.MeshStandardMaterial({
                color: 0x7dd3fc,
                emissive: 0x38bdf8,
                emissiveIntensity: 0.2,
              })
            );
            win.position.set(decoX, decoY, decoZ);
            win.quaternion.copy(wallQuat);
            this.courseGroup.add(win);
          }
        }
      }
    }

    // Back wall behind starting area
    const backBody = this.createBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, this.getTrackHeightAtZ(-3.5) + 2, -3.5)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(9.5, 2.5, 0.5).setCollisionGroups(envGroup),
      backBody
    );

    // Surrounding ground & trees flanking Zone 4-5 (Z: 95..148)
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 80),
      new THREE.MeshStandardMaterial({
        color: isTkd ? 0xfde68a : 0x4ade80,
        roughness: 0.9,
      })
    );
    groundMesh.rotation.x = -Math.PI / 2 + TRACK_SLOPE;
    groundMesh.position.set(this.getTrackCenterX(120), this.getTrackHeightAtZ(120) - 1.5, 122);
    groundMesh.receiveShadow = true;
    this.courseGroup.add(groundMesh);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: isTkd ? 0x15803d : 0x22c55e,
      roughness: 0.65,
    });
    for (let tz = 96; tz <= 144; tz += 9) {
      const cx = this.getTrackCenterX(tz);
      const ty = this.getTrackHeightAtZ(tz) - 1.2;
      for (const side of [-1, 1]) {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(cx + side * (12 + Math.random() * 6), ty, tz);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.2, 8), trunkMat);
        trunk.position.y = 1.6;
        trunk.castShadow = true;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 10), leafMat);
        crown.position.y = 4.2;
        crown.castShadow = true;
        treeGroup.add(trunk, crown);
        this.courseGroup.add(treeGroup);
      }
    }

    // Overhead Zone Arch Signs
    if (isTkd) {
      this.addArchSign(11, '🥋 태권도장 수련 시작!', '#dc2626', '#fef2f2', '#991b1b');
      this.addArchSign(43, '🪵 송판 격파 관문', '#d97706', '#fef3c7', '#92400e');
      this.addArchSign(72, '🌪️ 장풍 & 스텝 수련', '#2563eb', '#dbeafe', '#1e3a8a');
      this.addArchSign(103, '⚔️ 챔피언 대련장', '#1e293b', '#f8fafc', '#0f172a');
    } else {
      this.addArchSign(11, '🏫 교실 출발!', '#f59e0b', '#fef3c7', '#92400e');
      this.addArchSign(43, '❓ 미스터리 관문', '#0284c7', '#e0f2fe', '#075985');
      this.addArchSign(72, '💨 강풍 & 컨베이어', '#0891b2', '#cffafe', '#155e75');
      this.addArchSign(103, '🏃 운동장', '#16a34a', '#dcfce7', '#14532d');
    }
  }

  private addArchSign(
    z: number,
    title: string,
    borderHex: string,
    bgHex: string,
    textHex: string
  ): void {
    const cx = this.getTrackCenterX(z);
    const y = this.getTrackHeightAtZ(z);
    const yaw = this.getTrackYawAtZ(z);
    const halfW = this.getTrackHalfWidthAtZ(z);

    const group = new THREE.Group();
    group.position.set(cx, y, z);
    group.rotation.y = yaw;

    const pillarColor = this.mapTheme === 'TAEKWONDO' ? 0xb91c1c : 0x16a34a;
    const pillarMat = new THREE.MeshStandardMaterial({ color: pillarColor, roughness: 0.4 });
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 6.8, 12), pillarMat);
      pillar.position.set(side * (halfW + 0.1), 3.4, 0);
      group.add(pillar);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bgHex;
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 84, 18);
    ctx.fill();
    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = textHex;
    ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, 49);

    const tex = new THREE.CanvasTexture(canvas);
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2 + 0.7, 1.45, 0.35),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    banner.position.set(0, 6.4, 0);
    group.add(banner);
    this.courseGroup.add(group);
  }

  private buildStartGate(): void {
    const z = 8.5;
    const cx = this.getTrackCenterX(z);
    const y = this.getTrackHeightAtZ(z);
    const isTkd = this.mapTheme === 'TAEKWONDO';
    const gateTex = this.createCheckeredTexture(
      isTkd ? '#dc2626' : '#fbbf24',
      isTkd ? '#2563eb' : '#ffffff',
      12,
      2
    );

    this.startGateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(17.8, 2.5, 0.5),
      new THREE.MeshStandardMaterial({ map: gateTex, roughness: 0.3 })
    );
    this.startGateMesh.position.set(cx, y + 1.25, z);
    this.startGateMesh.castShadow = true;
    this.courseGroup.add(this.startGateMesh);

    this.startGateBody = this.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(cx, y + 1.25, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(8.9, 1.25, 0.25).setCollisionGroups(this.envCollisionGroup()),
      this.startGateBody
    );
  }

  public openStartGate(): void {
    this.gateOpen = true;
  }

  private buildZone1Obstacles(): void {
    const obstaclePositions = [
      { z: 16, offset: -5.2 },
      { z: 18, offset: 4.5 },
      { z: 22, offset: -1.5 },
      { z: 24, offset: 5.5 },
      { z: 29, offset: -5.8 },
      { z: 31, offset: 1.2 },
      { z: 36, offset: -3.2 },
      { z: 37, offset: 4.8 },
    ];

    const envGroup = this.envCollisionGroup();

    if (this.mapTheme === 'TAEKWONDO') {
      // Standing Taekwondo Kicking Dummy Bags (Red & Blue 샌드백 미트)
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
      const redBagMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
      const blueBagMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
      const targetBandMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 });

      obstaclePositions.forEach((dp, idx) => {
        const cx = this.getTrackCenterX(dp.z);
        const yaw = this.getTrackYawAtZ(dp.z);
        const wx = cx + Math.cos(yaw) * dp.offset;
        const wz = dp.z - Math.sin(yaw) * dp.offset;
        const wy = this.getTrackHeightAtZ(dp.z);

        const bagGroup = new THREE.Group();
        bagGroup.position.set(wx, wy, wz);

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.45, 16), baseMat);
        base.position.y = 0.22;
        bagGroup.add(base);

        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.56, 0.56, 1.9, 18),
          idx % 2 === 0 ? redBagMat : blueBagMat
        );
        pad.position.y = 1.35;
        pad.castShadow = true;
        bagGroup.add(pad);

        const strikeRing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.58, 0.58, 0.26, 18),
          targetBandMat
        );
        strikeRing.position.y = 1.5;
        bagGroup.add(strikeRing);

        this.courseGroup.add(bagGroup);

        const body = this.createBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(wx, wy + 1.1, wz)
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.cylinder(1.1, 0.65)
            .setRestitution(0.95)
            .setCollisionGroups(envGroup),
          body
        );
      });

      // Martial Arts Spinning Sparring Bars (Black-belt & Red/Blue)
      this.createSweeper(20, -2.5, 4.6, 3.5, 3, 0x1e293b);
      this.createSweeper(28, 2.6, 4.8, -3.8, 2, 0xdc2626);
      this.createSweeper(35, 0, 5.8, 4.0, 3, 0x2563eb);
      return;
    }

    // PLAYGROUND: Cute School Desks
    const deskTopMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4 });

    for (const dp of obstaclePositions) {
      const cx = this.getTrackCenterX(dp.z);
      const yaw = this.getTrackYawAtZ(dp.z);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);

      const wx = cx + rightX * dp.offset;
      const wz = dp.z + rightZ * dp.offset;
      const wy = this.getTrackHeightAtZ(dp.z);

      const deskGroup = new THREE.Group();
      deskGroup.position.set(wx, wy, wz);
      deskGroup.rotation.y = yaw + (Math.random() - 0.5) * 0.35;

      const top = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.22, 1.15), deskTopMat);
      top.position.y = 0.92;
      top.castShadow = true;
      deskGroup.add(top);

      for (const lx of [-0.7, 0.7]) {
        for (const lz of [-0.42, 0.42]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), legMat);
          leg.position.set(lx, 0.45, lz);
          deskGroup.add(leg);
        }
      }
      this.courseGroup.add(deskGroup);

      const body = this.createBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(wx, wy + 0.55, wz)
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.88, 0.55, 0.58)
          .setRestitution(0.75)
          .setCollisionGroups(envGroup),
        body
      );
    }

    this.createSweeper(20, -2.5, 4.6, 3.3, 3, 0x2563eb);
    this.createSweeper(28, 2.6, 4.8, -3.6, 2, 0xf43f5e);
    this.createSweeper(35, 0, 5.8, 3.8, 3, 0x0ea5e9);
  }

  private createSweeper(
    z: number,
    lateralOffset: number,
    armLength: number,
    speed: number,
    blades: number = 2,
    barColorHex: number = 0xef4444
  ): void {
    const cx = this.getTrackCenterX(z);
    const yaw = this.getTrackYawAtZ(z);
    const wx = cx + Math.cos(yaw) * lateralOffset;
    const wz = z - Math.sin(yaw) * lateralOffset;
    const wy = this.getTrackHeightAtZ(z) + 0.95;
    const center = new THREE.Vector3(wx, wy, wz);

    const group = new THREE.Group();
    group.position.copy(center);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.8, 1.7, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 })
    );
    hub.castShadow = true;
    group.add(hub);

    const barMat = new THREE.MeshStandardMaterial({
      color: barColorHex,
      roughness: 0.25,
    });
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
    });

    for (let b = 0; b < blades; b++) {
      const armPivot = new THREE.Group();
      armPivot.rotation.y = (b * Math.PI * 2) / blades;

      const bar = new THREE.Mesh(new THREE.BoxGeometry(armLength, 0.52, 0.52), barMat);
      bar.position.x = armLength * 0.5;
      bar.castShadow = true;
      armPivot.add(bar);

      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.15), tipMat);
      tip.position.x = armLength - 0.2;
      tip.castShadow = true;
      armPivot.add(tip);

      group.add(armPivot);
    }

    this.courseGroup.add(group);

    const body = this.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, center.y, center.z)
    );
    for (let b = 0; b < blades; b++) {
      const a = (b * Math.PI * 2) / blades;
      const midDist = armLength * 0.5;
      const col = RAPIER.ColliderDesc.cuboid(armLength * 0.5, 0.45, 0.45)
        .setTranslation(Math.cos(a) * midDist, 0, -Math.sin(a) * midDist)
        .setRotation({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) })
        .setRestitution(0.95)
        .setCollisionGroups(this.envCollisionGroup());
      this.world.createCollider(col, body);
    }

    this.sweepers.push({
      body,
      mesh: group,
      center,
      armLength,
      speed,
      angle: Math.random() * Math.PI * 2,
      blades,
      hitCooldowns: new Map(),
    });
  }

  private buildZone2MysteryDoorsAndBumpers(): void {
    // 1. Mystery [?] Doors OR Pinewood Breaking Boards (송판 격파) at Z = 48
    this.buildMysteryDoorRow(48, 5);

    const isTkd = this.mapTheme === 'TAEKWONDO';

    // 2. Floor Pop-up Spring Bumpers & Pinball Pillars (Z = 54 .. 70)
    const popupSpecs = [
      { z: 54, offset: -4.0, phase: 0, freq: 3.4 },
      { z: 54, offset: 4.0, phase: 2.1, freq: 3.4 },
      { z: 60, offset: 0, phase: 1.0, freq: 3.9 },
      { z: 66, offset: -3.2, phase: 0.5, freq: 4.2 },
      { z: 66, offset: 3.2, phase: 2.7, freq: 4.2 },
    ];

    for (const ps of popupSpecs) {
      const cx = this.getTrackCenterX(ps.z);
      const yaw = this.getTrackYawAtZ(ps.z);
      const wx = cx + Math.cos(yaw) * ps.offset;
      const wz = ps.z - Math.sin(yaw) * ps.offset;
      const wy = this.getTrackHeightAtZ(ps.z);
      const basePos = new THREE.Vector3(wx, wy, wz);
      const radius = 1.65;

      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.9, 1.4, 20),
        new THREE.MeshStandardMaterial({
          color: isTkd ? 0x2563eb : 0x10b981,
          roughness: 0.25,
        })
      );
      mesh.position.set(basePos.x, basePos.y - 0.5, basePos.z);
      mesh.castShadow = true;
      this.courseGroup.add(mesh);

      const ringGeo = new THREE.RingGeometry(radius + 0.1, radius + 0.35, 24);
      ringGeo.rotateX(-Math.PI / 2 + TRACK_SLOPE);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
      );
      ring.position.set(basePos.x, basePos.y + 0.08, basePos.z);
      this.courseGroup.add(ring);

      const body = this.createBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          basePos.x,
          basePos.y - 0.5,
          basePos.z
        )
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.7, radius)
          .setRestitution(1.1)
          .setCollisionGroups(this.envCollisionGroup()),
        body
      );

      this.popupBumpers.push({
        body,
        mesh,
        basePos,
        phase: ps.phase,
        freq: ps.freq,
        radius,
        hitCooldowns: new Map(),
      });
    }

    const pinballSpecs = [
      { z: 57, offset: -4.8 },
      { z: 57, offset: 4.8 },
      { z: 63, offset: -2.2 },
      { z: 63, offset: 2.2 },
      { z: 69, offset: 0 },
    ];
    for (const pb of pinballSpecs) {
      const cx = this.getTrackCenterX(pb.z);
      const yaw = this.getTrackYawAtZ(pb.z);
      const wx = cx + Math.cos(yaw) * pb.offset;
      const wz = pb.z - Math.sin(yaw) * pb.offset;
      const wy = this.getTrackHeightAtZ(pb.z) + 1.1;
      const pos = new THREE.Vector3(wx, wy, wz);
      const radius = 1.15;

      const group = new THREE.Group();
      group.position.copy(pos);
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.85, 2.2, 20),
        new THREE.MeshStandardMaterial({
          color: isTkd ? 0xdc2626 : 0xec4899,
          roughness: 0.25,
        })
      );
      core.castShadow = true;
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 0.14, radius + 0.14, 0.45, 20),
        new THREE.MeshStandardMaterial({ color: 0xfef08a })
      );
      group.add(core, band);
      this.courseGroup.add(group);

      const body = this.createBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z)
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(1.1, radius)
          .setRestitution(1.25)
          .setCollisionGroups(this.envCollisionGroup()),
        body
      );

      this.pinballBumpers.push({
        pos,
        mesh: group,
        radius,
        pulseScale: 1.0,
        hitCooldowns: new Map(),
      });
    }
  }

  private buildMysteryDoorRow(z: number, doorCount: number): void {
    const cx = this.getTrackCenterX(z);
    const y = this.getTrackHeightAtZ(z);
    const yaw = this.getTrackYawAtZ(z);
    const halfW = this.getTrackHalfWidthAtZ(z);
    const totalW = halfW * 2;
    const slotW = totalW / doorCount;
    const doorW = slotW - 0.55;
    const isTkd = this.mapTheme === 'TAEKWONDO';

    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    // Frame header beam above doors
    const headerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(totalW + 0.6, 0.9, 0.8),
      new THREE.MeshStandardMaterial({
        color: isTkd ? 0x78350f : 0xd97706,
        roughness: 0.5,
      })
    );
    headerMesh.position.set(cx, y + 3.7, z);
    headerMesh.rotation.y = yaw;
    this.courseGroup.add(headerMesh);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    if (isTkd) {
      // Taekwondo Pinewood Breaking Board (송판 격파!)
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(0, 0, 128, 192);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 116, 180);
      // Wood grain lines
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.25)';
      ctx.lineWidth = 3;
      for (let gx = 20; gx < 120; gx += 22) {
        ctx.beginPath();
        ctx.moveTo(gx, 8);
        ctx.lineTo(gx, 184);
        ctx.stroke();
      }
      ctx.fillStyle = '#991b1b';
      ctx.font = '900 44px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('격파', 64, 78);
      ctx.font = '800 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('擊破', 64, 126);
    } else {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(0, 0, 128, 192);
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 112, 176);
      ctx.fillStyle = '#fef3c7';
      ctx.font = '800 84px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 64, 96);
    }
    const doorTex = new THREE.CanvasTexture(canvas);

    const passableFlags = Array.from({ length: doorCount }, (_, i) => i < 3);
    for (let i = passableFlags.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [passableFlags[i], passableFlags[j]] = [passableFlags[j], passableFlags[i]];
    }

    for (let i = 0; i < doorCount; i++) {
      const offset = -halfW + slotW * (i + 0.5);
      const dx = cx + rightX * offset;
      const dz = z + rightZ * offset;

      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(dx, y + 1.65, dz);
      pivotGroup.rotation.y = yaw;

      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(doorW, 3.3, isTkd ? 0.32 : 0.42),
        new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.45 })
      );
      doorMesh.castShadow = true;
      pivotGroup.add(doorMesh);
      this.courseGroup.add(pivotGroup);

      if (i < doorCount - 1) {
        const divOffset = -halfW + slotW * (i + 1);
        const px = cx + rightX * divOffset;
        const pz = z + rightZ * divOffset;
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 3.8, 0.7),
          new THREE.MeshStandardMaterial({ color: isTkd ? 0x1e293b : 0xb45309 })
        );
        pillar.position.set(px, y + 1.9, pz);
        pillar.rotation.y = yaw;
        this.courseGroup.add(pillar);
      }

      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      const body = this.createBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(dx, y + 1.65, dz)
          .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      );
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(doorW * 0.5, 1.65, 0.25)
          .setRestitution(0.75)
          .setCollisionGroups(this.envCollisionGroup()),
        body
      );

      this.mysteryDoors.push({
        pivotGroup,
        body,
        collider,
        basePos: new THREE.Vector3(dx, y + 1.65, dz),
        yaw,
        isPassable: passableFlags[i],
        isOpened: false,
        openAngle: 0,
        hitCooldowns: new Map(),
      });
    }
  }

  private buildZone3WindAndConveyors(): void {
    const beltSpecs = [
      { zMin: 75, zMax: 86, sideOffsetMin: -8.0, sideOffsetMax: -2.6, speedZ: 13.5, isBoost: true },
      { zMin: 75, zMax: 86, sideOffsetMin: -2.2, sideOffsetMax: 2.2, speedZ: -9.0, isBoost: false },
      { zMin: 75, zMax: 86, sideOffsetMin: 2.6, sideOffsetMax: 8.0, speedZ: 13.5, isBoost: true },
      { zMin: 87, zMax: 97, sideOffsetMin: -7.5, sideOffsetMax: 0.0, speedZ: -8.0, isBoost: false },
      { zMin: 87, zMax: 97, sideOffsetMin: 0.0, sideOffsetMax: 7.5, speedZ: 14.5, isBoost: true },
    ];

    for (const cfg of beltSpecs) {
      const zMid = (cfg.zMin + cfg.zMax) * 0.5;
      const cx = this.getTrackCenterX(zMid);
      const yaw = this.getTrackYawAtZ(zMid);
      const yMid = this.getTrackHeightAtZ(zMid) + 0.07;

      const width = cfg.sideOffsetMax - cfg.sideOffsetMin;
      const latMid = (cfg.sideOffsetMin + cfg.sideOffsetMax) * 0.5;
      const zLen = cfg.zMax - cfg.zMin;

      const wx = cx + Math.cos(yaw) * latMid;
      const wz = zMid - Math.sin(yaw) * latMid;

      const tex = this.createConveyorTexture(cfg.isBoost);
      tex.repeat.set(1, zLen * 0.45);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, zLen / Math.cos(TRACK_SLOPE)),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      mesh.position.set(wx, yMid, wz);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.y = yaw;
      mesh.rotation.x = -Math.PI / 2 + TRACK_SLOPE;
      this.courseGroup.add(mesh);

      this.conveyors.push({
        zMin: cfg.zMin,
        zMax: cfg.zMax,
        sideOffsetMin: cfg.sideOffsetMin,
        sideOffsetMax: cfg.sideOffsetMax,
        speedZ: cfg.speedZ,
        texture: tex,
      });
    }

    const fanConfigs = [
      { zMin: 75, zMax: 82, side: -1, dirX: 1, force: 34 },
      { zMin: 82.5, zMax: 89.5, side: 1, dirX: -1, force: 35 },
      { zMin: 90, zMax: 97, side: -1, dirX: 1, force: 34 },
    ];

    const isTkd = this.mapTheme === 'TAEKWONDO';

    for (const fc of fanConfigs) {
      const zMid = (fc.zMin + fc.zMax) * 0.5;
      const cx = this.getTrackCenterX(zMid);
      const yaw = this.getTrackYawAtZ(zMid);
      const yMid = this.getTrackHeightAtZ(zMid) + 2.3;
      const xHousing = cx + Math.cos(yaw) * (fc.side * 9.8);
      const zHousing = zMid - Math.sin(yaw) * (fc.side * 9.8);

      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.3, 1.2, 24),
        new THREE.MeshStandardMaterial({
          color: isTkd ? 0xb91c1c : 0x0284c7,
          roughness: 0.25,
        })
      );
      housing.rotation.z = Math.PI / 2;
      housing.position.set(xHousing, yMid, zHousing);
      this.courseGroup.add(housing);

      const bladesGroup = new THREE.Group();
      bladesGroup.position.set(xHousing - fc.side * 0.55, yMid, zHousing);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: isTkd ? 0xfacc15 : 0xffffff,
        roughness: 0.2,
      });
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.6, 0.72), bladeMat);
        blade.rotation.x = (b * Math.PI) / 3;
        bladesGroup.add(blade);
      }
      this.courseGroup.add(bladesGroup);

      const pCount = 45;
      const positions = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        positions[i * 3] = cx + (Math.random() - 0.5) * 16;
        positions[i * 3 + 1] = yMid - 1.2 + Math.random() * 2.4;
        positions[i * 3 + 2] = fc.zMin + Math.random() * (fc.zMax - fc.zMin);
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const streamParticles = new THREE.Points(
        pGeo,
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.36, transparent: true, opacity: 0.85 })
      );
      this.courseGroup.add(streamParticles);

      this.windFans.push({
        zMin: fc.zMin,
        zMax: fc.zMax,
        dirX: fc.dirX,
        force: fc.force,
        bladesMesh: bladesGroup,
        streamParticles,
      });
    }
  }

  private createConveyorTexture(isBoost: boolean): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = isBoost ? '#10b981' : '#f43f5e';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (isBoost) {
      ctx.moveTo(24, 36);
      ctx.lineTo(64, 88);
      ctx.lineTo(104, 36);
    } else {
      ctx.moveTo(24, 88);
      ctx.lineTo(64, 36);
      ctx.lineTo(104, 88);
    }
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private buildZone4Bottleneck(): void {
    const pConfigs = [
      { z: 108, freq: 2.35, phase: 0, maxAngle: 0.92 },
      { z: 115, freq: 2.6, phase: Math.PI, maxAngle: 0.92 },
      { z: 121, freq: 2.8, phase: Math.PI * 0.5, maxAngle: 0.92 },
    ];
    const isTkd = this.mapTheme === 'TAEKWONDO';

    for (const pc of pConfigs) {
      const cx = this.getTrackCenterX(pc.z);
      const yaw = this.getTrackYawAtZ(pc.z);
      const floorY = this.getTrackHeightAtZ(pc.z);
      const armLength = 6.2;
      const pivotPos = new THREE.Vector3(cx, floorY + armLength + 1.05, pc.z);

      const frameGroup = new THREE.Group();
      frameGroup.position.set(cx, floorY, pc.z);
      frameGroup.rotation.y = yaw;
      const frameMat = new THREE.MeshStandardMaterial({
        color: isTkd ? 0x1e293b : 0xf8fafc,
        roughness: 0.4,
      });
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 7.6, 12), frameMat);
        leg.position.set(side * 4.9, 3.8, 0);
        frameGroup.add(leg);
      }
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.45, 0.45), frameMat);
      crossbar.position.set(0, armLength + 1.05, 0);
      frameGroup.add(crossbar);
      this.courseGroup.add(frameGroup);

      const pivotGroup = new THREE.Group();
      pivotGroup.position.copy(pivotPos);
      pivotGroup.rotation.y = yaw;

      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, armLength, 10),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
      );
      rod.position.set(0, -armLength * 0.5, 0);
      pivotGroup.add(rod);

      const hammerMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.05, 2.2, 20),
        new THREE.MeshStandardMaterial({
          color: isTkd ? 0x1d4ed8 : 0xef4444,
          roughness: 0.25,
        })
      );
      hammerMesh.rotation.x = Math.PI / 2;
      hammerMesh.position.set(0, -armLength, 0);
      hammerMesh.castShadow = true;
      pivotGroup.add(hammerMesh);
      this.courseGroup.add(pivotGroup);

      const body = this.createBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          pivotPos.x,
          pivotPos.y - armLength,
          pivotPos.z
        )
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(1.1, 1.05)
          .setRotation({ x: 0.7071, y: 0, z: 0, w: 0.7071 })
          .setRestitution(1.1)
          .setCollisionGroups(this.envCollisionGroup()),
        body
      );

      this.pendulums.push({
        body,
        pivotGroup,
        pivotPos,
        yaw,
        armLength,
        freq: pc.freq,
        phase: pc.phase,
        maxAngle: pc.maxAngle,
        hitCooldowns: new Map(),
      });
    }
  }

  private buildZone5FinishArch(): void {
    const isTkd = this.mapTheme === 'TAEKWONDO';
    this.createSweeper(126, 0, 5.2, 4.0, 2, isTkd ? 0x0f172a : 0x3b82f6);

    const cx = this.getTrackCenterX(FINISH_Z);
    const yaw = this.getTrackYawAtZ(FINISH_Z);
    const finishY = this.getTrackHeightAtZ(FINISH_Z);
    const checkTex = this.createCheckeredTexture(
      isTkd ? '#facc15' : '#ffffff',
      '#0f172a',
      12,
      2
    );

    const finishGroup = new THREE.Group();
    finishGroup.position.set(cx, finishY, FINISH_Z);
    finishGroup.rotation.y = yaw;

    const finishStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 3.2),
      new THREE.MeshBasicMaterial({ map: checkTex, side: THREE.DoubleSide })
    );
    finishStrip.position.set(0, 0.08, 0);
    finishStrip.rotation.x = -Math.PI / 2 + TRACK_SLOPE;
    finishGroup.add(finishStrip);

    const archMat = new THREE.MeshStandardMaterial({
      color: isTkd ? 0x1e293b : 0xfacc15,
      roughness: 0.25,
    });
    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.2, 0.9), archMat);
      col.position.set(side * 8.6, 4.1, 0);
      col.castShadow = true;
      finishGroup.add(col);
    }

    const topBanner = new THREE.Mesh(
      new THREE.BoxGeometry(18.4, 1.8, 1.1),
      new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.3 })
    );
    topBanner.position.set(0, 7.9, 0);
    finishGroup.add(topBanner);

    this.courseGroup.add(finishGroup);
  }

  public resetCourseState(): void {
    this.gateOpen = false;
    this.gateOpenProgress = 0;
    const z = 8.5;
    const cx = this.getTrackCenterX(z);
    const baseY = this.getTrackHeightAtZ(z) + 1.25;
    this.startGateMesh.position.set(cx, baseY, z);
    this.startGateBody.setNextKinematicTranslation({ x: cx, y: baseY, z });

    if (this.mysteryDoors.length > 0) {
      const passableFlags = Array.from({ length: this.mysteryDoors.length }, (_, i) => i < 3);
      for (let i = passableFlags.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [passableFlags[i], passableFlags[j]] = [passableFlags[j], passableFlags[i]];
      }

      this.mysteryDoors.forEach((door, idx) => {
        door.isPassable = passableFlags[idx];
        door.isOpened = false;
        door.openAngle = 0;
        door.hitCooldowns.clear();
        door.pivotGroup.rotation.set(0, door.yaw, 0);
        door.collider.setSensor(false);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, door.yaw, 0));
        door.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      });
    }
  }

  public update(
    dt: number,
    racers: RagdollRacer[],
    particles: ParticleSystem,
    sound: SoundManager
  ): void {
    this.elapsedTime += dt;

    // 1. Start Gate animation
    if (this.gateOpen && this.gateOpenProgress < 1) {
      this.gateOpenProgress = Math.min(1, this.gateOpenProgress + dt * 3.2);
      const z = 8.5;
      const cx = this.getTrackCenterX(z);
      const baseY = this.getTrackHeightAtZ(z) + 1.25;
      const curY = baseY - this.gateOpenProgress * 4.2;
      this.startGateMesh.position.y = curY;
      this.startGateBody.setNextKinematicTranslation({ x: cx, y: curY, z });
    }

    // 2. Rotating Sweepers
    for (const sw of this.sweepers) {
      sw.angle += sw.speed * dt;
      const quat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        sw.angle
      );
      sw.mesh.quaternion.copy(quat);
      sw.body.setNextKinematicRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = sw.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.55) continue;

        const rPos = r.getPosition();
        const dx = rPos.x - sw.center.x;
        const dz = rPos.z - sw.center.z;
        if (Math.abs(rPos.y - sw.center.y) > 1.7) continue;

        for (let b = 0; b < sw.blades; b++) {
          const bladeAngle = sw.angle + (b * Math.PI * 2) / sw.blades;
          const bx = Math.cos(bladeAngle);
          const bz = -Math.sin(bladeAngle);
          const along = dx * bx + dz * bz;
          const perp = -dx * bz + dz * bx;

          if (along >= 0 && along <= sw.armLength + 0.5 && Math.abs(perp) <= 0.8) {
            sw.hitCooldowns.set(r.id, this.elapsedTime);
            const tangentX = -bz * Math.sign(sw.speed);
            const tangentZ = bx * Math.sign(sw.speed);
            r.triggerRagdoll(
              {
                x: tangentX * 34 + (Math.random() - 0.5) * 8,
                y: 24 + Math.random() * 10,
                z: tangentZ * 24 - 5,
              },
              undefined,
              1.25
            );
            particles.spawnHitBurst(rPos, '#38bdf8', 10);
            sound.playRagdollHit(1.2);
            break;
          }
        }
      }
    }

    // 3. Mystery [?] Doors / Taekwondo Pinewood Breaking Boards
    for (const door of this.mysteryDoors) {
      if (door.isOpened && door.openAngle < Math.PI * 0.48) {
        door.openAngle = Math.min(Math.PI * 0.48, door.openAngle + dt * 6.5);
        door.pivotGroup.rotation.y = door.yaw;
        door.pivotGroup.rotation.x = -door.openAngle;
      }
      if (door.isOpened) continue;

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = door.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.5) continue;

        const rPos = r.getPosition();
        const dist = Math.hypot(rPos.x - door.basePos.x, rPos.z - door.basePos.z);
        if (dist < 1.85 && Math.abs(rPos.y - door.basePos.y) < 2.2) {
          door.hitCooldowns.set(r.id, this.elapsedTime);
          if (door.isPassable) {
            door.isOpened = true;
            door.collider.setSensor(true);
            particles.spawnHitBurst(door.basePos, '#fbbf24', 14);
            sound.playBumperBounce();
          } else {
            r.triggerRagdoll(
              {
                x: (Math.random() - 0.5) * 14,
                y: 16,
                z: -24,
              },
              undefined,
              1.05
            );
            particles.spawnHitBurst(rPos, '#f43f5e', 10);
            sound.playRagdollHit(1.1);
          }
          break;
        }
      }
    }

    // 4. Pop-up Floor Bumpers
    for (const pb of this.popupBumpers) {
      const wave = Math.sin(this.elapsedTime * pb.freq + pb.phase);
      const popRatio = wave > 0.5 ? (wave - 0.5) * 2.0 : 0;
      const curY = pb.basePos.y - 0.55 + popRatio * 1.45;
      pb.mesh.position.y = curY;
      pb.body.setNextKinematicTranslation({ x: pb.basePos.x, y: curY, z: pb.basePos.z });

      if (popRatio > 0.25) {
        for (const r of racers) {
          if (r.state === 'FINISHED') continue;
          const lastHit = pb.hitCooldowns.get(r.id) || 0;
          if (this.elapsedTime - lastHit < 0.65) continue;

          const rPos = r.getPosition();
          if (
            Math.hypot(rPos.x - pb.basePos.x, rPos.z - pb.basePos.z) < pb.radius + 0.55 &&
            Math.abs(rPos.y - pb.basePos.y) < 2.2
          ) {
            pb.hitCooldowns.set(r.id, this.elapsedTime);
            r.triggerRagdoll(
              {
                x: (rPos.x - pb.basePos.x) * 16 + (Math.random() - 0.5) * 10,
                y: 40 + Math.random() * 10,
                z: -6 + Math.random() * 14,
              },
              undefined,
              1.3
            );
            particles.spawnHitBurst(rPos, '#10b981', 12);
            sound.playBumperBounce();
          }
        }
      }
    }

    // 5. Pinball Bumpers
    for (const pin of this.pinballBumpers) {
      if (pin.pulseScale > 1.0) {
        pin.pulseScale = Math.max(1.0, pin.pulseScale - dt * 4.5);
        pin.mesh.scale.set(pin.pulseScale, 1, pin.pulseScale);
      }
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = pin.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.45) continue;

        const rPos = r.getPosition();
        const dx = rPos.x - pin.pos.x;
        const dz = rPos.z - pin.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < pin.radius + 0.65 && Math.abs(rPos.y - pin.pos.y) < 1.8) {
          pin.hitCooldowns.set(r.id, this.elapsedTime);
          pin.pulseScale = 1.38;
          r.triggerRagdoll(
            { x: (dx / (dist || 1)) * 34, y: 18, z: (dz / (dist || 1)) * 30 },
            undefined,
            1.0
          );
          particles.spawnHitBurst(rPos, '#ec4899', 8);
          sound.playBumperBounce();
        }
      }
    }

    // 6. Conveyor Belts & Wind Fans
    for (const conv of this.conveyors) {
      conv.texture.offset.y -= conv.speedZ * dt * 0.12;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const rPos = r.getPosition();
        if (rPos.z < conv.zMin || rPos.z > conv.zMax) continue;
        const latOffset = rPos.x - this.getTrackCenterX(rPos.z);
        if (
          latOffset >= conv.sideOffsetMin &&
          latOffset <= conv.sideOffsetMax &&
          rPos.y - this.getTrackHeightAtZ(rPos.z) < 2.2
        ) {
          r.torsoBody.applyImpulse({ x: 0, y: 0, z: conv.speedZ * 3.4 * dt }, true);
        }
      }
    }

    for (const fan of this.windFans) {
      fan.bladesMesh.rotation.x += dt * 16 * fan.dirX;
      const posAttr = fan.streamParticles.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        const pz = posAttr.getZ(i);
        const cx = this.getTrackCenterX(pz);
        let px = posAttr.getX(i) + fan.dirX * 18 * dt;
        if (fan.dirX > 0 && px > cx + 8.5) px = cx - 8.5;
        if (fan.dirX < 0 && px < cx - 8.5) px = cx + 8.5;
        posAttr.setX(i, px);
      }
      posAttr.needsUpdate = true;

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const rPos = r.getPosition();
        if (rPos.z >= fan.zMin && rPos.z <= fan.zMax) {
          r.torsoBody.applyImpulse({ x: fan.dirX * fan.force * dt, y: 1.5 * dt, z: -2.0 * dt }, true);
        }
      }
    }

    // 7. Zone 4 Swinging Pendulums
    for (const pend of this.pendulums) {
      const swingAngle =
        Math.sin(this.elapsedTime * pend.freq + pend.phase) * pend.maxAngle;
      const angularVel =
        Math.cos(this.elapsedTime * pend.freq + pend.phase) *
        pend.freq *
        pend.maxAngle;

      pend.pivotGroup.rotation.z = swingAngle;
      const localX = Math.sin(swingAngle) * pend.armLength;
      const localY = -Math.cos(swingAngle) * pend.armLength;

      const hammerX = pend.pivotPos.x + Math.cos(pend.yaw) * localX;
      const hammerY = pend.pivotPos.y + localY;
      const hammerZ = pend.pivotPos.z - Math.sin(pend.yaw) * localX;

      pend.body.setNextKinematicTranslation({ x: hammerX, y: hammerY, z: hammerZ });

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = pend.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.6) continue;

        const rPos = r.getPosition();
        if (Math.hypot(rPos.x - hammerX, rPos.y - hammerY, rPos.z - hammerZ) < 2.0) {
          pend.hitCooldowns.set(r.id, this.elapsedTime);
          const dirX = Math.sign(angularVel) || 1;
          r.triggerRagdoll(
            { x: dirX * 38, y: 26, z: -10 + Math.random() * 14 },
            undefined,
            1.4
          );
          particles.spawnHitBurst(rPos, '#ef4444', 14);
          sound.playRagdollHit(1.5);
        }
      }
    }
  }
}
