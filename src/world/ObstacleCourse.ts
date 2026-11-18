import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import type { FlickMode, MapTheme, ObstacleDensity } from '../types';
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
export const DINO_TRACK_LENGTH = 244;
export const DINO_FINISH_Z = 228;
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
  rowGroup: number;
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

interface SlidingShieldData {
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  baseZ: number;
  baseY: number;
  halfW: number;
  halfH: number;
  halfD: number;
  ampX: number;
  freq: number;
  phase: number;
  lastX: number;
  hitCooldowns: Map<string, number>;
}

interface SpringboardData {
  z: number;
  offsetX: number;
  halfW: number;
  halfL: number;
  boostZ: number;
  boostY: number;
  mesh: THREE.Group;
  hitCooldowns: Map<string, number>;
}

interface ShockwaveDrumData {
  zMin: number;
  zMax: number;
  side: number;
  dirX: number;
  freq: number;
  phase: number;
  drumMesh: THREE.Group;
  waveMesh: THREE.Mesh;
  hitCooldowns: Map<string, number>;
}

interface GiantFlickHandData {
  slotIndex: number;
  root: THREE.Group;
  middleFingerPivot: THREE.Group;
  shockwaveMesh: THREE.Mesh;
  comicSprite: THREE.Sprite;
  phase: 'IDLE' | 'WINDUP' | 'IMPACT' | 'DONE';
  phaseTimer: number;
  targetRacer: RagdollRacer | null;
  impactPos: THREE.Vector3;
  isManual: boolean;
  isCharacterBasher?: boolean;
  charBodyPivot?: THREE.Group;
  charLeftArmPivot?: THREE.Group;
  charRightArmPivot?: THREE.Group;
  charLeftLegPivot?: THREE.Group;
  charRightLegPivot?: THREE.Group;
}

interface FlyingPterosaurData {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  radiusX: number;
  canDropPoop: boolean;
  dropTimer: number;
  dropInterval: number;
}

interface AnimatedDinoPart {
  part: THREE.Group;
  baseRotX: number;
  amp: number;
  freq: number;
  phase: number;
}

interface RunningTRexData {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  jawPivot: THREE.Group;
  body: RAPIER.RigidBody;
  zMin: number;
  zMax: number;
  curZ: number;
  laneOffset: number;
  speedZ: number;
  scale: number;
  phase: number;
  hitCooldowns: Map<string, number>;
}

interface FallingPoopData {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vy: number;
}

interface PoopPuddleData {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  lifeLeft: number;
  maxLife: number;
}

interface TurboPadData {
  z: number;
  offsetX: number;
  halfW: number;
  halfL: number;
  texture: THREE.CanvasTexture;
  hitCooldowns: Map<string, number>;
}

interface RollingBoulderData {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  zStart: number;
  zEnd: number;
  curZ: number;
  speedZ: number;
  laneAmp: number;
  laneFreq: number;
  phase: number;
  radius: number;
  hitCooldowns: Map<string, number>;
}

interface LavaGeyserData {
  z: number;
  offsetX: number;
  radius: number;
  plumeMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  freq: number;
  phase: number;
  hitCooldowns: Map<string, number>;
}

interface PoolDropZoneData {
  z: number;
  halfZ: number;
  timer: number;
  interval: number;
  ringMesh: THREE.Mesh;
  warnLights: THREE.Mesh[];
}

interface PoolDropData {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vy: number;
  radius: number;
  kind: 'BALLOON' | 'DUCK';
  marker: THREE.Mesh;
}

interface FallguysCushionData {
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  pos: THREE.Vector3;
  radius: number;
  squash: number;
  hitCooldowns: Map<string, number>;
}

interface FallguysPunchWallData {
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  baseZ: number;
  baseY: number;
  halfW: number;
  halfH: number;
  halfD: number;
  ampX: number;
  freq: number;
  phase: number;
  lastX: number;
  hitCooldowns: Map<string, number>;
}

interface FallguysPistonData {
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  z: number;
  side: number;
  baseY: number;
  restX: number;
  stroke: number;
  phase: number;
  freq: number;
  halfW: number;
  halfH: number;
  halfD: number;
  hitCooldowns: Map<string, number>;
}

export class ObstacleCourse {
  private world: RAPIER.World;
  private scene: THREE.Scene;
  public readonly mapTheme: MapTheme;
  public readonly obstacleDensity: ObstacleDensity;
  public readonly finishZ: number;
  public readonly trackLength: number;
  private flickMode: FlickMode;
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
  private slidingShields: SlidingShieldData[] = [];
  private springboards: SpringboardData[] = [];
  private shockwaveDrums: ShockwaveDrumData[] = [];
  private flyingPterosaurs: FlyingPterosaurData[] = [];
  private animatedDinoParts: AnimatedDinoPart[] = [];
  private runningTRexes: RunningTRexData[] = [];
  private fallingPoops: FallingPoopData[] = [];
  private poolDropZones: PoolDropZoneData[] = [];
  private poolDrops: PoolDropData[] = [];
  private fallguysCushions: FallguysCushionData[] = [];
  private fallguysPunchWalls: FallguysPunchWallData[] = [];
  private fallguysPistons: FallguysPistonData[] = [];
  private poolSplashes: { mesh: THREE.Mesh; life: number; maxLife: number }[] = [];
  private poopPuddles: PoopPuddleData[] = [];
  private turboPads: TurboPadData[] = [];
  private rollingBoulders: RollingBoulderData[] = [];
  private lavaGeysers: LavaGeyserData[] = [];
  private overheadBanners: {
    mat: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
    z: number;
  }[] = [];

  private giantFlickHands: GiantFlickHandData[] = [];
  private flickedRacerIds: Set<string> = new Set();
  private static bossGlbTemplate: THREE.Group | null = null;
  private static bossGlbLoadPromise: Promise<THREE.Group | null> | null = null;
  public onFinishFlick?: (
    racer: RagdollRacer,
    flickNumber: number,
    isManual: boolean
  ) => void;
  public onPoolSplash?: (racer: RagdollRacer, kind: 'BALLOON' | 'DUCK') => void;

  private elapsedTime: number = 0;

  constructor(
    world: RAPIER.World,
    scene: THREE.Scene,
    mapTheme: MapTheme = 'PLAYGROUND',
    obstacleDensity: ObstacleDensity = 'NORMAL',
    flickMode: FlickMode = 'DOUBLE'
  ) {
    this.world = world;
    this.scene = scene;
    this.mapTheme = mapTheme;
    this.obstacleDensity = obstacleDensity;
    this.finishZ = mapTheme === 'DINOSAUR' ? DINO_FINISH_Z : FINISH_Z;
    this.trackLength = mapTheme === 'DINOSAUR' ? DINO_TRACK_LENGTH : TRACK_LENGTH;
    this.flickMode = flickMode;
    this.courseGroup = new THREE.Group();
    this.scene.add(this.courseGroup);

    this.buildCurvedTrackAndScenery();
    this.buildStartGate();

    if (this.mapTheme === 'TAEKWONDO') {
      this.buildTaekwondoCourse();
    } else if (this.mapTheme === 'DINOSAUR') {
      this.buildDinosaurCourse();
    } else if (this.mapTheme === 'POOL') {
      this.buildPoolCourse();
    } else if (this.mapTheme === 'FALLGUYS') {
      this.buildFallguysCourse();
    } else {
      this.buildPlaygroundCourse();
    }

    this.buildFinishFlickHands();
  }

  public setFlickMode(mode: FlickMode): void {
    this.flickMode = mode;
    if (this.flickMode === 'OFF') {
      for (const h of this.giantFlickHands) {
        if (h.phase === 'IDLE') {
          h.root.visible = false;
        }
      }
    } else {
      const slot0 = this.giantFlickHands[0];
      if (slot0 && slot0.phase === 'IDLE') {
        slot0.root.visible = true;
      }
    }
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
    // 수영장·폴가이즈 맵은 좁아지는 병목 다리 없이 넓은 트랙을 유지한다
    if (this.mapTheme === 'POOL' || this.mapTheme === 'FALLGUYS') {
      return 9.0;
    }

    if (this.mapTheme === 'DINOSAUR') {
      // Narrow Canyon Bridge near end of long Dinosaur Kart track (Z = 180 .. 214)
      if (z >= 180 && z < 186) {
        const t = (z - 180) / 6;
        return 9.0 * (1 - t) + 5.6 * t;
      }
      if (z >= 186 && z <= 208) {
        return 5.6;
      }
      if (z > 208 && z <= 214) {
        const t = (z - 208) / 6;
        return 5.6 * (1 - t) + 9.0 * t;
      }
      return 9.0;
    }

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
      if (z < 42) return '🥋 태비태권도장';
      if (z < 72) return '🪵 송판 & 기와 격파';
      if (z < 100) return '🥁 기합 장풍 존';
      if (z < this.finishZ) return '⚔️ 대련장';
      return '🏆 승단 심사';
    }
    if (this.mapTheme === 'DINOSAUR') {
      if (z < 62) return '🏎️ 공룡 정글 서킷';
      if (z < 120) return '🦖 티라노 추격 지대';
      if (z < 180) return '💩 익룡 똥 & 화산 계곡';
      if (z < this.finishZ) return '🌋 최후의 공룡 협곡';
      return '🏆 정글 탈출 성공';
    }
    if (this.mapTheme === 'POOL') {
      if (z < 42) return '🎢 워터슬라이드';
      if (z < 66) return '🛟 튜브 범퍼 슬라럼';
      if (z < 82) return '💧 물벼락 낙하 존';
      if (z < 100) return '🌊 물살 컨베이어';
      if (z < this.finishZ) return '🏄 빅웨이브 풀';
      return '🏁 수영장 완주!';
    }
    if (this.mapTheme === 'FALLGUYS') {
      if (z < 42) return '🫧 에어 쿠션 범퍼 존';
      if (z < 72) return '🌀 대형 회전 빔 점프';
      if (z < 100) return '🥊 풍선 펀치월 · 피스톤';
      if (z < this.finishZ) return '🟢 슬라임 가속 램프';
      return '👑 왕관 결승선!';
    }
    if (z < 42) return '🏠 교실';
    if (z < 72) return '❓ 복도 관문';
    if (z < 100) return '💨 강풍 통로';
    if (z < this.finishZ) return '🏃 운동장';
    return '🏁 결승선';
  }

  private envCollisionGroup(): number {
    return makeCollisionGroups(GROUP_ENV, GROUP_TORSO | GROUP_LIMB | GROUP_ENV);
  }

  /**
   * Builds a curved ribbon mesh whose every vertex sits strictly at
   * y = getTrackHeightAtZ(z) + yOffset, guaranteeing zero floor sinking or z-fighting
   * even along steep S-curves!
   */
  private createCurvedFloorStripGeometry(
    zMin: number,
    zMax: number,
    sideOffsetMin: number,
    sideOffsetMax: number,
    yOffset: number = 0.08,
    slices: number = 14
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const totalLen = zMax - zMin;
    const ny = Math.cos(TRACK_SLOPE);
    const nz = Math.sin(TRACK_SLOPE);

    for (let i = 0; i <= slices; i++) {
      const t = i / slices;
      const z = zMin + totalLen * t;
      const cx = this.getTrackCenterX(z);
      const y = this.getTrackHeightAtZ(z) + yOffset;

      const xL = cx + sideOffsetMin;
      const xR = cx + sideOffsetMax;

      positions.push(xL, y, z, xR, y, z);
      normals.push(0, ny, nz, 0, ny, nz);
      uvs.push(0, t, 1, t);

      if (i < slices) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1);
        indices.push(base + 1, base + 2, base + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
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

    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = c2;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
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
    const isDino = this.mapTheme === 'DINOSAUR';
    const isPool = this.mapTheme === 'POOL';
    const isFg = this.mapTheme === 'FALLGUYS';

    const zone1Mat = new THREE.MeshStandardMaterial({
      map: isTkd
        ? this.createTaekwondoMatTexture('#2563eb', '#dc2626')
        : isFg
        ? this.createCheckeredTexture('#ffd1e3', '#fff6fb', 6, 10)
        : isDino
        ? this.createPastelTileTexture('#86efac', '#4ade80')
        : isPool
        ? this.createPastelTileTexture('#a5f3fc', '#67e8f9')
        : this.createWoodFloorTexture(),
      roughness: isPool ? 0.24 : isFg ? 0.3 : 0.58,
      metalness: isPool ? 0.14 : isFg ? 0.1 : 0.05,
    });
    const zone2Mat = new THREE.MeshStandardMaterial({
      map: isTkd
        ? this.createWoodFloorTexture()
        : isFg
        ? this.createPastelTileTexture('#fff2ae', '#b8f5e0')
        : isDino
        ? this.createPastelTileTexture('#fde68a', '#fcd34d')
        : isPool
        ? this.createPastelTileTexture('#99f6e4', '#5eead4')
        : this.createPastelTileTexture('#bae6fd', '#e0f2fe'),
      roughness: isPool ? 0.24 : isFg ? 0.3 : 0.5,
      metalness: isPool ? 0.14 : isFg ? 0.1 : 0.05,
    });
    const zone3Mat = new THREE.MeshStandardMaterial({
      map: isTkd
        ? this.createTaekwondoMatTexture('#1e3a8a', '#1d4ed8')
        : isFg
        ? this.createPastelTileTexture('#c2ebff', '#ffffff')
        : isDino
        ? this.createPastelTileTexture('#475569', '#334155')
        : isPool
        ? this.createPastelTileTexture('#bfdbfe', '#93c5fd')
        : this.createPastelTileTexture('#a5f3fc', '#cffafe'),
      roughness: isPool ? 0.24 : isFg ? 0.3 : 0.45,
      metalness: isPool ? 0.14 : isFg ? 0.1 : 0.05,
    });
    const zone4Mat = new THREE.MeshStandardMaterial({
      map: isTkd
        ? this.createTaekwondoMatTexture('#b91c1c', '#1e40af')
        : isFg
        ? this.createCheckeredTexture('#ffe066', '#a8e6ff', 6, 14)
        : isDino
        ? this.createWoodFloorTexture()
        : isPool
        ? this.createCheckeredTexture('#38bdf8', '#f0fdff', 6, 14)
        : this.createAthleticTrackTexture(),
      roughness: isPool ? 0.24 : isFg ? 0.34 : 0.68,
      metalness: isPool ? 0.14 : isFg ? 0.08 : 0.02,
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: isTkd
        ? 0xfef3c7
        : isDino
        ? 0x57534e
        : isPool
        ? 0xf0fdff
        : isFg
        ? 0xffffff
        : 0xf8fafc,
      roughness: 0.65,
    });
    const wallCapMat = new THREE.MeshStandardMaterial({
      color: isTkd
        ? 0x92400e
        : isDino
        ? 0x16a34a
        : isPool
        ? 0x22d3ee
        : isFg
        ? 0xff6fb5
        : 0xfbbf24,
      roughness: 0.4,
    });

    const coplanarFloorQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(TRACK_SLOPE, 0, 0)
    );

    const stepZ = 4.0;
    for (let z0 = -4; z0 < this.trackLength; z0 += stepZ) {
      const z1 = z0 + stepZ;
      const zMid = (z0 + z1) * 0.5;
      const x0 = this.getTrackCenterX(z0);
      const x1 = this.getTrackCenterX(z1);
      const xMid = (x0 + x1) * 0.5;
      const yMid = this.getTrackHeightAtZ(zMid);

      const dx = x1 - x0;
      const dz = z1 - z0;
      const yaw = Math.atan2(dx, dz);
      const floorSegLen = dz / Math.cos(TRACK_SLOPE) + 0.4;
      const halfW = this.getTrackHalfWidthAtZ(zMid);
      const floorHalfW = halfW + Math.abs(dx) * 0.6 + 0.45;

      const wallQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(TRACK_SLOPE, yaw, 0, 'YXZ')
      );

      let floorMat = zone1Mat;
      if (isDino) {
        if (zMid >= 62 && zMid < 120) floorMat = zone2Mat;
        else if (zMid >= 120 && zMid < 180) floorMat = zone3Mat;
        else if (zMid >= 180) floorMat = zone4Mat;
      } else {
        if (zMid >= 42 && zMid < 72) floorMat = zone2Mat;
        else if (zMid >= 72 && zMid < 100) floorMat = zone3Mat;
        else if (zMid >= 100) floorMat = zone4Mat;
      }

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
          .setFriction(isDino ? 0.05 : isFg ? 0.09 : 0.12)
          .setRestitution(0.15)
          .setCollisionGroups(envGroup),
        floorBody
      );

      const isBridge = isPool || isFg
        ? false
        : isDino
        ? zMid >= 184 && zMid <= 210
        : zMid >= 103 && zMid <= 123;
      const wallCutoffZ = isDino ? 120 : 72;
      const wallHeight = isFg ? 1.9 : zMid < wallCutoffZ ? 3.0 : isBridge ? 0.95 : 1.75;
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);

      const hw0 = this.getTrackHalfWidthAtZ(z0);
      const hw1 = this.getTrackHalfWidthAtZ(z1);

      for (const side of [-1, 1]) {
        const wx0 = x0 + side * (hw0 + 0.35);
        const wx1 = x1 + side * (hw1 + 0.35);
        const wx = (wx0 + wx1) * 0.5;
        const wz = zMid;
        const wy = yMid + wallHeight * 0.5;

        const wDx = wx1 - wx0;
        const wYaw = Math.atan2(wDx, dz);
        const wSegLen = Math.hypot(wDx, dz) / Math.cos(TRACK_SLOPE) + 0.85;
        const sideWallQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(TRACK_SLOPE, wYaw, 0, 'YXZ')
        );

        const wallMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, wallHeight, wSegLen),
          wallMat
        );
        wallMesh.position.set(wx, wy, wz);
        wallMesh.quaternion.copy(sideWallQuat);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        this.courseGroup.add(wallMesh);

        if (!isBridge) {
          const capColor = isPool
            ? zMid >= 100
              ? 0xf472b6
              : null
            : isFg
            ? [0xff6fb5, 0x5ee7c7, 0xffe066, 0x7cc9ff][Math.floor(Math.abs(zMid) / 8) % 4]
            : isDino
            ? zMid >= 120 && zMid < 180
              ? 0xea580c
              : zMid >= 180
              ? 0xca8a04
              : null
            : zMid >= 100
            ? isTkd
              ? 0xdc2626
              : 0x22c55e
            : null;
          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(0.78, 0.22, wSegLen),
            capColor !== null
              ? new THREE.MeshStandardMaterial({ color: capColor })
              : wallCapMat
          );
          cap.position.set(wx, yMid + wallHeight + 0.1, wz);
          cap.quaternion.copy(sideWallQuat);
          this.courseGroup.add(cap);
        }

        const colliderHalfH = isBridge ? wallHeight * 0.5 + 0.2 : wallHeight * 0.5 + 2.2;
        const colliderCenterY = isBridge ? wy : yMid + colliderHalfH;
        const wallBody = this.createBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(wx, colliderCenterY, wz)
            .setRotation({
              x: sideWallQuat.x,
              y: sideWallQuat.y,
              z: sideWallQuat.z,
              w: sideWallQuat.w,
            })
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.42, colliderHalfH, wSegLen * 0.5)
            .setFriction(0.0)
            .setRestitution(0.4)
            .setCollisionGroups(envGroup),
          wallBody
        );
      }

      if (zMid >= 10 && zMid <= (isDino ? 58 : 40) && Math.round(z0) % 12 === 0) {
        for (const side of [-1, 1]) {
          const decoX = xMid + side * rightX * (halfW - 0.05);
          const decoZ = zMid + side * rightZ * (halfW - 0.05);
          const decoY = yMid + 2.0;

          if (isTkd) {
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
          } else if (isDino) {
            const vine = new THREE.Mesh(
              new THREE.BoxGeometry(0.22, 1.4, 4.0),
              new THREE.MeshStandardMaterial({
                color: side === -1 ? 0x15803d : 0x65a30d,
                roughness: 0.75,
              })
            );
            vine.position.set(decoX, decoY, decoZ);
            vine.quaternion.copy(wallQuat);
            this.courseGroup.add(vine);
          } else if (isPool) {
            const rope = new THREE.Mesh(
              new THREE.BoxGeometry(0.22, 0.42, 4.0),
              new THREE.MeshStandardMaterial({
                color: side === -1 ? 0x0ea5e9 : 0x22d3ee,
                roughness: 0.35,
              })
            );
            rope.position.set(decoX, yMid + 0.9, decoZ);
            rope.quaternion.copy(wallQuat);
            this.courseGroup.add(rope);
          } else if (isFg) {
            // 폴가이즈: 파스텔 캔디 패널 + 하트 도장
            const panelColor = side === -1 ? 0xff8cc0 : 0x7fe7cf;
            const panel = new THREE.Mesh(
              new THREE.BoxGeometry(0.2, 0.9, 4.0),
              new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.35 })
            );
            panel.position.set(decoX, yMid + 1.0, decoZ);
            panel.quaternion.copy(wallQuat);
            this.courseGroup.add(panel);

            const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
            for (let d = -1; d <= 1; d++) {
              const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), dotMat);
              dot.position.set(decoX, yMid + 1.0, decoZ + d * 1.15);
              dot.scale.set(0.6, 1, 1);
              this.courseGroup.add(dot);
            }
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

    const groundW = isDino ? 190 : 130;
    const groundL = isDino ? 290 : 160;
    const groundCenterZ = isDino ? 134 : 86;
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(groundW, groundL),
      new THREE.MeshStandardMaterial({
        color: isTkd
          ? 0xfde68a
          : isDino
          ? 0x15803d
          : isPool
          ? 0x0ea5e9
          : isFg
          ? 0xffd1e8
          : 0x4ade80,
        roughness: 0.9,
      })
    );
    groundMesh.rotation.x = -Math.PI / 2 + TRACK_SLOPE;
    groundMesh.position.set(
      this.getTrackCenterX(groundCenterZ),
      this.getTrackHeightAtZ(groundCenterZ) - 2.4,
      groundCenterZ
    );
    groundMesh.receiveShadow = true;
    this.courseGroup.add(groundMesh);

    if (isDino) {
      this.buildDinosaurJungleScenery();
    } else if (isPool) {
      this.buildPoolScenery();
    } else if (isFg) {
      this.buildFallguysScenery();
    } else {
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
    }

    if (isTkd) {
      this.addArchSign(11, '태비태권도 수련 시작!', '#dc2626', '#fef2f2', '#991b1b', true);
      this.addArchSign(43, '🪵 송판 & 기와 격파!', '#d97706', '#fef3c7', '#92400e');
      this.addArchSign(72, '🥁 기합 장풍 & 품새 스텝', '#2563eb', '#dbeafe', '#1e3a8a');
      this.addArchSign(103, '⚔️ 챔피언 대련장', '#1e293b', '#f8fafc', '#0f172a');
    } else if (isDino) {
      this.addArchSign(11, '🏎️ 공룡 정글 카트 출발!', '#15803d', '#dcfce7', '#14532d');
      this.addArchSign(62, '🦖 티라노가 달려온다!!', '#dc2626', '#fee2e2', '#7f1d1d');
      this.addArchSign(120, '💩 익룡 똥 폭격 & 화산 계곡', '#d97706', '#fef3c7', '#78350f');
      this.addArchSign(182, '🌋 최후의 공룡 협곡 스퍼트!', '#7c2d12', '#ffedd5', '#431407');
    } else if (isPool) {
      this.addArchSign(11, '🏊 수영장 스플래시 출발!', '#0891b2', '#ecfeff', '#0e7490');
      this.addArchSign(43, '🛟 튜브 범퍼 슬라럼', '#f472b6', '#fdf2f8', '#be185d');
      this.addArchSign(66, '💧 물벼락 낙하 존!', '#0284c7', '#e0f2fe', '#075985');
      this.addArchSign(84, '🌊 물살 컨베이어', '#22d3ee', '#f0fdff', '#0e7490');
      this.addArchSign(101, '🏄 빅웨이브 파도 풀!', '#a855f7', '#f5f3ff', '#6b21a8');
    } else if (isFg) {
      this.addArchSign(11, '🎪 폴가이즈 스타트!', '#ec4899', '#fdf2f8', '#be185d');
      this.addArchSign(43, '🫧 에어 쿠션 범퍼 존', '#0ea5b7', '#ecfeff', '#0f766e');
      this.addArchSign(72, '🌀 대형 회전 빔 점프!', '#d97706', '#fef9c3', '#92400e');
      this.addArchSign(88, '🥊 풍선 펀치월 & 피스톤', '#7c3aed', '#f5f3ff', '#5b21b6');
      this.addArchSign(101, '🟢 슬라임 램프 → 👑 왕관 결승', '#16a34a', '#ecfdf5', '#15803d');
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
    textHex: string,
    showTaebiIcon: boolean = false
  ): void {
    const cx = this.getTrackCenterX(z);
    const y = this.getTrackHeightAtZ(z);
    const yaw = this.getTrackYawAtZ(z);
    const halfW = this.getTrackHalfWidthAtZ(z);

    const group = new THREE.Group();
    group.position.set(cx, y, z);
    group.rotation.y = yaw;

    const pillarColor =
      this.mapTheme === 'TAEKWONDO'
        ? 0xb91c1c
        : this.mapTheme === 'DINOSAUR'
        ? 0x78350f
        : this.mapTheme === 'POOL'
        ? 0x0891b2
        : 0x16a34a;
    const pillarMat = new THREE.MeshStandardMaterial({ color: pillarColor, roughness: 0.4 });
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 8.8, 12), pillarMat);
      pillar.position.set(side * (halfW + 0.1), 4.4, 0);
      group.add(pillar);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    const drawBannerBase = () => {
      ctx.clearRect(0, 0, 1024, 96);
      ctx.fillStyle = bgHex;
      ctx.beginPath();
      ctx.roundRect(10, 6, 1004, 84, 18);
      ctx.fill();
      ctx.strokeStyle = borderHex;
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.fillStyle = textHex;
      ctx.font = '800 44px "Plus Jakarta Sans", "Pretendard", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, showTaebiIcon ? 544 : 512, 49);
    };
    drawBannerBase();

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (showTaebiIcon) {
      const iconImg = new Image();
      iconImg.onload = () => {
        drawBannerBase();
        const cxIcon = 120;
        const cyIcon = 48;
        const rxIcon = 30;
        const ryIcon = 35;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cxIcon, cyIcon, rxIcon, ryIcon, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cxIcon - rxIcon, cyIcon - ryIcon, rxIcon * 2, ryIcon * 2);
        ctx.drawImage(iconImg, cxIcon - rxIcon, cyIcon - ryIcon, rxIcon * 2, ryIcon * 2);
        ctx.restore();
        ctx.strokeStyle = borderHex;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(cxIcon, cyIcon, rxIcon, ryIcon, 0, 0, Math.PI * 2);
        ctx.stroke();
        tex.needsUpdate = true;
      };
      iconImg.src = './taebi-icon.jpg';
    }

    const bannerMat = new THREE.MeshBasicMaterial({
      map: tex,
      toneMapped: false,
      transparent: true,
      opacity: 1,
    });
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2 + 0.7, 1.45, 0.35),
      bannerMat
    );
    banner.position.set(0, 8.4, 0);
    group.add(banner);
    this.overheadBanners.push({ mat: bannerMat, z });
    this.courseGroup.add(group);
  }

  private buildStartGate(): void {
    const z = 8.5;
    const cx = this.getTrackCenterX(z);
    const y = this.getTrackHeightAtZ(z);
    const isTkd = this.mapTheme === 'TAEKWONDO';
    const isDino = this.mapTheme === 'DINOSAUR';
    const isPool = this.mapTheme === 'POOL';
    const isFg = this.mapTheme === 'FALLGUYS';
    const gateTex = this.createCheckeredTexture(
      isTkd ? '#dc2626' : isDino ? '#16a34a' : isFg ? '#ff6fb5' : isPool ? '#22d3ee' : '#fbbf24',
      isTkd ? '#2563eb' : isDino ? '#facc15' : isFg ? '#ffffff' : isPool ? '#ffffff' : '#ffffff',
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

  // =====================================================================
  // MAP 1: PLAYGROUND COURSE (교실 -> 복도 관문 -> 강풍/컨베이어 -> 운동장)
  // =====================================================================
  private buildPlaygroundCourse(): void {
    this.buildPlaygroundZone1DesksAndSweepers();
    this.buildPlaygroundZone2MysteryAndBumpers();
    this.buildConveyorBeltsAndFans(true);
    this.buildPlaygroundZone4Pendulums();
    this.buildPlaygroundMustangBossObstacles();
    this.buildFinishArch(false);
  }

  private buildPlaygroundMustangBossObstacles(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    const specs = isLight
      ? [
          { z: 41.5, ampX: 5.0, freq: 1.85, phase: 0, scale: 1.45 },
          { z: 99.0, ampX: 4.2, freq: 2.05, phase: Math.PI, scale: 1.5 },
        ]
      : [
          { z: 41.5, ampX: 5.2, freq: 2.05, phase: 0, scale: 1.45 },
          { z: 71.2, ampX: 5.2, freq: 2.3, phase: 1.6, scale: 1.5 },
          { z: 99.0, ampX: 4.4, freq: 2.5, phase: 3.1, scale: 1.55 },
        ];

    for (const sp of specs) {
      this.createMustangBossObstacle(sp.z, sp.ampX, sp.freq, sp.phase, sp.scale);
    }
  }

  private createMustangBossObstacle(
    z: number,
    ampX: number,
    freq: number,
    phase: number,
    scale: number
  ): void {
    const cx = this.getTrackCenterX(z);
    const halfW = 0.85 * scale;
    const halfH = 1.45 * scale;
    const halfD = 0.65 * scale;
    const y = this.getTrackHeightAtZ(z) + 0.05;
    const initX = cx + Math.sin(phase) * ampX;
    const trackYaw = this.getTrackYawAtZ(z);

    const built = this.createPlaygroundBossCharacter();
    const group = built.root;
    group.scale.setScalar(scale);
    group.position.set(initX, y, z);
    group.rotation.y = Math.PI + trackYaw;
    group.userData.isMustangBoss = true;
    group.userData.trackYaw = trackYaw;
    group.userData.bodyPivot = built.bodyPivot;
    group.userData.leftArmPivot = built.leftArmPivot;
    group.userData.rightArmPivot = built.rightArmPivot;
    group.userData.leftLegPivot = built.leftLegPivot;
    group.userData.rightLegPivot = built.rightLegPivot;
    this.courseGroup.add(group);

    const body = this.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(initX, y + halfH, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
        .setRestitution(1.05)
        .setCollisionGroups(this.envCollisionGroup()),
      body
    );

    this.slidingShields.push({
      body,
      mesh: group,
      baseZ: z,
      baseY: y,
      halfW,
      halfH,
      halfD,
      ampX,
      freq,
      phase,
      lastX: initX,
      hitCooldowns: new Map(),
    });
  }

  private buildPlaygroundZone1DesksAndSweepers(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    const obstaclePositions = isLight
      ? [
          { z: 18, offset: -4.2 },
          { z: 26, offset: 3.8 },
          { z: 35, offset: -2.6 },
        ]
      : [
          { z: 16, offset: -5.2 },
          { z: 18, offset: 4.5 },
          { z: 22, offset: -1.5 },
          { z: 24, offset: 5.5 },
          { z: 29, offset: -5.8 },
          { z: 31, offset: 1.2 },
          { z: 36, offset: -3.2 },
          { z: 37, offset: 4.8 },
        ];

    const deskTopMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4 });
    const envGroup = this.envCollisionGroup();

    for (const dp of obstaclePositions) {
      const cx = this.getTrackCenterX(dp.z);
      const yaw = this.getTrackYawAtZ(dp.z);
      const wx = cx + dp.offset;
      const wz = dp.z;
      const wy = this.getTrackHeightAtZ(wz);

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

    if (isLight) {
      this.createSweeper(28, 0, 5.2, 2.7, 2, 0x2563eb);
    } else {
      this.createSweeper(20, -2.5, 4.6, 3.3, 3, 0x2563eb);
      this.createSweeper(28, 2.6, 4.8, -3.6, 2, 0xf43f5e);
      this.createSweeper(35, 0, 5.8, 3.8, 3, 0x0ea5e9);
    }
  }

  private buildPlaygroundZone2MysteryAndBumpers(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    this.buildBreakingDoorRow(48, 5, 0, 'MYSTERY');

    const popupSpecs = isLight
      ? [
          { z: 56, offset: -3.4, phase: 0, freq: 2.8 },
          { z: 65, offset: 3.4, phase: 1.8, freq: 2.8 },
        ]
      : [
          { z: 54, offset: -4.0, phase: 0, freq: 3.4 },
          { z: 54, offset: 4.0, phase: 2.1, freq: 3.4 },
          { z: 60, offset: 0, phase: 1.0, freq: 3.9 },
          { z: 66, offset: -3.2, phase: 0.5, freq: 4.2 },
          { z: 66, offset: 3.2, phase: 2.7, freq: 4.2 },
        ];
    this.addPopupBumpers(popupSpecs, 0x10b981);

    const pinballSpecs = isLight
      ? [
          { z: 60, offset: -4.0 },
          { z: 60, offset: 4.0 },
        ]
      : [
          { z: 57, offset: -4.8 },
          { z: 57, offset: 4.8 },
          { z: 63, offset: -2.2 },
          { z: 63, offset: 2.2 },
          { z: 69, offset: 0 },
        ];
    this.addPinballBumpers(pinballSpecs, 0xec4899);
  }

  private buildPlaygroundZone4Pendulums(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    if (isLight) {
      this.addSwingingPendulums(
        [{ z: 114, freq: 2.0, phase: 0, maxAngle: 0.82 }],
        false
      );
      return;
    }

    this.addSwingingPendulums(
      [
        { z: 108, freq: 2.35, phase: 0, maxAngle: 0.92 },
        { z: 115, freq: 2.6, phase: Math.PI, maxAngle: 0.92 },
        { z: 121, freq: 2.8, phase: Math.PI * 0.5, maxAngle: 0.92 },
      ],
      false
    );
    this.createSweeper(126, 0, 5.2, 4.0, 2, 0x3b82f6);
  }

  // =====================================================================
  // MAP 5: FALL GUYS COURSE
  // (에어 쿠션 범퍼 → 대형 회전 빔 → 풍선 펀치월·피스톤 → 슬라임 램프 & 왕관 결승)
  // =====================================================================
  private buildFallguysCourse(): void {
    this.buildFallguysAirCushionZone();
    this.buildFallguysSweeperZone();
    this.buildFallguysPunchZone();
    this.buildFallguysSlimeRamp();
    this.buildFallguysCrownArch();
    this.buildFinishArch(false);
  }

  /** 폴가이즈 맵 장식: 솜사탕 구름 · 에어벌룬 · 파스텔 깃발 */
  private buildFallguysScenery(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      emissive: 0xffffff,
      emissiveIntensity: 0.06,
    });

    // 1. 트랙 양옆 둥실둥실 솜사탕 구름
    for (let z = 6; z <= 146; z += 15) {
      const cx = this.getTrackCenterX(z);
      const baseY = this.getTrackHeightAtZ(z) + 11.5 + Math.random() * 4.5;
      for (const side of [-1, 1]) {
        if (Math.random() < 0.3) continue;
        const cloud = new THREE.Group();
        cloud.position.set(
          cx + side * (18 + Math.random() * 9),
          baseY,
          z + (Math.random() - 0.5) * 7
        );
        for (let p = 0; p < 5; p++) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(1.5 + Math.random() * 1.15, 12, 10),
            cloudMat
          );
          puff.position.set((p - 2) * 1.45, Math.random() * 0.75, (Math.random() - 0.5) * 1.4);
          cloud.add(puff);
        }
        this.courseGroup.add(cloud);
      }
    }

    // 2. 비비드 파스텔 에어벌룬
    const balloonPalette = [0xff6fb5, 0x6fe7c8, 0xffe066, 0x7cc9ff, 0xc9a3ff];
    const basketMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    for (let z = 22; z <= 134; z += 26) {
      const cx = this.getTrackCenterX(z);
      const baseY = this.getTrackHeightAtZ(z) + 8.5;
      for (const side of [-1, 1]) {
        const balloonColor = balloonPalette[Math.floor(Math.random() * balloonPalette.length)];
        const balloon = new THREE.Group();
        balloon.position.set(cx + side * (16 + Math.random() * 6), baseY, z + side * 4);

        const envelope = new THREE.Mesh(
          new THREE.SphereGeometry(2.3, 18, 16),
          new THREE.MeshStandardMaterial({ color: balloonColor, roughness: 0.35 })
        );
        envelope.scale.set(1, 1.18, 1);
        envelope.castShadow = true;
        balloon.add(envelope);

        for (const bandY of [-0.5, 0.55]) {
          const band = new THREE.Mesh(
            new THREE.TorusGeometry(2.15, 0.12, 8, 22),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
          );
          band.rotation.x = Math.PI / 2;
          band.position.y = bandY;
          band.scale.setScalar(bandY < 0 ? 0.86 : 0.98);
          balloon.add(band);
        }

        for (const rx of [-0.5, 0.5]) {
          const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), ropeMat);
          rope.position.set(rx * 1.2, -3.1, 0);
          rope.rotation.z = rx * 0.28;
          balloon.add(rope);
        }

        const basket = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), basketMat);
        basket.position.y = -4.1;
        basket.castShadow = true;
        balloon.add(basket);

        this.courseGroup.add(balloon);
      }
    }

    // 3. 결승까지 이어지는 삼각 깃발 줄
    const flagPalette = [0xff6fb5, 0x6fe7c8, 0xffe066, 0x7cc9ff, 0xc9a3ff];
    for (let z = 16; z <= 128; z += 16) {
      const cx = this.getTrackCenterX(z);
      for (const side of [-1, 1]) {
        const line = new THREE.Group();
        line.position.set(cx + side * 9.6, this.getTrackHeightAtZ(z) + 4.6, z);
        for (let f = 0; f < 5; f++) {
          const flag = new THREE.Mesh(
            new THREE.ConeGeometry(0.36, 0.95, 4),
            new THREE.MeshStandardMaterial({
              color: flagPalette[(f + (side > 0 ? 2 : 0)) % flagPalette.length],
              roughness: 0.45,
            })
          );
          flag.rotation.x = Math.PI;
          flag.position.set(0, -0.5, f * 1.5 - 3);
          line.add(flag);
        }
        this.courseGroup.add(line);
      }
    }
  }

  private buildFallguysAirCushionZone(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    const specs = isLight
      ? [
          { z: 19, offset: -3.9 },
          { z: 27, offset: 3.7 },
          { z: 35, offset: 0 },
        ]
      : [
          { z: 17, offset: -4.6 },
          { z: 17, offset: 4.4 },
          { z: 23, offset: 0 },
          { z: 28, offset: -4.9 },
          { z: 28, offset: 4.9 },
          { z: 34, offset: -2.4 },
          { z: 34, offset: 2.4 },
          { z: 39, offset: 0 },
        ];
    const colors = [0xff8cc0, 0x6fe7c8, 0xffe066, 0x7cc9ff, 0xc9a3ff];
    specs.forEach((spec, idx) => {
      this.createFallguysAirCushion(
        spec.z,
        spec.offset,
        isLight ? 2.0 : 2.15,
        colors[idx % colors.length]
      );
    });
  }

  private createFallguysAirCushion(
    z: number,
    offsetX: number,
    radius: number,
    colorHex: number
  ): void {
    const wx = this.getTrackCenterX(z) + offsetX;
    const wy = this.getTrackHeightAtZ(z);

    const group = new THREE.Group();
    group.position.set(wx, wy + 0.15, z);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.92, radius * 1.02, 0.55, 22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
    );
    base.position.y = 0.1;
    group.add(base);

    const cushion = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 22, 16),
      new THREE.MeshPhysicalMaterial({
        color: colorHex,
        roughness: 0.26,
        metalness: 0.0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
      })
    );
    cushion.scale.set(1, 0.66, 1);
    cushion.position.y = 0.52;
    cushion.castShadow = true;
    group.add(cushion);

    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.94, 0.13, 8, 26),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.46;
    group.add(band);

    const valve = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    valve.position.set(0, 0.52 + radius * 0.66 - 0.05, 0);
    group.add(valve);

    this.courseGroup.add(group);

    const body = this.createBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(wx, wy + 0.6, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.72, radius)
        .setRestitution(1.45)
        .setFriction(0.06)
        .setCollisionGroups(this.envCollisionGroup()),
      body
    );

    this.fallguysCushions.push({
      mesh: group,
      body,
      pos: new THREE.Vector3(wx, wy + 0.6, z),
      radius,
      squash: 0,
      hitCooldowns: new Map(),
    });
  }

  private buildFallguysSweeperZone(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    if (isLight) {
      this.createSweeper(53, 0, 7.2, 2.4, 2, 0xff5fa2);
      return;
    }
    this.createSweeper(47, 0, 7.6, 2.6, 2, 0xff5fa2);
    this.createSweeper(57, 0, 8.2, -2.2, 2, 0x5ee7c7);
    this.createSweeper(66, 0, 7.4, 3.0, 3, 0xffe45c);
  }

  private buildFallguysPunchZone(): void {
    const isLight = this.obstacleDensity === 'LIGHT';

    const wallSpecs = isLight
      ? [{ z: 84, ampX: 3.2, freq: 1.15, phase: 0 }]
      : [
          { z: 78, ampX: 3.4, freq: 1.15, phase: 0 },
          { z: 88, ampX: 3.8, freq: 1.35, phase: Math.PI },
          { z: 98, ampX: 3.2, freq: 1.5, phase: 1.2 },
        ];
    const wallColors = [0xff8cc0, 0x6fe7c8, 0xffe066];
    const halfWallW = 2.4;
    wallSpecs.forEach((spec, idx) => {
      this.createFallguysPunchWall(
        spec.z,
        spec.ampX,
        spec.freq,
        spec.phase,
        wallColors[idx % wallColors.length],
        halfWallW
      );
    });

    const pistonSpecs = isLight
      ? [
          { z: 74, side: -1, phase: 0 },
          { z: 95, side: 1, phase: Math.PI },
        ]
      : [
          { z: 74, side: -1, phase: 0 },
          { z: 74, side: 1, phase: Math.PI },
          { z: 94, side: -1, phase: 1.4 },
          { z: 94, side: 1, phase: 4.2 },
        ];
    for (const spec of pistonSpecs) {
      this.createFallguysPiston(spec.z, spec.side, spec.phase);
    }
  }

  private createFallguysPunchWall(
    z: number,
    ampX: number,
    freq: number,
    phase: number,
    colorHex: number,
    halfWallWidth: number = 2.4
  ): void {
    const cx = this.getTrackCenterX(z);
    const halfW = halfWallWidth;
    const halfH = 1.15;
    const halfD = 0.55;
    const y = this.getTrackHeightAtZ(z) + halfH + 0.06;
    const initX = cx + Math.sin(phase) * ampX;

    const group = new THREE.Group();
    group.position.set(initX, y, z);

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2, halfH * 2, halfD * 2),
      new THREE.MeshPhysicalMaterial({
        color: colorHex,
        roughness: 0.3,
        clearcoat: 0.35,
        clearcoatRoughness: 0.25,
      })
    );
    pad.castShadow = true;
    group.add(pad);

    const crossBand = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2 + 0.1, 0.34, halfD * 2 + 0.12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    group.add(crossBand);

    const ballMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });
    for (const bx of [-halfW * 0.6, 0, halfW * 0.6]) {
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), ballMat);
      balloon.position.set(bx, 0.12, halfD + 0.3);
      balloon.castShadow = true;
      group.add(balloon);
    }

    this.courseGroup.add(group);

    const body = this.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(initX, y, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
        .setRestitution(1.15)
        .setFriction(0.05)
        .setCollisionGroups(this.envCollisionGroup()),
      body
    );

    this.fallguysPunchWalls.push({
      body,
      mesh: group,
      baseZ: z,
      baseY: y,
      halfW,
      halfH,
      halfD,
      ampX,
      freq,
      phase,
      lastX: initX,
      hitCooldowns: new Map(),
    });
  }

  private createFallguysPiston(z: number, side: number, phase: number): void {
    const cx = this.getTrackCenterX(z);
    const halfW = 1.0;
    const halfH = 1.0;
    const halfD = 0.55;
    const baseY = this.getTrackHeightAtZ(z) + halfH + 0.05;
    const restX = cx + side * (9.0 - halfW);

    const group = new THREE.Group();
    group.position.set(restX, baseY, z);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 3.4, 14),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.35 })
    );
    shaft.rotation.z = Math.PI / 2;
    shaft.position.set(-side * 1.7, 0, 0);
    group.add(shaft);

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(halfH, halfH, halfD * 2, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0xff6fb5,
        roughness: 0.28,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
      })
    );
    pad.rotation.z = Math.PI / 2;
    pad.castShadow = true;
    group.add(pad);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(halfH * 0.72, 0.1, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-side * (halfD - 0.02), 0, 0);
    group.add(ring);

    this.courseGroup.add(group);

    const body = this.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(restX, baseY, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfD, halfH)
        .setRotation({ x: 0, y: 0, z: 0.7071, w: 0.7071 })
        .setRestitution(1.1)
        .setCollisionGroups(this.envCollisionGroup()),
      body
    );

    this.fallguysPistons.push({
      body,
      mesh: group,
      z,
      side,
      baseY,
      restX,
      stroke: 2.0,
      phase,
      freq: 1.55,
      halfW,
      halfH,
      halfD,
      hitCooldowns: new Map(),
    });
  }

  /** 슬라임 가속 경사: 밟으면 결승까지 미끄러지듯 가속되는 초록 젤리 램프 */
  private buildFallguysSlimeRamp(): void {
    const zMin = 104;
    const zMax = 119;
    const tex = this.createSlimeTexture();
    tex.repeat.set(1, (zMax - zMin) * 0.5);

    const geo = this.createCurvedFloorStripGeometry(zMin, zMax, -8.6, 8.6, 0.11, 12);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshPhysicalMaterial({
        map: tex,
        color: 0xb6ff9e,
        roughness: 0.12,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    this.courseGroup.add(mesh);

    this.conveyors.push({
      zMin,
      zMax,
      sideOffsetMin: -8.6,
      sideOffsetMax: 8.6,
      speedZ: 15.5,
      texture: tex,
    });

    // 램프 양옆 슬라임 방울
    const blobMat = new THREE.MeshPhysicalMaterial({
      color: 0x8ef57f,
      roughness: 0.15,
      transparent: true,
      opacity: 0.9,
      clearcoat: 1.0,
    });
    for (let z = zMin + 2; z <= zMax; z += 3.5) {
      const cx = this.getTrackCenterX(z);
      for (const side of [-1, 1]) {
        const blob = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), blobMat);
        blob.position.set(cx + side * 7.4, this.getTrackHeightAtZ(z) + 0.3, z);
        blob.scale.set(1.5, 0.55, 1.2);
        this.courseGroup.add(blob);
      }
    }
  }

  private createSlimeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#7ff06a';
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = 'rgba(214, 255, 200, 0.75)';
    for (const [bx, by, br] of [
      [24, 26, 9],
      [78, 14, 6],
      [104, 54, 11],
      [46, 74, 7],
      [86, 98, 9],
      [16, 108, 6],
    ]) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(46, 160, 40, 0.35)';
    ctx.lineWidth = 6;
    for (let y = 18; y < 128; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(36, y - 12, 92, y + 12, 128, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** 결승 아치 위에 얹는 거대 황금 왕관 */
  private buildFallguysCrownArch(): void {
    const z = this.finishZ;
    const cx = this.getTrackCenterX(z);
    const floorY = this.getTrackHeightAtZ(z);
    const yaw = this.getTrackYawAtZ(z);

    const crown = new THREE.Group();
    crown.position.set(cx, floorY + 10.15, z);
    crown.rotation.y = yaw;

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffc93c,
      roughness: 0.22,
      metalness: 0.55,
      emissive: 0xffb300,
      emissiveIntensity: 0.14,
    });

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(3.0, 3.0, 1.0, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xffc93c,
        roughness: 0.22,
        metalness: 0.55,
        emissive: 0xffb300,
        emissiveIntensity: 0.14,
        side: THREE.DoubleSide,
      })
    );
    crown.add(band);

    const jewelColors = [0xff4d9e, 0x5ee7ff, 0x9dff7a];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.55, 12), goldMat);
      spike.position.set(Math.cos(a) * 2.86, 1.18, Math.sin(a) * 2.86);
      spike.castShadow = true;
      crown.add(spike);

      const jewel = new THREE.Mesh(
        new THREE.SphereGeometry(0.23, 10, 8),
        new THREE.MeshStandardMaterial({
          color: jewelColors[i % jewelColors.length],
          roughness: 0.15,
          emissive: jewelColors[i % jewelColors.length],
          emissiveIntensity: 0.35,
        })
      );
      jewel.position.set(Math.cos(a) * 2.86, 1.99, Math.sin(a) * 2.86);
      crown.add(jewel);
    }

    this.courseGroup.add(crown);
  }

  private updateFallguysGimmicks(
    dt: number,
    racers: RagdollRacer[],
    particles: ParticleSystem,
    sound: SoundManager,
    isRacing: boolean
  ): void {
    // 1) 에어 쿠션 범퍼: 닿으면 통통 튕겨나간다
    for (const cu of this.fallguysCushions) {
      cu.squash = Math.max(0, cu.squash - dt * 3.4);
      const pulse = 1 - cu.squash * 0.16 + Math.sin(this.elapsedTime * 2.1 + cu.pos.z) * 0.015;
      cu.mesh.scale.set(1 + cu.squash * 0.12, pulse, 1 + cu.squash * 0.12);

      if (!isRacing) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = cu.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.45) continue;

        const rPos = r.getPosition();
        const dx = rPos.x - cu.pos.x;
        const dz = rPos.z - cu.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < cu.radius + 0.8 && rPos.y - this.getTrackHeightAtZ(rPos.z) < 3.2) {
          cu.hitCooldowns.set(r.id, this.elapsedTime);
          cu.squash = 1;
          const nx = dist > 0.001 ? dx / dist : Math.random() - 0.5;
          const nz = dist > 0.001 ? dz / dist : 1;
          r.torsoBody.applyImpulse(
            { x: nx * 26 + (Math.random() - 0.5) * 6, y: 17, z: nz * 20 + 6 },
            true
          );
          particles.spawnHitBurst(rPos, '#ffd1e8', 7);
          sound.playBumperBounce();
        }
      }
    }

    // 2) 좌우로 흔들리는 풍선 펀치 월
    for (const wall of this.fallguysPunchWalls) {
      const cx = this.getTrackCenterX(wall.baseZ);
      const curX = cx + Math.sin(this.elapsedTime * wall.freq + wall.phase) * wall.ampX;
      const vx = curX - wall.lastX;
      wall.lastX = curX;
      wall.mesh.position.set(curX, wall.baseY, wall.baseZ);
      wall.body.setNextKinematicTranslation({ x: curX, y: wall.baseY, z: wall.baseZ });

      if (!isRacing) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = wall.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.55) continue;

        const rPos = r.getPosition();
        if (
          Math.abs(rPos.x - curX) < wall.halfW + 0.6 &&
          Math.abs(rPos.z - wall.baseZ) < wall.halfD + 0.9 &&
          Math.abs(rPos.y - wall.baseY) < wall.halfH + 1.0
        ) {
          wall.hitCooldowns.set(r.id, this.elapsedTime);
          const pushDirX = Math.abs(vx) > 0.0004 ? Math.sign(vx) : rPos.x >= curX ? 1 : -1;
          r.triggerRagdoll(
            {
              x: pushDirX * 32 + (Math.random() - 0.5) * 8,
              y: 19 + Math.random() * 8,
              z: -6 + Math.random() * 10,
            },
            undefined,
            1.05
          );
          particles.spawnHitBurst(rPos, '#ff8cc0', 10);
          sound.playRagdollHit(1.05);
        }
      }
    }

    // 3) 양옆에서 쑥 들어오는 피스톤 펀치
    for (const piston of this.fallguysPistons) {
      const extend = Math.max(0, Math.sin(this.elapsedTime * piston.freq + piston.phase));
      const curX = piston.restX - piston.side * piston.stroke * extend;
      piston.mesh.position.set(curX, piston.baseY, piston.z);
      piston.body.setNextKinematicTranslation({ x: curX, y: piston.baseY, z: piston.z });

      if (!isRacing || extend < 0.28) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = piston.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.6) continue;

        const rPos = r.getPosition();
        if (
          Math.abs(rPos.x - curX) < piston.halfD + 0.75 &&
          Math.abs(rPos.z - piston.z) < piston.halfW + 0.8 &&
          Math.abs(rPos.y - piston.baseY) < piston.halfH + 1.0
        ) {
          piston.hitCooldowns.set(r.id, this.elapsedTime);
          r.triggerRagdoll(
            {
              x: -piston.side * 34 + (Math.random() - 0.5) * 8,
              y: 18 + Math.random() * 7,
              z: 4,
            },
            undefined,
            1.0
          );
          particles.spawnHitBurst(rPos, '#ffd93d', 9);
          sound.playRagdollHit(1.0);
        }
      }
    }
  }

  // =====================================================================
  // MAP 4: POOL COURSE (워터슬라이드 → 튜브 범퍼 → 물벼락 낙하 존 → 물살 컨베이어 → 빅웨이브)
  // =====================================================================
  private buildPoolCourse(): void {
    this.buildPoolSlideAndTubes();
    this.buildPoolTubeSlalom();
    this.buildPoolDropZone(73, 7.0);
    this.buildPoolConveyorBelts();
    this.buildPoolBuoySlalom();
    this.buildPoolBigWaveZone();
    this.buildFinishArch(false);
  }

  /** 수영장 부품: 야자수·파라솔·튜브 부표·사다리로 물놀이 분위기를 만든다 */
  private buildPoolScenery(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
    const frondMats = [
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.6 }),
    ];
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.5 });

    // 1. 야자수 가로수
    for (let tz = 8; tz <= 142; tz += 11) {
      const cx = this.getTrackCenterX(tz);
      const ty = this.getTrackHeightAtZ(tz) - 1.15;
      for (const side of [-1, 1]) {
        const palm = new THREE.Group();
        palm.position.set(
          cx + side * (12.5 + Math.random() * 4.5),
          ty,
          tz + (Math.random() - 0.5) * 3.5
        );
        const lean = (Math.random() - 0.5) * 0.16;
        const height = 4.6 + Math.random() * 2.2;

        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.52, height, 8),
          trunkMat
        );
        trunk.position.y = height * 0.5;
        trunk.rotation.z = lean;
        trunk.castShadow = true;
        palm.add(trunk);

        const crown = new THREE.Group();
        crown.position.set(-Math.sin(lean) * height, height, 0);
        const frondCount = 7;
        for (let f = 0; f < frondCount; f++) {
          const a = (f / frondCount) * Math.PI * 2 + Math.random() * 0.25;
          const frond = new THREE.Mesh(
            new THREE.BoxGeometry(2.4 + Math.random() * 0.9, 0.1, 0.8),
            frondMats[f % frondMats.length]
          );
          frond.position.set(Math.cos(a) * 1.25, 0.05 - Math.random() * 0.1, Math.sin(a) * 1.25);
          frond.rotation.y = -a;
          frond.rotation.z = -0.3;
          frond.castShadow = true;
          crown.add(frond);
        }
        for (let c = 0; c < 3; c++) {
          const coconut = new THREE.Mesh(
            new THREE.SphereGeometry(0.26, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
          );
          const a = (c / 3) * Math.PI * 2;
          coconut.position.set(Math.cos(a) * 0.42, -0.35, Math.sin(a) * 0.42);
          crown.add(coconut);
        }
        palm.add(crown);
        this.courseGroup.add(palm);
      }
    }

    // 2. 파라솔 & 선베드 (트랙 바깥 물가)
    const parasolColors = [0xf472b6, 0x22d3ee, 0xfde047, 0xa855f7];
    for (let tz = 16; tz <= 136; tz += 22) {
      const cx = this.getTrackCenterX(tz);
      const ty = this.getTrackHeightAtZ(tz) - 2.3;
      for (const side of [-1, 1]) {
        const stand = new THREE.Group();
        stand.position.set(cx + side * (11.2 + Math.random() * 2.5), ty, tz + side * 3);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), whiteMat);
        pole.position.y = 1.7;
        stand.add(pole);

        const canopy = new THREE.Mesh(
          new THREE.ConeGeometry(2.2, 0.95, 8),
          new THREE.MeshStandardMaterial({
            color: parasolColors[Math.floor(Math.random() * parasolColors.length)],
            roughness: 0.45,
          })
        );
        canopy.position.y = 3.45;
        canopy.castShadow = true;
        stand.add(canopy);

        const bedMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.7 });
        const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 3.1), bedMat);
        bed.position.set(side * 1.1, 0.32, 0);
        bed.rotation.y = side * 0.2;
        bed.castShadow = true;
        stand.add(bed);

        const pillow = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.2, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6 })
        );
        pillow.position.set(side * 1.1, 0.47, -1.2);
        stand.add(pillow);
        this.courseGroup.add(stand);
      }
    }

    // 3. 물 위에 떠 있는 컬러 튜브 부표
    const floatColors = [0xf472b6, 0xfde047, 0x22d3ee, 0xa855f7, 0xfb923c, 0x4ade80];
    for (let tz = 12; tz <= 140; tz += 6.5) {
      const cx = this.getTrackCenterX(tz);
      const wy = this.getTrackHeightAtZ(tz) - 2.05;
      for (const side of [-1, 1]) {
        if (Math.random() < 0.25) continue;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.85 + Math.random() * 0.35, 0.28, 10, 20),
          new THREE.MeshStandardMaterial({
            color: floatColors[Math.floor(Math.random() * floatColors.length)],
            roughness: 0.35,
          })
        );
        ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
        ring.rotation.z = Math.random() * Math.PI;
        ring.position.set(
          cx + side * (10.6 + Math.random() * 7.5),
          wy + (Math.random() - 0.5) * 0.15,
          tz + (Math.random() - 0.5) * 3.2
        );
        this.courseGroup.add(ring);
      }
    }

    // 4. 수영장 사다리 (출발 지점 옆)
    for (const side of [-1, 1]) {
      const ladderZ = 12.5;
      const lcx = this.getTrackCenterX(ladderZ);
      const ly = this.getTrackHeightAtZ(ladderZ) - 2.4;
      const ladder = new THREE.Group();
      ladder.position.set(lcx + side * 10.4, ly, ladderZ);
      for (const rail of [-0.55, 0.55]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 8), metalMat);
        r.position.set(rail, 1.8, 0);
        ladder.add(r);
      }
      for (let lr = 0; lr < 4; lr++) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), metalMat);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, 0.5 + lr * 0.85, 0);
        ladder.add(rung);
      }
      this.courseGroup.add(ladder);
    }

    // 5. 안전요원 의자 (물벼락 존 옆)
    const chairZ = 66;
    const ccx = this.getTrackCenterX(chairZ);
    const chY = this.getTrackHeightAtZ(chairZ) - 2.35;
    const chair = new THREE.Group();
    chair.position.set(ccx + 10.6, chY, chairZ);
    const chairMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
    for (const lx of [-0.6, 0.6]) {
      for (const lz of [-0.6, 0.6]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.0, 0.16), chairMat);
        leg.position.set(lx * 1.2, 1.5, lz * 1.2);
        chair.add(leg);
      }
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.7), whiteMat);
    seat.position.y = 3.05;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.2, 0.18), chairMat);
    back.position.set(0, 3.7, -0.8);
    chair.add(back);
    const umbrella = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.5 })
    );
    umbrella.position.y = 5.4;
    chair.add(umbrella);
    this.courseGroup.add(chair);
  }

  /** 도넛 튜브 범퍼 메쉬 (알록달록 물놀이 튜브) */
  private createTubeBumperMesh(colorHex: number): THREE.Group {
    const group = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.46, 12, 26),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 })
    );
    torus.rotation.x = Math.PI / 2;
    torus.castShadow = true;
    group.add(torus);

    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    for (let s = 0; s < 4; s++) {
      const a = (s * Math.PI) / 2 + Math.PI / 4;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.22), stripeMat);
      stripe.position.set(Math.cos(a) * 1.12, 0.16, Math.sin(a) * 1.12);
      group.add(stripe);
    }
    return group;
  }

  private addTubeBumpers(specs: { z: number; offset: number; color: number }[]): void {
    for (const spec of specs) {
      const cx = this.getTrackCenterX(spec.z);
      const wx = cx + spec.offset;
      const wy = this.getTrackHeightAtZ(spec.z) + 0.55;
      const pos = new THREE.Vector3(wx, wy, spec.z);
      const radius = 1.45;

      const group = this.createTubeBumperMesh(spec.color);
      group.position.copy(pos);
      this.courseGroup.add(group);

      const body = this.createBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z)
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.5, radius)
          .setRestitution(1.15)
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

  private buildPoolSlideAndTubes(): void {
    const isLight = this.obstacleDensity === 'LIGHT';

    // 1. 젖은 워터슬라이드 물길 (트랙 위 얇은 물막 + 측면 슬라이드 레일)
    const wetGeo = this.createCurvedFloorStripGeometry(15, 34, -8.5, 8.5, 0.1, 10);
    const wetMesh = new THREE.Mesh(
      wetGeo,
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.42,
        roughness: 0.1,
        metalness: 0.35,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    this.courseGroup.add(wetMesh);

    for (const side of [-1, 1]) {
      for (let z = 16; z <= 33; z += 8.5) {
        const cx = this.getTrackCenterX(z);
        const yaw = this.getTrackYawAtZ(z);
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 1.1, 7.6),
          new THREE.MeshStandardMaterial({ color: side === -1 ? 0x22d3ee : 0xf472b6, roughness: 0.3 })
        );
        rail.position.set(cx + side * 8.1, this.getTrackHeightAtZ(z) + 0.55, z);
        rail.rotation.y = yaw;
        rail.castShadow = true;
        this.courseGroup.add(rail);
      }
    }

    // 2. 워터슬라이드 타워 & 슬라이드 슈트 (트랙 왼쪽 조형물)
    const slideZ = 25;
    const scx = this.getTrackCenterX(slideZ) - 15.5;
    const sy = this.getTrackHeightAtZ(slideZ) - 2.2;
    const tower = new THREE.Group();
    tower.position.set(scx, sy, slideZ);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.45 });
    const towerBody = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.0, 6.4, 10), towerMat);
    towerBody.position.y = 3.2;
    towerBody.castShadow = true;
    tower.add(towerBody);
    const towerTop = new THREE.Mesh(
      new THREE.ConeGeometry(3.1, 2.0, 10),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 })
    );
    towerTop.position.y = 7.2;
    tower.add(towerTop);

    const chuteMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.35 });
    for (let i = 0; i < 5; i++) {
      const chute = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.42, 10, 18, Math.PI), chuteMat);
      chute.position.set(i * 1.6, 5.2 - i * 0.95, 0);
      chute.rotation.set(0, Math.PI / 2, Math.PI * 0.55);
      tower.add(chute);
    }

    const slidePool = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 0.5, 20),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.15,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85,
      })
    );
    slidePool.position.set(6.6, 0.25, 1.4);
    tower.add(slidePool);
    this.courseGroup.add(tower);

    // 3. 알록달록 도넛 튜브 범퍼
    const specs = isLight
      ? [
          { z: 19, offset: -3.8, color: 0xf472b6 },
          { z: 30, offset: 3.6, color: 0x22d3ee },
        ]
      : [
          { z: 17, offset: -4.2, color: 0xf472b6 },
          { z: 20, offset: 3.9, color: 0x22d3ee },
          { z: 24, offset: -1.2, color: 0xfde047 },
          { z: 28, offset: 4.6, color: 0xa855f7 },
          { z: 31, offset: -4.4, color: 0xfb923c },
          { z: 35, offset: 2.4, color: 0x4ade80 },
        ];
    this.addTubeBumpers(specs);
  }

  private buildPoolTubeSlalom(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    const specs = isLight
      ? [
          { z: 48, offset: 0, color: 0xf472b6 },
          { z: 58, offset: 0, color: 0x22d3ee },
        ]
      : [
          { z: 45, offset: -5.0, color: 0xf472b6 },
          { z: 45, offset: 5.0, color: 0x22d3ee },
          { z: 51, offset: -1.6, color: 0xfde047 },
          { z: 56, offset: 3.4, color: 0xa855f7 },
          { z: 61, offset: -3.6, color: 0xfb923c },
          { z: 61, offset: 4.6, color: 0x4ade80 },
        ];
    this.addTubeBumpers(specs);

    // 튜브 범퍼 사이를 메우는 수영장 레인 로프
    for (const z of [41, 64]) {
      const cx = this.getTrackCenterX(z);
      const yaw = this.getTrackYawAtZ(z);
      const rope = new THREE.Group();
      rope.position.set(cx, this.getTrackHeightAtZ(z) + 0.15, z);
      rope.rotation.y = yaw;
      for (let i = 0; i < 8; i++) {
        const bead = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 8),
          new THREE.MeshStandardMaterial({
            color: i % 2 === 0 ? 0xf472b6 : 0xffffff,
            roughness: 0.45,
          })
        );
        bead.position.set(-7.7 + i * 2.2, 0.1, 0);
        rope.add(bead);
      }
      this.courseGroup.add(rope);
    }
  }

  private buildPoolConveyorBelts(): void {
    const beltSpecs =
      this.obstacleDensity === 'LIGHT'
        ? [
            { zMin: 83, zMax: 97, sideOffsetMin: -8.0, sideOffsetMax: -1.0, speedZ: 13.0, isBoost: true },
            { zMin: 83, zMax: 97, sideOffsetMin: 1.0, sideOffsetMax: 8.0, speedZ: 13.5, isBoost: true },
          ]
        : [
            { zMin: 83, zMax: 97, sideOffsetMin: -8.2, sideOffsetMax: -3.0, speedZ: 13.5, isBoost: true },
            { zMin: 83, zMax: 97, sideOffsetMin: -2.6, sideOffsetMax: 2.6, speedZ: -9.5, isBoost: false },
            { zMin: 83, zMax: 97, sideOffsetMin: 3.0, sideOffsetMax: 8.2, speedZ: 14.0, isBoost: true },
          ];

    for (const cfg of beltSpecs) {
      const zLen = cfg.zMax - cfg.zMin;
      const tex = this.createConveyorTexture(cfg.isBoost);
      tex.repeat.set(1, zLen * 0.45);

      const stripGeo = this.createCurvedFloorStripGeometry(
        cfg.zMin,
        cfg.zMax,
        cfg.sideOffsetMin,
        cfg.sideOffsetMax,
        0.09,
        12
      );
      const mesh = new THREE.Mesh(
        stripGeo,
        new THREE.MeshBasicMaterial({
          map: tex,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      );
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

    // 물살 분사기 (양옆 물대포 연출)
    for (const side of [-1, 1]) {
      for (const z of [84.5, 90.5, 95.5]) {
        const cx = this.getTrackCenterX(z);
        const jetGroup = new THREE.Group();
        jetGroup.position.set(cx + side * 9.9, this.getTrackHeightAtZ(z) + 0.9, z);
        const nozzle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.75, 1.5, 12),
          new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.3 })
        );
        nozzle.rotation.z = Math.PI / 2;
        nozzle.rotation.y = side * 0.35;
        jetGroup.add(nozzle);

        const sprayGeo = new THREE.ConeGeometry(1.0, 4.4, 8, 1, true);
        const spray = new THREE.Mesh(
          sprayGeo,
          new THREE.MeshBasicMaterial({
            color: 0xe0f2fe,
            transparent: true,
            opacity: 0.5,
          })
        );
        spray.rotation.z = side * (Math.PI / 2 - 0.18);
        spray.position.set(-side * 1.9, 0.1, 0);
        jetGroup.add(spray);
        this.courseGroup.add(jetGroup);
      }
    }
  }

  private buildPoolBuoySlalom(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    const specs = isLight
      ? [{ z: 90, offset: 0 }]
      : [
          { z: 85, offset: -6.2 },
          { z: 89, offset: 0 },
          { z: 93, offset: -6.2 },
          { z: 93, offset: 6.2 },
          { z: 96, offset: 0 },
        ];

    for (const spec of specs) {
      const cx = this.getTrackCenterX(spec.z);
      const wx = cx + spec.offset;
      const wy = this.getTrackHeightAtZ(spec.z) + 0.75;
      const pos = new THREE.Vector3(wx, wy, spec.z);
      const radius = 0.95;

      const group = new THREE.Group();
      group.position.copy(pos);
      const buoy = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.8, 1.5, 12),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 })
      );
      buoy.castShadow = true;
      group.add(buoy);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 0.06, radius + 0.06, 0.36, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
      );
      group.add(band);
      this.courseGroup.add(group);

      const body = this.createBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z)
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.75, radius)
          .setRestitution(1.05)
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

  private buildPoolBigWaveZone(): void {
    const isLight = this.obstacleDensity === 'LIGHT';

    if (isLight) {
      this.createSweeper(118, 0, 5.0, 3.4, 2, 0x22d3ee);
    } else {
      this.createSweeper(112, -1.6, 5.2, 4.0, 2, 0x22d3ee);
      this.createSweeper(120, 1.8, 4.8, -3.6, 2, 0xf472b6);
      this.createSweeper(127, 0, 5.6, 4.4, 3, 0x0ea5e9);
    }

    // 빅웨이브 조형물 (트랙 양옆에서 밀려오는 반투명 파도)
    for (const side of [-1, 1]) {
      const z = 108;
      const cx = this.getTrackCenterX(z);
      const wave = new THREE.Mesh(
        new THREE.TorusGeometry(5.4, 0.75, 10, 24, Math.PI),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.72,
          roughness: 0.12,
          metalness: 0.3,
        })
      );
      wave.position.set(cx + side * 8.4, this.getTrackHeightAtZ(z) + 0.3, z);
      wave.rotation.set(0, side * 0.5, Math.PI);
      this.courseGroup.add(wave);
    }
  }

  /** 물벼락 낙하 존: 하늘에서 거대 물풍선/고무오리가 떨어져 맞은 레이서를 크게 날려보낸다 (중간 45~55% 지점) */
  private buildPoolDropZone(zCenter: number, halfZ: number): void {
    const cx = this.getTrackCenterX(zCenter);
    const ringY = this.getTrackHeightAtZ(zCenter);

    const ringGeo = new THREE.RingGeometry(6.6, 8.4, 48);
    ringGeo.rotateX(-Math.PI / 2 + TRACK_SLOPE);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(cx, ringY + 0.07, zCenter);
    this.courseGroup.add(ring);

    const warnLights: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      for (const dz of [-halfZ + 0.6, halfZ - 0.6]) {
        const pz = zCenter + dz;
        const postX = this.getTrackCenterX(pz) + side * 8.9;
        const postBaseY = this.getTrackHeightAtZ(pz);
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 3.4, 8),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
        );
        post.position.set(postX, postBaseY + 1.7, pz);
        this.courseGroup.add(post);

        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.34, 12, 10),
          new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            emissive: 0x38bdf8,
            emissiveIntensity: 1.1,
            roughness: 0.3,
          })
        );
        light.position.set(postX, postBaseY + 3.6, pz);
        this.courseGroup.add(light);
        warnLights.push(light);
      }
    }

    // 낙하 지점의 바닥 표식
    for (let i = -1; i <= 1; i++) {
      const markZ = zCenter + i * (halfZ * 0.62);
      const markCX = this.getTrackCenterX(markZ);
      const markGeo = new THREE.RingGeometry(1.5, 2.1, 28);
      markGeo.rotateX(-Math.PI / 2 + TRACK_SLOPE);
      const mark = new THREE.Mesh(
        markGeo,
        new THREE.MeshBasicMaterial({
          color: 0xf472b6,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
        })
      );
      mark.position.set(markCX, this.getTrackHeightAtZ(markZ) + 0.08, markZ);
      this.courseGroup.add(mark);
      this.overheadBanners.push({ mat: mark.material as THREE.MeshBasicMaterial, z: markZ });
    }

    this.poolDropZones.push({
      z: zCenter,
      halfZ,
      timer: 1.6,
      interval: 1.65,
      ringMesh: ring,
      warnLights,
    });
  }

  private createWaterBalloonMesh(): THREE.Group {
    const group = new THREE.Group();
    const balloon = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0xff5fa2,
        transparent: true,
        opacity: 0.92,
        roughness: 0.08,
        metalness: 0.2,
        emissive: 0xe0417f,
        emissiveIntensity: 0.35,
      })
    );
    balloon.scale.set(1, 1.12, 1);
    balloon.castShadow = true;
    group.add(balloon);

    // 하늘에서도 잘 보이도록 두른 흰색 밴딩
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.13, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
    );
    band.rotation.x = Math.PI / 2;
    group.add(band);

    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 })
    );
    shine.position.set(-0.46, 0.6, 0.84);
    group.add(shine);

    const knot = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0xe0417f, roughness: 0.3 })
    );
    knot.position.y = -1.45;
    knot.rotation.x = Math.PI;
    group.add(knot);
    return group;
  }

  private createRubberDuckMesh(): THREE.Group {
    const group = new THREE.Group();
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.32 });
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), yellowMat);
    bodyMesh.scale.set(1.15, 0.9, 1.25);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 12), yellowMat);
    head.position.set(0, 0.92, 0.62);
    head.castShadow = true;
    group.add(head);

    const beak = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.22, 0.44),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
    );
    beak.position.set(0, 0.82, 1.24);
    group.add(beak);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
      eye.position.set(side * 0.24, 1.1, 1.06);
      group.add(eye);
    }

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 8), yellowMat);
    tail.position.set(0, 0.35, -1.34);
    tail.rotation.x = -Math.PI * 0.42;
    group.add(tail);
    return group;
  }

  private spawnPoolDrop(
    zone: PoolDropZoneData,
    racers: RagdollRacer[]
  ): void {
    const inZone = racers.filter((r) => {
      if (r.state === 'FINISHED') return false;
      const p = r.getPosition();
      return Math.abs(p.z - zone.z) <= zone.halfZ;
    });
    const target =
      inZone.length > 0 && Math.random() < 0.82
        ? inZone[Math.floor(Math.random() * inZone.length)]
        : null;

    const kind: 'BALLOON' | 'DUCK' = Math.random() < 0.55 ? 'BALLOON' : 'DUCK';
    let dropZ: number;
    let dropX: number;
    if (target) {
      const tp = target.getPosition();
      dropZ = tp.z + 1.6 + (Math.random() - 0.5) * 1.6;
      dropX = tp.x + (Math.random() - 0.5) * 1.4;
    } else {
      dropZ = zone.z + (Math.random() - 0.5) * zone.halfZ * 1.5;
      dropX =
        this.getTrackCenterX(dropZ) + (Math.random() - 0.5) * 12;
    }
    dropZ = THREE.MathUtils.clamp(dropZ, zone.z - zone.halfZ, zone.z + zone.halfZ);
    const halfW = this.getTrackHalfWidthAtZ(dropZ);
    const centerX = this.getTrackCenterX(dropZ);
    dropX = THREE.MathUtils.clamp(dropX, centerX - halfW + 1.4, centerX + halfW - 1.4);

    const floorY = this.getTrackHeightAtZ(dropZ);
    const startY = floorY + 21 + Math.random() * 5;
    const mesh = kind === 'BALLOON' ? this.createWaterBalloonMesh() : this.createRubberDuckMesh();
    mesh.scale.setScalar(kind === 'BALLOON' ? 1 : 0.95);
    mesh.position.set(dropX, startY, dropZ);
    this.courseGroup.add(mesh);

    // 낙하 지점 바닥 그림자 표식
    const markerGeo = new THREE.CircleGeometry(1.6, 24);
    markerGeo.rotateX(-Math.PI / 2 + TRACK_SLOPE);
    const marker = new THREE.Mesh(
      markerGeo,
      new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.26,
      })
    );
    marker.position.set(dropX, floorY + 0.1, dropZ);
    this.courseGroup.add(marker);

    this.poolDrops.push({
      mesh,
      x: dropX,
      y: startY,
      z: dropZ,
      vy: -6 - Math.random() * 3,
      radius: kind === 'BALLOON' ? 2.0 : 1.85,
      kind,
      marker,
    });
  }

  private spawnPoolSplash(
    pos: THREE.Vector3,
    color: string,
    particles: ParticleSystem
  ): void {
    const geo = new THREE.RingGeometry(0.4, 1.0, 28);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.copy(pos);
    this.courseGroup.add(mesh);
    this.poolSplashes.push({ mesh, life: 0.62, maxLife: 0.62 });
    particles.spawnHitBurst(pos, '#7dd3fc', 18);
  }

  private updatePoolDrops(
    dt: number,
    racers: RagdollRacer[],
    particles: ParticleSystem,
    sound: SoundManager,
    isRacing: boolean
  ): void {
    // 1. 경고 링 & 경고등 점멸 + 낙하 스케줄
    for (const zone of this.poolDropZones) {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 4.6);
      const ringMat = zone.ringMesh.material as THREE.MeshBasicMaterial;
      ringMat.opacity = 0.18 + pulse * 0.45;
      zone.ringMesh.scale.setScalar(1 + pulse * 0.04);
      for (const light of zone.warnLights) {
        const lm = light.material as THREE.MeshStandardMaterial;
        lm.emissiveIntensity = 0.3 + pulse * 1.9;
      }

      if (!isRacing) continue;
      zone.timer -= dt;
      if (zone.timer > 0) continue;
      zone.timer = zone.interval * (0.8 + Math.random() * 0.5);
      this.spawnPoolDrop(zone, racers);
    }

    // 2. 낙하하는 물풍선 / 고무오리
    for (let i = this.poolDrops.length - 1; i >= 0; i--) {
      const drop = this.poolDrops[i];
      drop.vy -= 26 * dt;
      drop.y += drop.vy * dt;
      drop.mesh.position.set(drop.x, drop.y, drop.z);
      drop.mesh.rotation.y += dt * 1.6;
      drop.mesh.rotation.z = Math.sin(this.elapsedTime * 6 + i) * 0.18;

      const floorY = this.getTrackHeightAtZ(drop.z);
      const markerScale = Math.max(0.35, 1 - (drop.y - floorY) / 26);
      drop.marker.scale.setScalar(markerScale);

      if (drop.y > floorY + drop.radius * 0.9) continue;

      const impact = new THREE.Vector3(drop.x, floorY + 0.35, drop.z);
      this.courseGroup.remove(drop.mesh);
      this.courseGroup.remove(drop.marker);
      this.poolDrops.splice(i, 1);
      this.spawnPoolSplash(impact, drop.kind === 'DUCK' ? '#fde047' : '#ff9ac6', particles);
      sound.playPoopSplat();
      sound.playRagdollHit(1.35);

      if (!isRacing) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const rPos = r.getPosition();
        if (
          Math.hypot(rPos.x - drop.x, rPos.z - drop.z) < drop.radius + 0.95 &&
          Math.abs(rPos.y - floorY) < 3.4
        ) {
          const dirX = rPos.x >= drop.x ? 1 : -1;
          r.triggerRagdoll(
            {
              x: dirX * (20 + Math.random() * 10),
              y: 26 + Math.random() * 10,
              z: -10 - Math.random() * 6,
            },
            undefined,
            1.35
          );
          particles.spawnHitBurst(rPos, '#38bdf8', 16);
          this.onPoolSplash?.(r, drop.kind);
        }
      }
    }

    // 3. 물보라 확산 링
    for (let i = this.poolSplashes.length - 1; i >= 0; i--) {
      const splash = this.poolSplashes[i];
      splash.life -= dt;
      if (splash.life <= 0) {
        this.courseGroup.remove(splash.mesh);
        this.poolSplashes.splice(i, 1);
        continue;
      }
      const t = 1 - splash.life / splash.maxLife;
      splash.mesh.scale.setScalar(1 + t * 3.2);
      (splash.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.95 * (1 - t)
      );
    }
  }

  // =====================================================================
  // MAP 2: TAEKWONDO COURSE (완전히 다른 태권도 전용 장애물 구성!)
  // =====================================================================
  private buildTaekwondoCourse(): void {
    this.buildTaekwondoZone1Dojo();
    this.buildTaekwondoZone2BreakingAndPosts();
    this.buildTaekwondoZone3PoomsaeAndShockwaves();
    this.buildTaekwondoZone4SparringArena();
    this.buildFinishArch(true);
  }

  private buildTaekwondoZone1Dojo(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    const envGroup = this.envCollisionGroup();

    // 1. Standing Taekwondo Kicking Dummy Bags (청·홍 샌드백 미트)
    const bagSpots = isLight
      ? [
          { z: 17, offset: -4.8 },
          { z: 33, offset: 4.8 },
        ]
      : [
          { z: 16, offset: -5.5 },
          { z: 16, offset: 5.5 },
          { z: 25, offset: -3.0 },
          { z: 25, offset: 3.0 },
          { z: 34, offset: -6.0 },
          { z: 34, offset: 6.0 },
        ];
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const redBagMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const blueBagMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 });

    bagSpots.forEach((sp, idx) => {
      const cx = this.getTrackCenterX(sp.z);
      const wx = cx + sp.offset;
      const wz = sp.z;
      const wy = this.getTrackHeightAtZ(wz);

      const bagGroup = new THREE.Group();
      bagGroup.position.set(wx, wy, wz);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.45, 16), baseMat);
      base.position.y = 0.22;
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.56, 1.9, 18),
        idx % 2 === 0 ? redBagMat : blueBagMat
      );
      pad.position.y = 1.35;
      pad.castShadow = true;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.26, 18), bandMat);
      ring.position.y = 1.5;
      bagGroup.add(base, pad, ring);
      this.courseGroup.add(bagGroup);

      const body = this.createBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(wx, wy + 1.1, wz)
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(1.1, 0.65)
          .setRestitution(1.05)
          .setCollisionGroups(envGroup),
        body
      );
    });

    // 2. Taekwondo Vaulting Springboards (이단 앞차기 도약 발판) - launch racers over obstacles!
    if (isLight) {
      this.createSpringboard(20.0, 0, 2.5, 1.6, 22, 25);
      this.createSpringboard(31.5, 0, 2.5, 1.6, 22, 25);
      this.createSlidingShield(26.5, 2.5, 0.95, 0.45, 5.2, 2.2, 0, 0xdc2626);
    } else {
      this.createSpringboard(18.5, -2.5, 2.2, 1.6, 22, 26);
      this.createSpringboard(18.5, 2.5, 2.2, 1.6, 22, 26);
      this.createSpringboard(31.0, 0, 2.6, 1.6, 24, 28);

      // 3. Sliding Taekwondo Hogu / Kick Shields (좌우 왕복 타격 방패)
      this.createSlidingShield(22.0, 2.6, 0.95, 0.45, 5.8, 2.5, 0, 0xdc2626);
      this.createSlidingShield(28.5, 2.8, 0.95, 0.45, 5.6, 2.9, Math.PI, 0x2563eb);
      this.createSlidingShield(37.5, 3.0, 1.0, 0.45, 5.5, 3.3, Math.PI * 0.5, 0x0f172a);
    }
  }

  private buildTaekwondoZone2BreakingAndPosts(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    // 1. First Breaking Gate: 5 Pinewood Breaking Boards (송판 격파) at Z = 46
    this.buildBreakingDoorRow(46, 5, 0, 'PINEWOOD');

    // 2. Bamboo/Wooden Wing-Chun & Taekwondo Slalom Posts + Fast 4-Blade Nunchuck Spinner (Z = 51..58)
    const postSpecs = isLight
      ? [
          { z: 54, offset: -3.6 },
          { z: 54, offset: 3.6 },
        ]
      : [
          { z: 52, offset: -5.2 },
          { z: 52, offset: 5.2 },
          { z: 54, offset: -2.2 },
          { z: 54, offset: 2.2 },
          { z: 57, offset: -4.5 },
          { z: 57, offset: 4.5 },
        ];
    this.addPinballBumpers(postSpecs, 0xb45309);

    if (!isLight) {
      // 4-Blade Black-Belt Nunchuck Spinner in the center!
      this.createSweeper(55, 0, 5.4, 4.2, 4, 0x0f172a);
    }

    // 3. Second Breaking Gate: 4 Black Roof-Tile Stacks (기와장 격파) at Z = 62!
    this.buildBreakingDoorRow(62, 4, 1, 'ROOFTILE');

    if (!isLight) {
      // 4. Taegeuk Bounce Pads before Zone 3 (Z = 67..70)
      this.createSpringboard(67.5, -4.5, 2.0, 1.5, 20, 24);
      this.createSpringboard(67.5, 4.5, 2.0, 1.5, 20, 24);
      this.createSlidingShield(69.5, 2.4, 0.95, 0.45, 5.4, 3.0, 0, 0xdc2626);
    }
  }

  private buildTaekwondoZone3PoomsaeAndShockwaves(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    // 1. Poomsae Rapid-Step Belts (curved strip geometry so NEVER sinks below floor!)
    this.buildConveyorBeltsAndFans(false);

    // 2. Taekwondo War-Drum Kiai Shockwave Cannons (대북 기합 장풍 충격파!)
    const drumConfigs = isLight
      ? [{ zMin: 82.5, zMax: 89.0, side: 1, dirX: -1, freq: 1.85, phase: 1.2 }]
      : [
          { zMin: 75, zMax: 81.5, side: -1, dirX: 1, freq: 2.1, phase: 0 },
          { zMin: 82.5, zMax: 89.0, side: 1, dirX: -1, freq: 2.3, phase: 1.6 },
          { zMin: 90.0, zMax: 96.5, side: -1, dirX: 1, freq: 2.5, phase: 3.1 },
        ];

    for (const dc of drumConfigs) {
      const zMid = (dc.zMin + dc.zMax) * 0.5;
      const cx = this.getTrackCenterX(zMid);
      const yMid = this.getTrackHeightAtZ(zMid) + 1.8;
      const drumX = cx + dc.side * 9.8;

      const drumGroup = new THREE.Group();
      drumGroup.position.set(drumX, yMid, zMid);

      const drumBody = new THREE.Mesh(
        new THREE.CylinderGeometry(1.85, 1.85, 1.6, 20),
        new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 })
      );
      drumBody.rotation.z = Math.PI / 2;
      const drumSkin = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 1.75, 1.7, 20),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 })
      );
      drumSkin.rotation.z = Math.PI / 2;
      drumGroup.add(drumBody, drumSkin);
      this.courseGroup.add(drumGroup);

      // Visible Golden Kiai Shockwave Ring sweeping across the track
      const waveMesh = new THREE.Mesh(
        new THREE.TorusGeometry(1.7, 0.22, 10, 24),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.88 })
      );
      waveMesh.rotation.y = Math.PI / 2;
      waveMesh.position.set(cx, yMid, zMid);
      this.courseGroup.add(waveMesh);

      this.shockwaveDrums.push({
        zMin: dc.zMin,
        zMax: dc.zMax,
        side: dc.side,
        dirX: dc.dirX,
        freq: dc.freq,
        phase: dc.phase,
        drumMesh: drumGroup,
        waveMesh,
        hitCooldowns: new Map(),
      });
    }
  }

  private buildTaekwondoZone4SparringArena(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    if (isLight) {
      this.addPopupBumpers([{ z: 122.5, offset: 0, phase: 0.9, freq: 3.2 }], 0x2563eb);
      this.addSwingingPendulums(
        [{ z: 114, freq: 2.0, phase: 0, maxAngle: 0.82 }],
        true
      );
      return;
    }

    // 1. Pop-up Sparring Kick Launchers at entrance & exit of bridge
    this.addPopupBumpers(
      [
        { z: 103.5, offset: -2.2, phase: 0, freq: 3.8 },
        { z: 103.5, offset: 2.2, phase: 1.9, freq: 3.8 },
        { z: 122.5, offset: 0, phase: 0.9, freq: 4.0 },
      ],
      0x2563eb
    );

    // 2. Hanging Heavy Punching Bags (Z = 108, 118)
    this.addSwingingPendulums(
      [
        { z: 108, freq: 2.5, phase: 0, maxAngle: 0.94 },
        { z: 118, freq: 2.8, phase: Math.PI, maxAngle: 0.94 },
      ],
      true
    );

    // 3. Sliding Sparring Hogu Shield in the middle of the narrow bridge (Z = 113)
    this.createSlidingShield(113, 1.8, 0.95, 0.42, 2.7, 3.2, 0.5, 0xdc2626);

    // 4. Master's Final 4-Blade Black-Belt Sweeper before finish (Z = 127)
    this.createSweeper(127, 0, 5.2, 4.3, 4, 0x0f172a);
  }

  // =====================================================================
  // MAP 3: DINOSAUR KART JUNGLE ESCAPE (공룡 정글 카트 탈출! 228m 서킷)
  // =====================================================================
  private buildDinosaurJungleScenery(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });
    const fernMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 });

    // Jungle palm trees & prehistoric ferns along both sides up to z = 238
    for (let tz = 12; tz <= 238; tz += 12) {
      const cx = this.getTrackCenterX(tz);
      const ty = this.getTrackHeightAtZ(tz) - 1.4;
      const hw = this.getTrackHalfWidthAtZ(tz);
      for (const side of [-1, 1]) {
        const palmGroup = new THREE.Group();
        const distOut = hw + 3.8 + (tz % 3) * 1.4;
        palmGroup.position.set(cx + side * distOut, ty, tz);

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 5.6, 8), trunkMat);
        trunk.position.y = 2.8;
        trunk.rotation.z = -side * 0.14;
        trunk.castShadow = true;
        palmGroup.add(trunk);

        for (let b = 0; b < 5; b++) {
          const frond = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.16, 0.85), palmLeafMat);
          const ang = (b * Math.PI * 2) / 5;
          frond.position.set(
            -side * 0.3 + Math.cos(ang) * 1.2,
            5.5,
            Math.sin(ang) * 1.2
          );
          frond.rotation.y = -ang;
          frond.rotation.z = -0.25;
          frond.castShadow = true;
          palmGroup.add(frond);
        }

        const fern = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), fernMat);
        fern.position.set(-side * 1.1, 0.8, 1.2);
        palmGroup.add(fern);
        this.courseGroup.add(palmGroup);
      }
    }

    // Smoking Volcanoes along the long jungle circuit
    for (const vc of [
      { z: 90, side: -1, scale: 1.2 },
      { z: 148, side: 1, scale: 1.45 },
      { z: 204, side: -1, scale: 1.3 },
    ]) {
      const cx = this.getTrackCenterX(vc.z);
      const vy = this.getTrackHeightAtZ(vc.z) - 2.0;
      const vGroup = new THREE.Group();
      vGroup.position.set(cx + vc.side * 23, vy, vc.z);
      vGroup.scale.setScalar(vc.scale);

      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(8.5, 13.5, 10),
        new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 })
      );
      mountain.position.y = 6.75;
      const lavaCap = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.7, 1.1, 10),
        new THREE.MeshBasicMaterial({ color: 0xf97316 })
      );
      lavaCap.position.y = 13.1;
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(2.1, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 })
      );
      glow.position.y = 13.7;
      vGroup.add(mountain, lavaCap, glow);
      this.courseGroup.add(vGroup);
    }

    // Giant Iconic Dinosaurs guarding the course flanks
    for (const sc of [
      { kind: 'BRACHIOSAURUS' as const, z: 28, side: -1, dist: 14.5, scale: 1.45, rot: 0.65 },
      { kind: 'BRACHIOSAURUS' as const, z: 98, side: 1, dist: 15.0, scale: 1.55, rot: -0.8 },
      { kind: 'BRACHIOSAURUS' as const, z: 168, side: -1, dist: 14.5, scale: 1.5, rot: 0.7 },
      { kind: 'TREX' as const, z: 15, side: 1, dist: 13.5, scale: 1.35, rot: -0.9 },
      { kind: 'TREX' as const, z: 222, side: -1, dist: 13.0, scale: 1.75, rot: 0.75 },
    ]) {
      const dino = this.createDinosaurMesh(sc.kind, sc.scale, true);
      dino.group.position.set(
        this.getTrackCenterX(sc.z) + sc.side * sc.dist,
        this.getTrackHeightAtZ(sc.z) - 1.1,
        sc.z
      );
      dino.group.rotation.y = sc.rot;
      this.courseGroup.add(dino.group);
    }

    // Flying Pteranodons patrolling & bombing the track with sticky Poop!
    const pteroConfigs = isLight
      ? [
          { z: 48, yOffset: 9.6, phase: 0.0, radiusX: 7.5, dropInterval: 2.5 },
          { z: 102, yOffset: 9.8, phase: 1.7, radiusX: 7.5, dropInterval: 2.4 },
          { z: 154, yOffset: 9.6, phase: 3.1, radiusX: 7.5, dropInterval: 2.3 },
          { z: 198, yOffset: 9.4, phase: 4.5, radiusX: 4.5, dropInterval: 2.5 },
        ]
      : [
          { z: 44, yOffset: 9.4, phase: 0.0, radiusX: 8.0, dropInterval: 1.55 },
          { z: 86, yOffset: 9.8, phase: 1.4, radiusX: 8.0, dropInterval: 1.45 },
          { z: 128, yOffset: 9.6, phase: 2.7, radiusX: 8.0, dropInterval: 1.45 },
          { z: 164, yOffset: 9.8, phase: 4.1, radiusX: 8.0, dropInterval: 1.4 },
          { z: 198, yOffset: 9.4, phase: 5.3, radiusX: 4.8, dropInterval: 1.5 },
        ];

    for (const pc of pteroConfigs) {
      const ptero = this.createPteranodonMesh();
      const cx = this.getTrackCenterX(pc.z);
      const y = this.getTrackHeightAtZ(pc.z) + pc.yOffset;
      ptero.group.position.set(cx, y, pc.z);
      this.courseGroup.add(ptero.group);
      this.flyingPterosaurs.push({
        group: ptero.group,
        leftWing: ptero.leftWing,
        rightWing: ptero.rightWing,
        baseX: cx,
        baseY: y,
        baseZ: pc.z,
        phase: pc.phase,
        radiusX: pc.radiusX,
        canDropPoop: true,
        dropTimer: 0.4 + Math.random() * pc.dropInterval,
        dropInterval: pc.dropInterval,
      });
    }
  }

  private createPteranodonMesh(): {
    group: THREE.Group;
    leftWing: THREE.Mesh;
    rightWing: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
    const crestMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 1.5), bodyMat);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.8), bodyMat);
    head.position.set(0, 0.2, 1.05);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 1.1), beakMat);
    beak.position.set(0, 0.12, 1.75);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.95), crestMat);
    crest.position.set(0, 0.48, 0.72);
    crest.rotation.x = 0.25;

    const wingGeo = new THREE.BoxGeometry(2.6, 0.1, 1.0);
    const leftWing = new THREE.Mesh(wingGeo, crestMat);
    leftWing.position.set(-1.6, 0.15, 0);
    const rightWing = new THREE.Mesh(wingGeo, crestMat);
    rightWing.position.set(1.6, 0.15, 0);

    group.add(body, head, beak, crest, leftWing, rightWing);
    group.scale.setScalar(1.3);
    return { group, leftWing, rightWing };
  }

  private createDinosaurMesh(
    kind: 'TREX' | 'TRICERATOPS' | 'BRACHIOSAURUS' | 'STEGOSAURUS',
    scale: number = 1.0,
    registerAnim: boolean = false
  ): {
    group: THREE.Group;
    leftLeg?: THREE.Mesh;
    rightLeg?: THREE.Mesh;
    headPivot?: THREE.Group;
  } {
    const group = new THREE.Group();
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    if (kind === 'TREX') {
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.45 });
      const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 2.8), skinMat);
      torso.position.set(0, 2.4, 0);
      torso.castShadow = true;
      const belly = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.4), bellyMat);
      belly.position.set(0, 2.2, 1.35);

      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.8), skinMat);
      leftLeg.position.set(-0.65, 0.8, 0);
      leftLeg.castShadow = true;
      const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.8), skinMat);
      rightLeg.position.set(0.65, 0.8, 0);
      rightLeg.castShadow = true;
      group.add(leftLeg, rightLeg);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 2.6), skinMat);
      tail.position.set(0, 1.9, -2.3);
      tail.rotation.x = 0.18;

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 3.8, 1.2);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 2.1), skinMat);
      head.position.set(0, 0.3, 0.8);
      head.castShadow = true;
      const teeth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 1.4), whiteMat);
      teeth.position.set(0, -0.35, 1.0);
      for (const ex of [-0.82, 0.82]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.3), eyeMat);
        eye.position.set(ex, 0.6, 1.0);
        headPivot.add(eye);
      }
      headPivot.add(head, teeth);

      if (registerAnim) {
        this.animatedDinoParts.push({
          part: headPivot,
          baseRotX: 0,
          amp: 0.16,
          freq: 2.2,
          phase: Math.random() * 4,
        });
      }

      for (const sx of [-0.95, 0.95]) {
        const tinyArm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 0.5), skinMat);
        tinyArm.position.set(sx, 2.7, 1.45);
        group.add(tinyArm);
      }

      group.add(torso, belly, tail, headPivot);
      group.scale.setScalar(scale);
      return { group, leftLeg, rightLeg, headPivot };
    } else if (kind === 'TRICERATOPS') {
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45 });
      const frillMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.4 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.35, 2.4), skinMat);
      body.position.set(0, 1.25, 0);
      body.castShadow = true;

      for (const lx of [-0.6, 0.6]) {
        for (const lz of [-0.75, 0.75]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.9, 0.5), skinMat);
          leg.position.set(lx, 0.45, lz);
          leg.castShadow = true;
          group.add(leg);
        }
      }

      const frill = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.65, 0.32), frillMat);
      frill.position.set(0, 1.85, 1.15);
      frill.rotation.x = -0.22;
      frill.castShadow = true;

      const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.05, 1.35), skinMat);
      head.position.set(0, 1.3, 1.7);
      head.castShadow = true;

      // 3 iconic white horns!
      for (const hx of [-0.45, 0.45]) {
        const browHorn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.05, 8), whiteMat);
        browHorn.rotation.x = Math.PI * 0.42;
        browHorn.position.set(hx, 1.85, 2.35);
        group.add(browHorn);
      }
      const noseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 8), whiteMat);
      noseHorn.rotation.x = Math.PI * 0.35;
      noseHorn.position.set(0, 1.35, 2.45);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 1.3), skinMat);
      tail.position.set(0, 1.2, -1.65);

      group.add(body, frill, head, noseHorn, tail);
    } else if (kind === 'BRACHIOSAURUS') {
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.45 });
      const spotMat = new THREE.MeshStandardMaterial({ color: 0x5eead4, roughness: 0.4 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 3.6), skinMat);
      body.position.set(0, 2.6, 0);
      body.castShadow = true;

      for (const lx of [-0.85, 0.85]) {
        for (const lz of [-1.2, 1.2]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.1, 0.75), skinMat);
          leg.position.set(lx, 1.05, lz);
          leg.castShadow = true;
          group.add(leg);
        }
      }

      const neckPivot = new THREE.Group();
      neckPivot.position.set(0, 3.2, 1.5);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(1.0, 5.2, 1.0), skinMat);
      neck.position.set(0, 2.5, 0.3);
      neck.rotation.x = 0.14;
      neck.castShadow = true;
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.45), spotMat);
      head.position.set(0, 5.1, 0.85);
      for (const ex of [-0.6, 0.6]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.25), eyeMat);
        eye.position.set(ex, 5.25, 1.05);
        neckPivot.add(eye);
      }
      neckPivot.add(neck, head);

      if (registerAnim) {
        this.animatedDinoParts.push({
          part: neckPivot,
          baseRotX: 0,
          amp: 0.12,
          freq: 1.4,
          phase: Math.random() * 4,
        });
      }

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 2.8), skinMat);
      tail.position.set(0, 2.2, -2.8);
      tail.rotation.x = -0.15;

      group.add(body, neckPivot, tail);
    } else {
      // STEGOSAURUS
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.45 });
      const plateMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.15, 2.3), skinMat);
      body.position.set(0, 1.05, 0);
      body.castShadow = true;

      for (const lx of [-0.52, 0.52]) {
        for (const lz of [-0.7, 0.7]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.42), skinMat);
          leg.position.set(lx, 0.36, lz);
          group.add(leg);
        }
      }

      for (let p = 0; p < 4; p++) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.52), plateMat);
        plate.position.set(0, 1.85, -0.75 + p * 0.52);
        plate.rotation.x = 0.25;
        plate.castShadow = true;
        group.add(plate);
      }

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.95), skinMat);
      head.position.set(0, 0.95, 1.45);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.3), skinMat);
      tail.position.set(0, 1.0, -1.55);
      group.add(head, tail);
    }

    group.scale.setScalar(scale);
    return { group };
  }

  private createRunningTRex(
    zMin: number,
    zMax: number,
    laneOffset: number,
    speedZ: number,
    initialProgress: number,
    scale: number = 0.85
  ): void {
    const curZ = zMin + (zMax - zMin) * initialProgress;
    const wx = this.getTrackCenterX(curZ) + laneOffset;
    const wy = this.getTrackHeightAtZ(curZ);

    const dino = this.createDinosaurMesh('TREX', scale, false);
    // Face straight -Z toward oncoming kart racers!
    dino.group.rotation.y = Math.PI;
    dino.group.position.set(wx, wy, curZ);
    this.courseGroup.add(dino.group);

    const body = this.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(wx, wy + 1.8 * scale, curZ)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.1 * scale, 1.6 * scale, 1.65 * scale)
        .setRestitution(1.05)
        .setCollisionGroups(this.envCollisionGroup()),
      body
    );

    this.runningTRexes.push({
      group: dino.group,
      leftLeg: dino.leftLeg!,
      rightLeg: dino.rightLeg!,
      jawPivot: dino.headPivot!,
      body,
      zMin,
      zMax,
      curZ,
      laneOffset,
      speedZ,
      scale,
      phase: Math.random() * 6,
      hitCooldowns: new Map(),
    });
  }

  private spawnPoopPuddle(x: number, y: number, z: number, life: number = 7.5): void {
    // Limit simultaneous active poop puddles to keep frame rate crisp
    if (this.poopPuddles.length >= 24) {
      const oldest = this.poopPuddles.shift();
      if (oldest) this.courseGroup.remove(oldest.group);
    }

    const group = new THREE.Group();
    group.position.set(x, y + 0.06, z);
    group.rotation.x = TRACK_SLOPE;

    const splatMat = new THREE.MeshStandardMaterial({
      color: 0x713f12,
      roughness: 0.35,
      metalness: 0.08,
    });
    const moundMat = new THREE.MeshStandardMaterial({
      color: 0x854d0e,
      roughness: 0.45,
    });
    const stinkMat = new THREE.MeshBasicMaterial({
      color: 0x84cc16,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.1, 16), splatMat);
    const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.24, 14), moundMat);
    tier1.position.y = 0.16;
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.56, 0.22, 12), moundMat);
    tier2.position.y = 0.36;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.32, 10), moundMat);
    tip.position.y = 0.58;

    const ring = new THREE.Mesh(new THREE.RingGeometry(1.22, 1.48, 20), stinkMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;

    group.add(disc, tier1, tier2, tip, ring);
    this.courseGroup.add(group);

    this.poopPuddles.push({
      group,
      x,
      y,
      z,
      lifeLeft: life,
      maxLife: life,
    });
  }

  private seedInitialPoopPuddles(): void {
    const isLight = this.obstacleDensity === 'LIGHT';
    const spots = isLight
      ? [
          { z: 54, offset: -2.4 },
          { z: 106, offset: 2.6 },
          { z: 152, offset: -1.8 },
          { z: 196, offset: 1.2 },
        ]
      : [
          { z: 48, offset: -2.8 },
          { z: 58, offset: 2.9 },
          { z: 96, offset: 0.0 },
          { z: 126, offset: -3.2 },
          { z: 142, offset: 3.1 },
          { z: 162, offset: -1.6 },
          { z: 190, offset: 1.5 },
          { z: 204, offset: -1.6 },
        ];

    for (const s of spots) {
      const wx = this.getTrackCenterX(s.z) + s.offset;
      const wy = this.getTrackHeightAtZ(s.z);
      this.spawnPoopPuddle(wx, wy, s.z, 18.0);
    }
  }

  private createTurboPad(
    z: number,
    offsetX: number,
    halfW: number = 1.65,
    halfL: number = 2.6
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(0, 0, 128, 128);
    // Bright neon yellow side trim rails
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 10, 128);
    ctx.fillRect(118, 0, 10, 128);

    // Chevrons pointing toward Canvas y = 0 (v = 1 -> +Z forward along curved strip)
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const cy of [42, 98]) {
      ctx.beginPath();
      ctx.moveTo(24, cy + 20);
      ctx.lineTo(64, cy - 20);
      ctx.lineTo(104, cy + 20);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);

    const stripGeo = this.createCurvedFloorStripGeometry(
      z - halfL,
      z + halfL,
      offsetX - halfW,
      offsetX + halfW,
      0.11,
      8
    );
    const mesh = new THREE.Mesh(
      stripGeo,
      new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    this.courseGroup.add(mesh);

    this.turboPads.push({
      z,
      offsetX,
      halfW,
      halfL,
      texture: tex,
      hitCooldowns: new Map(),
    });
  }

  private createRollingBoulder(
    zStart: number,
    zEnd: number,
    speedZ: number,
    laneAmp: number,
    laneFreq: number,
    phase: number,
    radius: number = 1.35
  ): void {
    const initZ = zStart + (zEnd - zStart) * (phase % 1);
    const wx = this.getTrackCenterX(initZ) + Math.sin(phase) * laneAmp;
    const wy = this.getTrackHeightAtZ(initZ) + radius;

    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(radius, 1),
      new THREE.MeshStandardMaterial({
        color: 0x57534e,
        emissive: 0x9a3412,
        emissiveIntensity: 0.35,
        roughness: 0.8,
      })
    );
    mesh.position.set(wx, wy, initZ);
    mesh.castShadow = true;
    this.courseGroup.add(mesh);

    const body = this.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(wx, wy, initZ)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius)
        .setRestitution(1.1)
        .setCollisionGroups(this.envCollisionGroup()),
      body
    );

    this.rollingBoulders.push({
      mesh,
      body,
      zStart,
      zEnd,
      curZ: initZ,
      speedZ,
      laneAmp,
      laneFreq,
      phase,
      radius,
      hitCooldowns: new Map(),
    });
  }

  private createLavaGeyser(
    z: number,
    offsetX: number,
    freq: number,
    phase: number,
    radius: number = 1.65
  ): void {
    const wx = this.getTrackCenterX(z) + offsetX;
    const wy = this.getTrackHeightAtZ(z) + 0.08;

    const ringGeo = new THREE.RingGeometry(radius * 0.45, radius, 22);
    ringGeo.rotateX(-Math.PI / 2 + TRACK_SLOPE);
    const ringMesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide })
    );
    ringMesh.position.set(wx, wy, z);
    this.courseGroup.add(ringMesh);

    const plumeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.65, radius * 0.85, 5.2, 14),
      new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.85,
      })
    );
    plumeMesh.position.set(wx, wy - 2.6, z);
    plumeMesh.visible = false;
    this.courseGroup.add(plumeMesh);

    this.lavaGeysers.push({
      z,
      offsetX,
      radius,
      plumeMesh,
      ringMesh,
      freq,
      phase,
      hitCooldowns: new Map(),
    });
  }

  private createTriceratopsCharger(
    z: number,
    ampX: number,
    freq: number,
    phase: number
  ): void {
    const cx = this.getTrackCenterX(z);
    const halfW = 1.65;
    const halfH = 1.1;
    const halfD = 0.9;
    const y = this.getTrackHeightAtZ(z) + 0.05;
    const initX = cx + Math.sin(phase) * ampX;

    const group = new THREE.Group();
    group.position.set(initX, y, z);

    const dino = this.createDinosaurMesh('TRICERATOPS', 0.88, false);
    // Face +X inside local group, then flip outer group Y rotation based on charging velocity
    dino.group.rotation.y = Math.PI * 0.5;
    group.rotation.y = Math.cos(phase) >= 0 ? 0 : Math.PI;
    group.userData.isCharger = true;
    group.add(dino.group);
    this.courseGroup.add(group);

    const body = this.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(initX, y + halfH, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
        .setRestitution(1.05)
        .setCollisionGroups(this.envCollisionGroup()),
      body
    );

    this.slidingShields.push({
      body,
      mesh: group,
      baseZ: z,
      baseY: y,
      halfW,
      halfH,
      halfD,
      ampX,
      freq,
      phase,
      lastX: initX,
      hitCooldowns: new Map(),
    });
  }

  private buildDinosaurCourse(): void {
    this.buildDinosaurZone1KartCircuit();
    this.buildDinosaurZone2TrexStampede();
    this.buildDinosaurZone3PoopAndVolcano();
    this.buildDinosaurZone4FinalCanyon();
    this.seedInitialPoopPuddles();
    this.buildFinishArch(false);
  }

  private buildDinosaurZone1KartCircuit(): void {
    const isLight = this.obstacleDensity === 'LIGHT';

    // Early Kart Turbo Boost Strips to feel high speed right off the start!
    this.createTurboPad(20, -3.5);
    this.createTurboPad(20, 3.5);
    this.createTurboPad(44, 0.0);

    // Charging Triceratops across the wide jungle highway
    this.createTriceratopsCharger(30, isLight ? 4.8 : 5.6, 2.3, 0);
    if (!isLight) {
      this.createTriceratopsCharger(52, 5.6, 2.6, Math.PI);
    }

    // First charging T-Rex sprinting toward racers in Zone 1!
    this.createRunningTRex(32, 60, isLight ? 3.5 : -3.4, 13.5, 0.75, 0.82);
  }

  private buildDinosaurZone2TrexStampede(): void {
    const isLight = this.obstacleDensity === 'LIGHT';

    // Turbo strips tucked between charging T-Rex lanes
    this.createTurboPad(74, -4.4);
    this.createTurboPad(104, 4.2);

    // Pack of Running T-Rexes charging straight at incoming Karts (-Z)!
    if (isLight) {
      this.createRunningTRex(68, 114, 0.0, 13.5, 0.4, 0.82);
    } else {
      this.createRunningTRex(66, 110, -4.0, 14.2, 0.2, 0.8);
      this.createRunningTRex(74, 118, 4.0, 14.8, 0.72, 0.82);
    }

    this.createTriceratopsCharger(92, isLight ? 4.8 : 5.6, 2.7, 1.2);
  }

  private buildDinosaurZone3PoopAndVolcano(): void {
    const isLight = this.obstacleDensity === 'LIGHT';

    // Rolling giant volcano boulders hurtling diagonally downhill
    if (isLight) {
      this.createRollingBoulder(124, 174, 13.5, 5.2, 1.6, 0.2, 1.35);
    } else {
      this.createRollingBoulder(122, 176, 15.5, 5.8, 1.9, 0.15, 1.4);
      this.createRollingBoulder(124, 176, 14.0, 5.8, 2.1, 0.65, 1.35);
    }

    // Erupting Magma Lava Geysers along the volcanic valley
    const geysers = isLight
      ? [
          { z: 138, offset: -2.8, freq: 1.7, phase: 0 },
          { z: 162, offset: 2.8, freq: 1.8, phase: 1.8 },
        ]
      : [
          { z: 132, offset: -3.8, freq: 2.0, phase: 0 },
          { z: 132, offset: 3.8, freq: 2.0, phase: Math.PI },
          { z: 150, offset: 0.0, freq: 2.2, phase: 1.1 },
          { z: 168, offset: -3.2, freq: 2.1, phase: 0.5 },
          { z: 168, offset: 3.2, freq: 2.1, phase: 2.6 },
        ];
    for (const g of geysers) {
      this.createLavaGeyser(g.z, g.offset, g.freq, g.phase, 1.7);
    }

    // Mid-valley Turbo Pad
    this.createTurboPad(148, -3.8);
    if (!isLight) {
      this.createTurboPad(148, 3.8);
    }
  }

  private buildDinosaurZone4FinalCanyon(): void {
    const isLight = this.obstacleDensity === 'LIGHT';

    // Final canyon T-Rex rush & lava geyser gauntlet on the bridge
    if (isLight) {
      this.createRunningTRex(188, 220, 0.0, 14.0, 0.65, 0.78);
      this.createLavaGeyser(198, -2.2, 1.8, 0.4, 1.5);
      this.createTurboPad(213, 0.0);
    } else {
      this.createLavaGeyser(190, -2.4, 2.0, 0, 1.45);
      this.createLavaGeyser(201, 2.4, 2.0, Math.PI, 1.45);
      this.createRunningTRex(186, 220, 0.0, 15.0, 0.55, 0.8);
      this.createTriceratopsCharger(207, 3.0, 2.8, 0.6);
      this.createTurboPad(214, -3.2);
      this.createTurboPad(214, 3.2);
    }
  }

  // =====================================================================
  // SHARED & MODULAR OBSTACLE BUILDERS
  // =====================================================================
  private createSlidingShield(
    z: number,
    halfW: number,
    halfH: number,
    halfD: number,
    ampX: number,
    freq: number,
    phase: number,
    colorHex: number
  ): void {
    const cx = this.getTrackCenterX(z);
    const y = this.getTrackHeightAtZ(z) + halfH + 0.05;
    const initX = cx + Math.sin(phase) * ampX;

    const group = new THREE.Group();
    group.position.set(initX, y, z);

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2, halfH * 2, halfD * 2),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 })
    );
    pad.castShadow = true;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2 + 0.08, 0.32, halfD * 2 + 0.08),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25 })
    );
    group.add(pad, stripe);
    this.courseGroup.add(group);

    const body = this.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(initX, y, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
        .setRestitution(1.0)
        .setCollisionGroups(this.envCollisionGroup()),
      body
    );

    this.slidingShields.push({
      body,
      mesh: group,
      baseZ: z,
      baseY: y,
      halfW,
      halfH,
      halfD,
      ampX,
      freq,
      phase,
      lastX: initX,
      hitCooldowns: new Map(),
    });
  }

  private createSpringboard(
    z: number,
    offsetX: number,
    halfW: number,
    halfL: number,
    boostZ: number,
    boostY: number
  ): void {
    const cx = this.getTrackCenterX(z);
    const wx = cx + offsetX;
    const wy = this.getTrackHeightAtZ(z) + 0.08;

    const group = new THREE.Group();
    group.position.set(wx, wy, z);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(24, 42);
    ctx.lineTo(64, 92);
    ctx.lineTo(104, 42);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2, 0.28, halfL * 2),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })
    );
    pad.position.y = 0.22;
    pad.rotation.x = -0.14;
    pad.castShadow = true;
    group.add(pad);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2 + 0.2, 0.16, halfL * 2 + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    trim.position.y = -0.04;
    group.add(trim);
    this.courseGroup.add(group);

    this.springboards.push({
      z,
      offsetX,
      halfW,
      halfL,
      boostZ,
      boostY,
      mesh: group,
      hitCooldowns: new Map(),
    });
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
    const wx = cx + lateralOffset;
    const wz = z;
    const wy = this.getTrackHeightAtZ(wz) + 0.95;
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

  private addPopupBumpers(
    specs: { z: number; offset: number; phase: number; freq: number }[],
    colorHex: number
  ): void {
    for (const ps of specs) {
      const cx = this.getTrackCenterX(ps.z);
      const wx = cx + ps.offset;
      const wz = ps.z;
      const wy = this.getTrackHeightAtZ(wz);
      const basePos = new THREE.Vector3(wx, wy, wz);
      const radius = 1.65;

      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.9, 1.4, 20),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.25 })
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
  }

  private addPinballBumpers(
    specs: { z: number; offset: number }[],
    colorHex: number
  ): void {
    for (const pb of specs) {
      const cx = this.getTrackCenterX(pb.z);
      const wx = cx + pb.offset;
      const wz = pb.z;
      const wy = this.getTrackHeightAtZ(wz) + 1.1;
      const pos = new THREE.Vector3(wx, wy, wz);
      const radius = 1.15;

      const group = new THREE.Group();
      group.position.copy(pos);
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.85, 2.2, 20),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.25 })
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

  private buildBreakingDoorRow(
    z: number,
    doorCount: number,
    rowGroup: number,
    style: 'MYSTERY' | 'PINEWOOD' | 'ROOFTILE' | 'EGG'
  ): void {
    const cx = this.getTrackCenterX(z);
    const y = this.getTrackHeightAtZ(z);
    const yaw = this.getTrackYawAtZ(z);
    const halfW = this.getTrackHalfWidthAtZ(z);
    const totalW = halfW * 2;
    const slotW = totalW / doorCount;
    const doorW = slotW - 0.55;

    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const headerColor =
      style === 'PINEWOOD'
        ? 0x78350f
        : style === 'ROOFTILE'
        ? 0x1e293b
        : style === 'EGG'
        ? 0x15803d
        : 0xd97706;
    const headerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(totalW + 0.6, 0.9, 0.8),
      new THREE.MeshStandardMaterial({ color: headerColor, roughness: 0.5 })
    );
    headerMesh.position.set(cx, y + 3.7, z);
    headerMesh.rotation.y = yaw;
    this.courseGroup.add(headerMesh);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    if (style === 'PINEWOOD') {
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(0, 0, 128, 192);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 116, 180);
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.25)';
      ctx.lineWidth = 3;
      for (let gx = 20; gx < 120; gx += 22) {
        ctx.beginPath();
        ctx.moveTo(gx, 8);
        ctx.lineTo(gx, 184);
        ctx.stroke();
      }
      ctx.fillStyle = '#991b1b';
      ctx.font = '900 42px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('송판', 64, 74);
      ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('격파!', 64, 124);
    } else if (style === 'ROOFTILE') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 128, 192);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 6;
      for (let gy = 28; gy < 180; gy += 28) {
        ctx.beginPath();
        ctx.moveTo(8, gy);
        ctx.lineTo(120, gy);
        ctx.stroke();
      }
      ctx.fillStyle = '#facc15';
      ctx.font = '900 40px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('기와', 64, 76);
      ctx.font = '800 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('擊破', 64, 126);
    } else if (style === 'EGG') {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, 128, 192);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 116, 180);

      // Draw a spotted cream dinosaur egg in the center
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(64, 96, 40, 56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Jungle dino egg spots
      ctx.fillStyle = '#16a34a';
      for (const [sx, sy, sr] of [
        [48, 72, 8],
        [78, 66, 6],
        [72, 116, 9],
        [46, 110, 6],
      ]) {
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('공룡알', 64, 96);
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

    const passableTarget = Math.max(2, Math.ceil(doorCount * 0.55));
    const passableFlags = Array.from({ length: doorCount }, (_, i) => i < passableTarget);
    for (let i = passableFlags.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [passableFlags[i], passableFlags[j]] = [passableFlags[j], passableFlags[i]];
    }

    for (let i = 0; i < doorCount; i++) {
      const offset = -halfW + slotW * (i + 0.5);
      const dx = cx + rightX * offset;
      const dz = z + rightZ * offset;
      const dy = this.getTrackHeightAtZ(dz);

      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(dx, dy + 1.65, dz);
      pivotGroup.rotation.y = yaw;

      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(doorW, 3.3, style === 'MYSTERY' ? 0.42 : 0.32),
        new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.45 })
      );
      doorMesh.castShadow = true;
      pivotGroup.add(doorMesh);
      this.courseGroup.add(pivotGroup);

      if (i < doorCount - 1) {
        const divOffset = -halfW + slotW * (i + 1);
        const px = cx + rightX * divOffset;
        const pz = z + rightZ * divOffset;
        const py = this.getTrackHeightAtZ(pz);
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 3.8, 0.7),
          new THREE.MeshStandardMaterial({
            color:
              style === 'MYSTERY' ? 0xb45309 : style === 'EGG' ? 0x15803d : 0x1e293b,
          })
        );
        pillar.position.set(px, py + 1.9, pz);
        pillar.rotation.y = yaw;
        this.courseGroup.add(pillar);
      }

      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      const body = this.createBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(dx, dy + 1.65, dz)
          .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      );
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(doorW * 0.5, 1.65, 0.25)
          .setRestitution(0.75)
          .setCollisionGroups(this.envCollisionGroup()),
        body
      );

      this.mysteryDoors.push({
        rowGroup,
        pivotGroup,
        body,
        collider,
        basePos: new THREE.Vector3(dx, dy + 1.65, dz),
        yaw,
        isPassable: passableFlags[i],
        isOpened: false,
        openAngle: 0,
        hitCooldowns: new Map(),
      });
    }
  }

  private buildConveyorBeltsAndFans(includeFans: boolean): void {
    const beltSpecs =
      this.obstacleDensity === 'LIGHT'
        ? [
            { zMin: 75, zMax: 86, sideOffsetMin: -8.0, sideOffsetMax: -2.6, speedZ: 13.5, isBoost: true },
            { zMin: 87, zMax: 97, sideOffsetMin: 0.0, sideOffsetMax: 7.5, speedZ: 14.5, isBoost: true },
          ]
        : [
            { zMin: 75, zMax: 86, sideOffsetMin: -8.0, sideOffsetMax: -2.6, speedZ: 13.5, isBoost: true },
            { zMin: 75, zMax: 86, sideOffsetMin: -2.2, sideOffsetMax: 2.2, speedZ: -9.0, isBoost: false },
            { zMin: 75, zMax: 86, sideOffsetMin: 2.6, sideOffsetMax: 8.0, speedZ: 13.5, isBoost: true },
            { zMin: 87, zMax: 97, sideOffsetMin: -7.5, sideOffsetMax: 0.0, speedZ: -8.0, isBoost: false },
            { zMin: 87, zMax: 97, sideOffsetMin: 0.0, sideOffsetMax: 7.5, speedZ: 14.5, isBoost: true },
          ];

    for (const cfg of beltSpecs) {
      const zLen = cfg.zMax - cfg.zMin;
      const tex = this.createConveyorTexture(cfg.isBoost);
      tex.repeat.set(1, zLen * 0.45);

      // Curved vertex-aligned strip mesh so it NEVER sinks below the sloped floor!
      const stripGeo = this.createCurvedFloorStripGeometry(
        cfg.zMin,
        cfg.zMax,
        cfg.sideOffsetMin,
        cfg.sideOffsetMax,
        0.09,
        12
      );
      const stripMat = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(stripGeo, stripMat);
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

    if (!includeFans) return;

    const fanConfigs =
      this.obstacleDensity === 'LIGHT'
        ? [{ zMin: 79, zMax: 86, side: -1, dirX: 1, force: 18 }]
        : [
            { zMin: 75, zMax: 82, side: -1, dirX: 1, force: 34 },
            { zMin: 82.5, zMax: 89.5, side: 1, dirX: -1, force: 35 },
            { zMin: 90, zMax: 97, side: -1, dirX: 1, force: 34 },
          ];

    for (const fc of fanConfigs) {
      const zMid = (fc.zMin + fc.zMax) * 0.5;
      const cx = this.getTrackCenterX(zMid);
      const yMid = this.getTrackHeightAtZ(zMid) + 2.3;
      const xHousing = cx + fc.side * 9.8;

      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.3, 1.2, 24),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25 })
      );
      housing.rotation.z = Math.PI / 2;
      housing.position.set(xHousing, yMid, zMid);
      this.courseGroup.add(housing);

      const bladesGroup = new THREE.Group();
      bladesGroup.position.set(xHousing - fc.side * 0.55, yMid, zMid);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
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
    const isTkd = this.mapTheme === 'TAEKWONDO';
    const isDino = this.mapTheme === 'DINOSAUR';
    const isPool = this.mapTheme === 'POOL';
    ctx.fillStyle = isBoost
      ? isPool
        ? '#22d3ee'
        : isTkd
        ? '#2563eb'
        : isDino
        ? '#ea580c'
        : '#10b981'
      : isPool
      ? '#0369a1'
      : isTkd
      ? '#dc2626'
      : isDino
      ? '#4c1d95'
      : '#f43f5e';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = isPool
      ? isBoost
        ? '#ecfeff'
        : '#bae6fd'
      : isTkd
      ? '#fef08a'
      : isDino
      ? isBoost
        ? '#fef08a'
        : '#fb7185'
      : '#ffffff';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (isBoost) {
      ctx.moveTo(24, 88);
      ctx.lineTo(64, 36);
      ctx.lineTo(104, 88);
    } else {
      ctx.moveTo(24, 36);
      ctx.lineTo(64, 88);
      ctx.lineTo(104, 36);
    }
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private addSwingingPendulums(
    configs: { z: number; freq: number; phase: number; maxAngle: number }[],
    isTaekwondoSandbag: boolean
  ): void {
    for (const pc of configs) {
      const cx = this.getTrackCenterX(pc.z);
      const yaw = this.getTrackYawAtZ(pc.z);
      const floorY = this.getTrackHeightAtZ(pc.z);
      const armLength = 6.2;
      const pivotPos = new THREE.Vector3(cx, floorY + armLength + 1.05, pc.z);

      const frameGroup = new THREE.Group();
      frameGroup.position.set(cx, floorY, pc.z);
      frameGroup.rotation.y = yaw;
      const frameMat = new THREE.MeshStandardMaterial({
        color: isTaekwondoSandbag ? 0x1e293b : 0xf8fafc,
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

      if (isTaekwondoSandbag) {
        // Hanging vertical Heavy Taekwondo Punching Bag
        const bag = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 0.95, 2.7, 20),
          new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45 })
        );
        bag.position.set(0, -armLength, 0);
        bag.castShadow = true;
        const redStripe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.98, 0.98, 0.55, 20),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
        );
        redStripe.position.set(0, -armLength, 0);
        pivotGroup.add(bag, redStripe);
      } else {
        const hammerMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(1.05, 1.05, 2.2, 20),
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 })
        );
        hammerMesh.rotation.x = Math.PI / 2;
        hammerMesh.position.set(0, -armLength, 0);
        hammerMesh.castShadow = true;
        pivotGroup.add(hammerMesh);
      }

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

  private buildFinishArch(isTkd: boolean): void {
    const isDino = this.mapTheme === 'DINOSAUR';
    const isPool = this.mapTheme === 'POOL';
    const isFg = this.mapTheme === 'FALLGUYS';
    const finishZ = this.finishZ;
    const cx = this.getTrackCenterX(finishZ);
    const yaw = this.getTrackYawAtZ(finishZ);
    const finishY = this.getTrackHeightAtZ(finishZ);
    const checkTex = this.createCheckeredTexture(
      isTkd ? '#facc15' : isDino ? '#bef264' : isFg ? '#ffd93d' : isPool ? '#22d3ee' : '#ffffff',
      isDino ? '#14532d' : isFg ? '#ff6fb5' : isPool ? '#0e7490' : '#0f172a',
      12,
      2
    );

    // Curved finish strip flush with the track floor
    const finishStripGeo = this.createCurvedFloorStripGeometry(
      finishZ - 1.6,
      finishZ + 1.6,
      -8.8,
      8.8,
      0.08,
      4
    );
    const finishStrip = new THREE.Mesh(
      finishStripGeo,
      new THREE.MeshBasicMaterial({
        map: checkTex,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    this.courseGroup.add(finishStrip);

    const finishGroup = new THREE.Group();
    finishGroup.position.set(cx, finishY, finishZ);
    finishGroup.rotation.y = yaw;

    const archMat = new THREE.MeshStandardMaterial({
      color: isTkd ? 0x1e293b : isDino ? 0x15803d : isFg ? 0xffb703 : isPool ? 0x0891b2 : 0xfacc15,
      roughness: 0.25,
    });
    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.4, 0.9), archMat);
      col.position.set(side * 8.6, 4.7, 0);
      col.castShadow = true;
      finishGroup.add(col);
    }

    const topBannerMat = new THREE.MeshStandardMaterial({
      map: checkTex,
      roughness: 0.3,
      transparent: true,
      opacity: 1,
    });
    const topBanner = new THREE.Mesh(
      new THREE.BoxGeometry(18.4, 1.8, 1.1),
      topBannerMat
    );
    topBanner.position.set(0, 9.0, 0);
    finishGroup.add(topBanner);
    this.overheadBanners.push({ mat: topBannerMat, z: finishZ });

    this.courseGroup.add(finishGroup);

    // Solid cushioned end wall at the end of the finish zone so racers never fall off
    const endZ = finishZ + 14.5;
    const endCX = this.getTrackCenterX(endZ);
    const endY = this.getTrackHeightAtZ(endZ);
    const endYaw = this.getTrackYawAtZ(endZ);
    const endWallHeight = 3.6;

    const endWallGroup = new THREE.Group();
    endWallGroup.position.set(endCX, endY, endZ);
    endWallGroup.rotation.y = endYaw;

    const endWallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(20.6, endWallHeight, 1.0),
      new THREE.MeshStandardMaterial({
        color: isTkd ? 0x1e293b : isDino ? 0x14532d : isFg ? 0xff6fb5 : isPool ? 0x0e7490 : 0x16a34a,
        roughness: 0.5,
      })
    );
    endWallMesh.position.y = endWallHeight * 0.5;
    endWallMesh.castShadow = true;
    endWallMesh.receiveShadow = true;
    endWallGroup.add(endWallMesh);

    const endWallPad = new THREE.Mesh(
      new THREE.BoxGeometry(19.6, 1.1, 1.15),
      new THREE.MeshStandardMaterial({
        map: checkTex,
        roughness: 0.35,
      })
    );
    endWallPad.position.y = 1.8;
    endWallGroup.add(endWallPad);

    const endWallCap = new THREE.Mesh(
      new THREE.BoxGeometry(20.8, 0.32, 1.12),
      new THREE.MeshStandardMaterial({
        color: isTkd ? 0xdc2626 : isDino ? 0xf97316 : isFg ? 0xffd93d : isPool ? 0xf472b6 : 0xfacc15,
        roughness: 0.35,
      })
    );
    endWallCap.position.y = endWallHeight + 0.14;
    endWallGroup.add(endWallCap);

    this.courseGroup.add(endWallGroup);

    const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, endYaw, 0));
    const endBody = this.createBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(endCX, endY + 2.6, endZ)
        .setRotation({ x: endQuat.x, y: endQuat.y, z: endQuat.z, w: endQuat.w })
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(10.8, 3.0, 0.65)
        .setFriction(0.5)
        .setRestitution(0.25)
        .setCollisionGroups(this.envCollisionGroup()),
      endBody
    );
  }

  private createComicFlickSprite(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 130;
    const ctx = canvas.getContext('2d')!;

    const isPlayground = this.mapTheme === 'PLAYGROUND';
    const isDino = this.mapTheme === 'DINOSAUR';
    const isPool = this.mapTheme === 'POOL';
    const isFg = this.mapTheme === 'FALLGUYS';
    const labelText = isPlayground
      ? '💥 쾅!! 박치기!'
      : isDino
      ? '💥 공룡돌진!!'
      : isPool
      ? '💥 물벼락!!'
      : isFg
      ? '💥 데굴데굴!!'
      : '💥 딱밤!!';

    ctx.fillStyle = isPlayground
      ? '#fde047'
      : isDino
      ? '#bbf7d0'
      : isPool
      ? '#a5f3fc'
      : isFg
      ? '#ffe1f0'
      : '#fef08a';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(12, 14, 336, 102, 30);
    ctx.fill();
    ctx.stroke();

    ctx.font = isPlayground
      ? '900 44px "Plus Jakarta Sans", "Pretendard", sans-serif'
      : '900 54px "Plus Jakarta Sans", "Pretendard", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#0f172a';
    ctx.strokeText(labelText, 180, 66);
    ctx.fillStyle = '#ef4444';
    ctx.fillText(labelText, 180, 66);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(5.6, 2.05, 1);
    sprite.renderOrder = 1600;
    sprite.visible = false;
    return sprite;
  }

  private static loadBossGlbTemplate(): Promise<THREE.Group | null> {
    if (ObstacleCourse.bossGlbTemplate) {
      return Promise.resolve(ObstacleCourse.bossGlbTemplate);
    }
    if (ObstacleCourse.bossGlbLoadPromise) {
      return ObstacleCourse.bossGlbLoadPromise;
    }

    const loader = new GLTFLoader();
    ObstacleCourse.bossGlbLoadPromise = new Promise((resolve) => {
      loader.load(
        './models/boss-character.glb',
        (gltf) => {
          const model = gltf.scene;
          model.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              const mesh = node as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              const srcMat = (
                Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
              ) as THREE.MeshStandardMaterial;
              if (srcMat) {
                if (srcMat.map) {
                  srcMat.map.colorSpace = THREE.SRGBColorSpace;
                }
                mesh.material = new THREE.MeshStandardMaterial({
                  map: srcMat.map ?? null,
                  normalMap: srcMat.normalMap ?? null,
                  normalScale: new THREE.Vector2(0.85, 0.85),
                  roughnessMap: srcMat.roughnessMap ?? null,
                  roughness: 0.58,
                  metalness: 0.08,
                });
              }
            }
          });

          model.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          // Match procedural boss height (~2.95 units) with shoe soles resting at y = 0
          const targetHeight = 2.95;
          const scale = size.y > 0.0001 ? targetHeight / size.y : targetHeight;
          model.scale.setScalar(scale);
          model.position.set(
            -center.x * scale,
            -box.min.y * scale,
            -center.z * scale
          );

          const template = new THREE.Group();
          template.add(model);
          ObstacleCourse.bossGlbTemplate = template;
          resolve(template);
        },
        undefined,
        (err) => {
          console.warn('Failed to load boss-character.glb, using procedural fallback:', err);
          resolve(null);
        }
      );
    });

    return ObstacleCourse.bossGlbLoadPromise;
  }

  /**
   * Builds the 3D Mustang Boss Character using `./models/boss-character.glb`
   * (with the procedural stylized 3D boss as an instant fallback while loading).
   * Local forward is +Z; origin (0, 0, 0) sits flush at foot soles.
   */
  private createPlaygroundBossCharacter(): {
    root: THREE.Group;
    bodyPivot: THREE.Group;
    leftArmPivot: THREE.Group;
    rightArmPivot: THREE.Group;
    leftLegPivot: THREE.Group;
    rightLegPivot: THREE.Group;
  } {
    const root = new THREE.Group();
    const fallbackUpperGroup = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd1b8, roughness: 0.52 });
    const blushMat = new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      roughness: 0.7,
      transparent: true,
      opacity: 0.65,
    });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.25 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x4b2e1b, roughness: 0.58 });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.36,
      metalness: 0.14,
    });
    const furMat = new THREE.MeshStandardMaterial({
      color: 0x09090d,
      roughness: 0.96,
      metalness: 0.02,
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.2,
      metalness: 0.85,
    });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5 });
    const glassFrameMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.65,
      roughness: 0.12,
      metalness: 0.2,
    });
    const glassLensMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.24,
      roughness: 0.08,
      metalness: 0.1,
    });

    // Legs (hip pivots at y = 0.72 so shoe soles rest cleanly at y = 0)
    const buildLeg = (side: -1 | 1): THREE.Group => {
      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.28, 0.72, 0);

      const pant = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.54, 14), pantsMat);
      pant.position.set(0, -0.27, 0);
      pant.castShadow = true;
      legPivot.add(pant);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.44), leatherMat);
      shoe.position.set(0, -0.59, 0.06);
      shoe.castShadow = true;
      legPivot.add(shoe);

      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.46), soleMat);
      sole.position.set(0, -0.69, 0.06);
      legPivot.add(sole);

      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.14), silverMat);
      lace.position.set(0, -0.52, 0.14);
      legPivot.add(lace);

      return legPivot;
    };

    const leftLegPivot = buildLeg(-1);
    const rightLegPivot = buildLeg(1);
    root.add(leftLegPivot, rightLegPivot);

    // Upper body pivot at waist (y = 0.76) so shoulder-bash leans forward dynamically!
    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 0.76, 0);
    bodyPivot.add(fallbackUpperGroup);
    root.add(bodyPivot);

    // Shearling leather aviator jacket torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.16, 1.04, 0.72), leatherMat);
    torso.position.set(0, 0.52, 0);
    torso.castShadow = true;
    fallbackUpperGroup.add(torso);

    // Fluffy shearling hem trim
    const hemFur = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.15, 0.78), furMat);
    hemFur.position.set(0, 0.06, 0);
    fallbackUpperGroup.add(hemFur);

    // Fluffy black shearling collar (left & right lapels + back roll)
    const collarBack = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.24, 0.46), furMat);
    collarBack.position.set(0, 1.04, -0.14);
    fallbackUpperGroup.add(collarBack);

    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.32), furMat);
      lapel.position.set(side * 0.34, 0.96, 0.28);
      lapel.rotation.z = -side * 0.36;
      lapel.rotation.y = side * 0.15;
      lapel.castShadow = true;
      fallbackUpperGroup.add(lapel);
    }

    // Center silver zipper & pull tab (+Z chest)
    const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.88, 0.04), silverMat);
    zipper.position.set(0, 0.48, 0.365);
    fallbackUpperGroup.add(zipper);

    const zipPull = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.05), silverMat);
    zipPull.position.set(0, 0.76, 0.38);
    fallbackUpperGroup.add(zipPull);

    // Signature collar buckle strap with 3 silver eyelets (viewer's left / character's right chest)
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.04), leatherMat);
    strap.position.set(-0.24, 0.72, 0.375);
    strap.rotation.z = 0.2;
    fallbackUpperGroup.add(strap);
    for (let e = 0; e < 3; e++) {
      const eyelet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), silverMat);
      eyelet.rotation.x = Math.PI * 0.5;
      eyelet.position.set(-0.26 + e * 0.02, 0.8 - e * 0.09, 0.39);
      fallbackUpperGroup.add(eyelet);
    }

    // Arms with shearling cuffs
    const buildArm = (side: -1 | 1): THREE.Group => {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.73, 0.9, 0);

      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.58, 14), leatherMat);
      sleeve.position.set(0, -0.26, 0);
      sleeve.castShadow = true;
      armPivot.add(sleeve);

      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.14, 14), furMat);
      cuff.position.set(0, -0.56, 0);
      armPivot.add(cuff);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), skinMat);
      hand.position.set(0, -0.71, 0.02);
      hand.castShadow = true;
      armPivot.add(hand);

      return armPivot;
    };

    const leftArmPivot = buildArm(-1);
    const rightArmPivot = buildArm(1);
    fallbackUpperGroup.add(leftArmPivot, rightArmPivot);

    // Chibi-proportioned head (matching boss_character_render.jpg)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.54, 0.02);
    fallbackUpperGroup.add(headGroup);

    const faceMesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 20), skinMat);
    faceMesh.scale.set(1.06, 0.94, 0.98);
    faceMesh.castShadow = true;
    headGroup.add(faceMesh);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skinMat);
      ear.position.set(side * 0.63, -0.02, -0.02);
      headGroup.add(ear);

      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), blushMat);
      cheek.scale.set(1.2, 0.75, 0.4);
      cheek.position.set(side * 0.34, -0.14, 0.52);
      headGroup.add(cheek);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), eyeMat);
      eye.scale.set(0.85, 1.25, 0.6);
      eye.position.set(side * 0.2, 0.04, 0.58);
      headGroup.add(eye);
    }

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat);
    nose.position.set(0, -0.06, 0.62);
    headGroup.add(nose);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.04), eyeMat);
    mouth.position.set(0, -0.22, 0.57);
    headGroup.add(mouth);

    // Signature rounded dark-brown bowl-cut bangs hair
    const crownHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.66, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    crownHair.scale.set(1.05, 0.92, 1.03);
    crownHair.position.set(0, 0.07, -0.02);
    crownHair.castShadow = true;
    headGroup.add(crownHair);

    const backHair = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.63, 0.42, 20), hairMat);
    backHair.position.set(0, 0.04, -0.08);
    headGroup.add(backHair);

    // Rounded bang strands across forehead above glasses
    for (let i = -3; i <= 3; i++) {
      const ang = i * 0.24;
      const bang = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 6, 10), hairMat);
      bang.position.set(Math.sin(ang) * 0.56, 0.25 - Math.abs(i) * 0.015, Math.cos(ang) * 0.55);
      bang.rotation.x = 0.22;
      bang.rotation.y = ang;
      headGroup.add(bang);
    }

    // Clear rectangular eyeglasses (top/bottom/outer/inner bars + bridge + temples + tinted lenses)
    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(0, 0.03, 0.64);
    headGroup.add(glassesGroup);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.04), glassFrameMat);
    bridge.position.set(0, 0.06, 0);
    glassesGroup.add(bridge);

    for (const side of [-1, 1]) {
      const cx = side * 0.24;
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.23, 0.02), glassLensMat);
      lens.position.set(cx, 0, 0);
      glassesGroup.add(lens);

      const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.042, 0.045), glassFrameMat);
      topBar.position.set(cx, 0.125, 0);
      const botBar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.038, 0.045), glassFrameMat);
      botBar.position.set(cx, -0.12, 0);
      const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.045), glassFrameMat);
      leftBar.position.set(cx - 0.17, 0, 0);
      const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.045), glassFrameMat);
      rightBar.position.set(cx + 0.17, 0, 0);
      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.58), glassFrameMat);
      temple.position.set(side * 0.54, 0.06, -0.29);
      temple.rotation.y = side * 0.16;

      glassesGroup.add(topBar, botBar, leftBar, rightBar, temple);
    }

    const applyGlbTemplate = (template: THREE.Group) => {
      const cloned = template.clone(true);
      leftLegPivot.visible = false;
      rightLegPivot.visible = false;
      fallbackUpperGroup.visible = false;
      root.remove(leftLegPivot, rightLegPivot);
      bodyPivot.remove(fallbackUpperGroup);
      bodyPivot.position.set(0, 0, 0);
      bodyPivot.add(cloned);
      root.userData.hasGlbModel = true;
    };

    if (ObstacleCourse.bossGlbTemplate) {
      applyGlbTemplate(ObstacleCourse.bossGlbTemplate);
    } else {
      ObstacleCourse.loadBossGlbTemplate().then((template) => {
        if (template) {
          applyGlbTemplate(template);
        }
      });
    }

    return {
      root,
      bodyPivot,
      leftArmPivot,
      rightArmPivot,
      leftLegPivot,
      rightLegPivot,
    };
  }

  private buildFinishFlickHands(): void {
    const isPlayground = this.mapTheme === 'PLAYGROUND';
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffccb3,
      roughness: 0.42,
      metalness: 0.02,
    });
    const skinAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf4a88c,
      roughness: 0.48,
    });
    const nailMat = new THREE.MeshStandardMaterial({
      color: 0xfff5f5,
      roughness: 0.18,
      metalness: 0.05,
    });
    const cuffRedMat = new THREE.MeshStandardMaterial({
      color: this.mapTheme === 'POOL' ? 0x22d3ee : 0xef4444,
      roughness: 0.4,
    });
    const cuffWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

    for (let slotIndex = 0; slotIndex < 2; slotIndex++) {
      let root: THREE.Group;
      let middleFingerPivot = new THREE.Group();
      let charParts:
        | {
            bodyPivot: THREE.Group;
            leftArmPivot: THREE.Group;
            rightArmPivot: THREE.Group;
            leftLegPivot: THREE.Group;
            rightLegPivot: THREE.Group;
          }
        | undefined;

      if (isPlayground) {
        const built = this.createPlaygroundBossCharacter();
        root = built.root;
        charParts = built;

        root.scale.setScalar(1.95);
        const hoverZ = this.finishZ - 4.0;
        const hoverCX = this.getTrackCenterX(hoverZ) + 6.0;
        const hoverY = this.getTrackHeightAtZ(hoverZ) + 0.1;
        root.position.set(hoverCX, hoverY, hoverZ);
        root.rotation.set(0, Math.PI + 0.48, 0);
        root.visible = slotIndex === 0 && this.flickMode !== 'OFF';
        this.courseGroup.add(root);
      } else {
        root = new THREE.Group();

        // Forearm & Wristband (descending from above)
        const forearm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.68, 0.78, 2.2, 16),
          skinMat
        );
        forearm.position.set(0, 2.55, 0.1);
        forearm.castShadow = true;
        root.add(forearm);

        const cuffRed = new THREE.Mesh(
          new THREE.CylinderGeometry(0.84, 0.84, 0.62, 18),
          cuffRedMat
        );
        cuffRed.position.set(0, 1.5, 0.1);
        root.add(cuffRed);

        const cuffStripe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.86, 0.86, 0.2, 18),
          cuffWhiteMat
        );
        cuffStripe.position.set(0, 1.5, 0.1);
        root.add(cuffStripe);

        // Chunky Cartoon Palm (back of hand faces -Z toward approaching racers; palm faces +Z)
        const palm = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.0, 0.82), skinMat);
        palm.position.set(0, 0.1, 0);
        palm.castShadow = true;
        root.add(palm);

        const knucklePad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 2.15, 14),
          skinMat
        );
        knucklePad.rotation.z = Math.PI * 0.5;
        knucklePad.position.set(0, -0.88, 0);
        root.add(knucklePad);

        // Thumb bracing on +Z palm side for the middle-finger cocking pose
        const thumbPivot = new THREE.Group();
        thumbPivot.position.set(-0.98, -0.05, 0.34);
        thumbPivot.rotation.set(0.35, 0.25, 0.78);
        const thumbSeg = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.3, 0.82, 8, 12),
          skinMat
        );
        thumbSeg.position.set(0.1, -0.5, 0.22);
        thumbPivot.add(thumbSeg);
        const thumbNail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.1), nailMat);
        thumbNail.position.set(0.1, -0.86, -0.04);
        thumbPivot.add(thumbNail);
        root.add(thumbPivot);

        // Curled Index, Ring, and Pinky fingers tucked neatly into the +Z palm
        const curledConfigs = [
          { x: -0.62, scale: 0.92 }, // Index
          { x: 0.58, scale: 0.9 },   // Ring
          { x: 1.0, scale: 0.76 },   // Pinky
        ];
        for (const cfg of curledConfigs) {
          const finger = new THREE.Group();
          finger.position.set(cfg.x, -0.9, 0.08);
          finger.rotation.x = -1.35; // Curled into +Z palm
          const seg1 = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.24 * cfg.scale, 0.65 * cfg.scale, 6, 10),
            skinAccentMat
          );
          seg1.position.set(0, -0.45 * cfg.scale, 0);
          finger.add(seg1);
          const seg2 = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.22 * cfg.scale, 0.55 * cfg.scale, 6, 10),
            skinMat
          );
          seg2.position.set(0, -0.78 * cfg.scale, 0.38 * cfg.scale);
          seg2.rotation.x = -1.0;
          finger.add(seg2);
          root.add(finger);
        }

        // Giant Articulated Middle Finger (딱밤 striking finger!)
        middleFingerPivot = new THREE.Group();
        middleFingerPivot.position.set(-0.02, -0.9, 0);

        const midBase = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.34, 0.98, 8, 14),
          skinMat
        );
        midBase.position.set(0, -0.58, 0);
        midBase.castShadow = true;
        middleFingerPivot.add(midBase);

        const midTip = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.31, 0.85, 8, 14),
          skinMat
        );
        midTip.position.set(0, -1.42, -0.04);
        midTip.castShadow = true;
        middleFingerPivot.add(midTip);

        // Bright white cartoon fingernail on -Z face (the flicking impact surface!)
        const midNail = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.44, 0.14),
          nailMat
        );
        midNail.position.set(0, -1.66, -0.32);
        middleFingerPivot.add(midNail);

        root.add(middleFingerPivot);

        root.scale.setScalar(1.32);
        root.rotation.set(0.18, 0.42, -0.08);
        middleFingerPivot.rotation.x = -1.25;

        const hoverZ = this.finishZ - 5.0;
        const hoverCX = this.getTrackCenterX(hoverZ);
        const hoverY = this.getTrackHeightAtZ(hoverZ) + 7.4;
        root.position.set(hoverCX, hoverY, hoverZ);
        root.visible = slotIndex === 0 && this.flickMode !== 'OFF';
        this.courseGroup.add(root);
      }

      const shockwaveMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shockwaveMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 1.4, 28),
        shockwaveMat
      );
      shockwaveMesh.visible = false;
      this.courseGroup.add(shockwaveMesh);

      const comicSprite = this.createComicFlickSprite();
      this.courseGroup.add(comicSprite);

      this.giantFlickHands.push({
        slotIndex,
        root,
        middleFingerPivot,
        shockwaveMesh,
        comicSprite,
        phase: 'IDLE',
        phaseTimer: 0,
        targetRacer: null,
        impactPos: new THREE.Vector3(),
        isManual: false,
        isCharacterBasher: isPlayground,
        charBodyPivot: charParts?.bodyPivot,
        charLeftArmPivot: charParts?.leftArmPivot,
        charRightArmPivot: charParts?.rightArmPivot,
        charLeftLegPivot: charParts?.leftLegPivot,
        charRightLegPivot: charParts?.rightLegPivot,
      });
    }
  }

  private getMaxFlicks(totalRacers: number): number {
    if (this.flickMode === 'OFF' || totalRacers < 2) return 0;
    if (this.flickMode === 'CHAOS') return Math.min(4, totalRacers - 1);
    return Math.min(2, totalRacers - 1);
  }

  public getRemainingFinishFlicks(totalRacers: number): number {
    const maxFlicks = this.getMaxFlicks(totalRacers);
    return Math.max(0, maxFlicks - this.flickedRacerIds.size);
  }

  public hasBeenFlicked(racerId: string): boolean {
    return this.flickedRacerIds.has(racerId);
  }

  public triggerManualLeaderFlick(racers: RagdollRacer[]): RagdollRacer | null {
    const active = racers
      .filter((r) => r.state !== 'FINISHED')
      .sort((a, b) => b.getPosition().z - a.getPosition().z);
    const target = active[0];
    if (!target) return null;

    const hand =
      this.giantFlickHands.find((h) => h.phase === 'IDLE') ||
      this.giantFlickHands.find((h) => h.phase === 'DONE');
    if (!hand) return null;

    hand.phase = 'WINDUP';
    hand.phaseTimer = 0;
    hand.targetRacer = target;
    hand.isManual = true;
    hand.root.visible = true;
    hand.shockwaveMesh.visible = false;
    hand.comicSprite.visible = false;

    const side = hand.slotIndex === 0 ? 1 : -1;
    const tp = target.getPosition();
    if (hand.isCharacterBasher) {
      hand.root.scale.setScalar(1.65);
      const floorY = this.getTrackHeightAtZ(tp.z + 2.0);
      hand.root.position.set(tp.x + side * 3.4, floorY + 0.1, tp.z + 2.2);
      hand.root.rotation.set(
        0,
        Math.atan2(tp.x - hand.root.position.x, tp.z - hand.root.position.z),
        0
      );
    } else {
      hand.root.scale.setScalar(1.45);
      hand.root.position.set(tp.x + side * 2.5, tp.y + 4.4, tp.z + 1.2);
    }
    return target;
  }

  public resetCourseState(): void {
    this.gateOpen = false;
    this.gateOpenProgress = 0;
    const z = 8.5;
    const cx = this.getTrackCenterX(z);
    const baseY = this.getTrackHeightAtZ(z) + 1.25;
    this.startGateMesh.position.set(cx, baseY, z);
    this.startGateBody.setNextKinematicTranslation({ x: cx, y: baseY, z });

    // Reset finish-line Giant Finger Flick / Playground Character Basher trap
    this.flickedRacerIds.clear();
    const hoverZ = this.finishZ - 4.0;
    for (const hand of this.giantFlickHands) {
      hand.phase = 'IDLE';
      hand.phaseTimer = 0;
      hand.targetRacer = null;
      hand.isManual = false;
      if (hand.isCharacterBasher) {
        const hoverCX = this.getTrackCenterX(hoverZ) + 6.2;
        const hoverY = this.getTrackHeightAtZ(hoverZ) + 0.1;
        hand.root.scale.setScalar(1.65);
        hand.root.position.set(hoverCX, hoverY, hoverZ);
        hand.root.rotation.set(0, -0.78, 0);
        hand.charBodyPivot?.rotation.set(0, 0, 0);
        hand.charLeftArmPivot?.rotation.set(0, 0, 0);
        hand.charRightArmPivot?.rotation.set(0, 0, 0);
        hand.charLeftLegPivot?.rotation.set(0, 0, 0);
        hand.charRightLegPivot?.rotation.set(0, 0, 0);
      } else {
        const hoverCX = this.getTrackCenterX(hoverZ) + 4.4;
        const hoverY = this.getTrackHeightAtZ(hoverZ) + 6.8;
        hand.root.scale.setScalar(1.38);
        hand.root.position.set(hoverCX, hoverY, hoverZ);
        hand.root.rotation.set(0.16, -0.52, 0.24);
        hand.middleFingerPivot.rotation.x = -1.25;
      }
      hand.root.visible = hand.slotIndex === 0 && this.flickMode !== 'OFF';
      hand.shockwaveMesh.visible = false;
      hand.comicSprite.visible = false;
    }

    // Reset Dinosaur Kart traps (Poop drops/puddles, T-Rex cooldowns, Boulders, Turbo Pads, Lava Geysers)
    for (const fp of this.fallingPoops) {
      this.courseGroup.remove(fp.mesh);
    }
    this.fallingPoops = [];

    // Reset Pool water-balloon drops & splash rings
    for (const drop of this.poolDrops) {
      this.courseGroup.remove(drop.mesh);
      this.courseGroup.remove(drop.marker);
    }
    this.poolDrops = [];
    for (const splash of this.poolSplashes) {
      this.courseGroup.remove(splash.mesh);
    }
    this.poolSplashes = [];
    for (const zone of this.poolDropZones) {
      zone.timer = 1.6;
    }

    // Reset Fall Guys gimmicks (에어쿠션·풍선 펀치월·피스톤)
    for (const cushion of this.fallguysCushions) {
      cushion.hitCooldowns.clear();
      cushion.squash = 0;
    }
    for (const wall of this.fallguysPunchWalls) {
      wall.hitCooldowns.clear();
    }
    for (const piston of this.fallguysPistons) {
      piston.hitCooldowns.clear();
    }
    for (const puddle of this.poopPuddles) {
      this.courseGroup.remove(puddle.group);
    }
    this.poopPuddles = [];
    if (this.mapTheme === 'DINOSAUR') {
      this.seedInitialPoopPuddles();
    }
    for (const pt of this.flyingPterosaurs) {
      pt.dropTimer = 0.4 + Math.random() * pt.dropInterval;
    }
    for (const trex of this.runningTRexes) {
      trex.hitCooldowns.clear();
    }
    for (const b of this.rollingBoulders) {
      b.hitCooldowns.clear();
    }
    for (const pad of this.turboPads) {
      pad.hitCooldowns.clear();
    }
    for (const g of this.lavaGeysers) {
      g.hitCooldowns.clear();
    }

    // Re-shuffle passable doors per rowGroup so EVERY gate row always has passable doors!
    const grouped = new Map<number, MysteryDoorData[]>();
    for (const door of this.mysteryDoors) {
      const list = grouped.get(door.rowGroup) || [];
      list.push(door);
      grouped.set(door.rowGroup, list);
    }

    for (const doors of grouped.values()) {
      const passableTarget = Math.max(2, Math.ceil(doors.length * 0.55));
      const flags = Array.from({ length: doors.length }, (_, i) => i < passableTarget);
      for (let i = flags.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flags[i], flags[j]] = [flags[j], flags[i]];
      }
      doors.forEach((door, idx) => {
        door.isPassable = flags[idx];
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
    sound: SoundManager,
    isRacing: boolean = false,
    cameraPos?: THREE.Vector3
  ): void {
    this.elapsedTime += dt;

    // 0. Fade overhead arch signs when camera approaches so they never block racer sightlines
    if (cameraPos) {
      for (const ob of this.overheadBanners) {
        const isOccludingRange =
          cameraPos.z >= ob.z - 12 && cameraPos.z <= ob.z + 1.5;
        const targetOpacity = isOccludingRange ? 0.14 : 1.0;
        ob.mat.opacity = THREE.MathUtils.lerp(
          ob.mat.opacity,
          targetOpacity,
          Math.min(1, dt * 10 + 0.15)
        );
        ob.mat.depthWrite = ob.mat.opacity > 0.5;
      }
    }

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

    // 3. Sliding Taekwondo Shields / Triceratops Chargers / Mustang Boss Obstacles
    for (const sh of this.slidingShields) {
      const cx = this.getTrackCenterX(sh.baseZ);
      const curX = cx + Math.sin(this.elapsedTime * sh.freq + sh.phase) * sh.ampX;
      const vx = curX - sh.lastX;
      sh.lastX = curX;

      if (sh.mesh.userData.isMustangBoss) {
        const walkCycle = this.elapsedTime * 7.2 + sh.phase;
        const bounceY = Math.abs(Math.sin(walkCycle)) * 0.14;
        const trackYaw = (sh.mesh.userData.trackYaw as number) || 0;
        sh.mesh.position.set(curX, sh.baseY + bounceY, sh.baseZ);
        if (Math.abs(vx) > 0.0002) {
          sh.mesh.rotation.y = Math.PI + trackYaw - Math.sign(vx) * 0.28;
        }
        const bodyPivot = sh.mesh.userData.bodyPivot as THREE.Group | undefined;
        if (bodyPivot) {
          bodyPivot.rotation.set(0.06, 0, Math.sin(walkCycle) * 0.08);
        }
        sh.body.setNextKinematicTranslation({ x: curX, y: sh.baseY + sh.halfH, z: sh.baseZ });
      } else {
        sh.mesh.position.set(curX, sh.baseY, sh.baseZ);
        if (sh.mesh.userData.isCharger && Math.abs(vx) > 0.0004) {
          sh.mesh.rotation.y = vx >= 0 ? 0 : Math.PI;
        }
        sh.body.setNextKinematicTranslation({ x: curX, y: sh.baseY, z: sh.baseZ });
      }

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = sh.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.55) continue;

        const rPos = r.getPosition();
        if (
          Math.abs(rPos.x - curX) < sh.halfW + 0.55 &&
          Math.abs(rPos.z - sh.baseZ) < sh.halfD + 0.65 &&
          Math.abs(rPos.y - sh.baseY) < sh.halfH * 2 + 0.8
        ) {
          sh.hitCooldowns.set(r.id, this.elapsedTime);
          const pushDirX = Math.sign(vx) || (rPos.x >= curX ? 1 : -1);
          r.triggerRagdoll(
            {
              x: pushDirX * 36 + (Math.random() - 0.5) * 6,
              y: 22 + Math.random() * 8,
              z: -14,
            },
            undefined,
            1.2
          );
          particles.spawnHitBurst(rPos, '#facc15', 12);
          sound.playRagdollHit(1.25);
        }
      }
    }

    // 4. Taekwondo Vaulting Springboards (도약 발판)
    for (const sb of this.springboards) {
      const cx = this.getTrackCenterX(sb.z);
      const wx = cx + sb.offsetX;
      const wy = this.getTrackHeightAtZ(sb.z);

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = sb.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.9) continue;

        const rPos = r.getPosition();
        if (
          Math.abs(rPos.x - wx) < sb.halfW &&
          Math.abs(rPos.z - sb.z) < sb.halfL &&
          rPos.y - wy < 1.8
        ) {
          sb.hitCooldowns.set(r.id, this.elapsedTime);
          r.torsoBody.applyImpulse(
            { x: (Math.random() - 0.5) * 6, y: sb.boostY, z: sb.boostZ },
            true
          );
          particles.spawnHitBurst(rPos, '#facc15', 8);
          sound.playBumperBounce();
        }
      }
    }

    // 5. Mystery / Pinewood / Roof-Tile Breaking Doors
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

    // 6. Pop-up Floor Bumpers
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

    // 7. Pinball / Slalom Posts
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

    // 8. Conveyor / Poomsae Step Belts
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

    // 9. Wind Fans (Map 1)
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

    // 10. Kiai Shockwave War Drums (Map 2)
    for (const sd of this.shockwaveDrums) {
      const cycle = ((this.elapsedTime * sd.freq * 0.45 + sd.phase) % 1 + 1) % 1;
      const zMid = (sd.zMin + sd.zMax) * 0.5;
      const cx = this.getTrackCenterX(zMid);
      const yMid = this.getTrackHeightAtZ(zMid) + 1.8;
      const waveX = cx + sd.side * 9.0 + sd.dirX * cycle * 18.0;

      sd.waveMesh.position.set(waveX, yMid, zMid);
      const scale = 0.8 + cycle * 1.1;
      sd.waveMesh.scale.set(scale, scale, 1);
      (sd.waveMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 1.0 - cycle);

      const drumPulse = cycle < 0.15 ? 1.18 : 1.0;
      sd.drumMesh.scale.set(drumPulse, drumPulse, drumPulse);

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = sd.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.75) continue;

        const rPos = r.getPosition();
        if (
          rPos.z >= sd.zMin &&
          rPos.z <= sd.zMax &&
          Math.abs(rPos.x - waveX) < 1.8 &&
          rPos.y - this.getTrackHeightAtZ(rPos.z) < 3.6
        ) {
          sd.hitCooldowns.set(r.id, this.elapsedTime);
          r.triggerRagdoll(
            { x: sd.dirX * 32, y: 16, z: -6 },
            undefined,
            0.95
          );
          particles.spawnHitBurst(rPos, '#facc15', 8);
          sound.playRagdollHit(0.95);
        }
      }
    }

    // 11. Zone 4 Swinging Pendulums / Hanging Heavy Sandbags
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

    // 12. Pre-Finish Giant Finger Flick / Playground Character Bash (딱밤/박치기 스위치)
    const maxFlicks = this.getMaxFlicks(racers.length);
    const triggerFlickZoneZ = this.finishZ - 5.8;

    if (isRacing && this.flickMode !== 'OFF' && this.flickedRacerIds.size < maxFlicks) {
      const candidates = racers
        .filter((r) => {
          if (r.state === 'FINISHED' || this.flickedRacerIds.has(r.id)) return false;
          const p = r.getPosition();
          return p.z >= triggerFlickZoneZ && p.z < this.finishZ - 0.8;
        })
        .sort((a, b) => b.getPosition().z - a.getPosition().z);

      for (const target of candidates) {
        if (this.flickedRacerIds.size >= maxFlicks) break;
        const freeHand = this.giantFlickHands.find((h) => h.phase === 'IDLE');
        if (!freeHand) break;

        this.flickedRacerIds.add(target.id);
        freeHand.phase = 'WINDUP';
        freeHand.phaseTimer = 0;
        freeHand.targetRacer = target;
        freeHand.isManual = false;
        freeHand.root.visible = true;

        const side = freeHand.slotIndex === 0 ? 1 : -1;
        const tp = target.getPosition();
        if (freeHand.isCharacterBasher) {
          freeHand.root.scale.setScalar(1.95);
          const spawnZ = tp.z + 2.8;
          const floorY = this.getTrackHeightAtZ(spawnZ);
          freeHand.root.position.set(tp.x + side * 4.2, floorY + 0.1, spawnZ);
          freeHand.root.rotation.set(
            0,
            Math.atan2(tp.x - freeHand.root.position.x, tp.z - freeHand.root.position.z),
            0
          );
        } else {
          freeHand.root.scale.setScalar(1.45);
          freeHand.root.position.set(tp.x + side * 2.5, tp.y + 4.4, tp.z + 1.2);
        }
      }
    }

    for (const hand of this.giantFlickHands) {
      const side = hand.slotIndex === 0 ? 1 : -1;
      if (hand.phase === 'IDLE') {
        if (
          hand.slotIndex === 0 &&
          this.flickMode !== 'OFF' &&
          this.flickedRacerIds.size < maxFlicks
        ) {
          hand.root.visible = true;
          const hoverZ = this.finishZ - 4.0;
          if (hand.isCharacterBasher) {
            const hoverCX = this.getTrackCenterX(hoverZ) + 6.0;
            const hoverY = this.getTrackHeightAtZ(hoverZ) + 0.1;
            const idleBounce = Math.abs(Math.sin(this.elapsedTime * 3.6)) * 0.16;
            hand.root.scale.setScalar(1.95);
            hand.root.position.set(hoverCX, hoverY + idleBounce, hoverZ);
            hand.root.rotation.set(0, Math.PI + 0.48 + Math.sin(this.elapsedTime * 1.4) * 0.14, 0);
            hand.charBodyPivot?.rotation.set(0.04, 0, Math.sin(this.elapsedTime * 2.4) * 0.05);
            if (hand.charLeftArmPivot && hand.charRightArmPivot) {
              hand.charLeftArmPivot.rotation.x = Math.sin(this.elapsedTime * 3.6) * 0.25;
              hand.charRightArmPivot.rotation.x = -Math.sin(this.elapsedTime * 3.6) * 0.25;
            }
            if (hand.charLeftLegPivot && hand.charRightLegPivot) {
              hand.charLeftLegPivot.rotation.x = 0;
              hand.charRightLegPivot.rotation.x = 0;
            }
          } else {
            const hoverCX = this.getTrackCenterX(hoverZ) + 4.4;
            const hoverY =
              this.getTrackHeightAtZ(hoverZ) + 6.8 + Math.sin(this.elapsedTime * 2.6) * 0.45;
            hand.root.position.set(
              hoverCX + Math.sin(this.elapsedTime * 1.4) * 1.4,
              hoverY,
              hoverZ
            );
            hand.root.rotation.set(0.16, -0.52 + Math.sin(this.elapsedTime * 1.2) * 0.08, 0.24);
            hand.middleFingerPivot.rotation.x = -1.25 - Math.sin(this.elapsedTime * 5.0) * 0.08;
          }
        } else {
          hand.root.visible = false;
        }
      } else if (hand.phase === 'WINDUP') {
        hand.phaseTimer += dt;
        const target = hand.targetRacer;
        if (!target || target.state === 'FINISHED') {
          hand.phase =
            this.flickMode !== 'OFF' && this.flickedRacerIds.size < maxFlicks ? 'IDLE' : 'DONE';
          hand.phaseTimer = 0;
          hand.targetRacer = null;
          hand.isManual = false;
          continue;
        }

        const tp = target.getPosition();
        const windupDur = hand.isCharacterBasher ? 0.18 : 0.11;
        const windRatio = Math.min(1, hand.phaseTimer / windupDur);

        if (hand.isCharacterBasher) {
          const targetZ = tp.z + 1.05;
          const runHop = Math.abs(Math.sin(hand.phaseTimer * 42)) * 0.18;
          const desiredPos = new THREE.Vector3(
            tp.x + side * 0.65,
            this.getTrackHeightAtZ(targetZ) + 0.08 + runHop,
            targetZ
          );
          hand.root.position.lerp(desiredPos, Math.min(1, dt * 28));
          hand.root.rotation.set(
            0,
            Math.atan2(tp.x - hand.root.position.x, tp.z - hand.root.position.z),
            0
          );
          const waddleZ = Math.sin(hand.phaseTimer * 42) * 0.14;
          hand.charBodyPivot?.rotation.set(
            THREE.MathUtils.lerp(0.08, 0.28, windRatio),
            0,
            waddleZ
          );
          const stride = Math.sin(hand.phaseTimer * 42) * 0.85;
          if (hand.charLeftLegPivot && hand.charRightLegPivot) {
            hand.charLeftLegPivot.rotation.x = stride;
            hand.charRightLegPivot.rotation.x = -stride;
          }
          if (hand.charLeftArmPivot && hand.charRightArmPivot) {
            hand.charLeftArmPivot.rotation.x = -stride * 0.85;
            hand.charRightArmPivot.rotation.x = stride * 0.85;
          }
        } else {
          // Offset hand to the side of the racer so trailing/climax cameras have an unobstructed side view of the flick
          const desiredPos = new THREE.Vector3(tp.x + side * 2.1, tp.y + 1.95, tp.z + 1.15);
          hand.root.position.lerp(desiredPos, Math.min(1, dt * 42));
          hand.root.rotation.set(0.12, -side * 0.62, side * 0.34);
          // Tightly curl middle finger against thumb before snapping
          hand.middleFingerPivot.rotation.x = THREE.MathUtils.lerp(-1.25, -1.58, windRatio);
        }

        // Execute SNAP / BASH impact at end of windup or sooner if racer nears finish line
        if (hand.phaseTimer >= windupDur || tp.z >= this.finishZ - 3.2) {
          hand.phase = 'IMPACT';
          hand.phaseTimer = 0;
          hand.impactPos.set(tp.x, tp.y + 0.6, tp.z);

          if (hand.isCharacterBasher) {
            const impactZ = tp.z + 1.05;
            hand.root.position.set(
              tp.x + side * 0.72,
              this.getTrackHeightAtZ(impactZ) + 0.08,
              impactZ
            );
            hand.root.rotation.set(
              0,
              Math.atan2(tp.x - hand.root.position.x, tp.z - hand.root.position.z),
              0
            );
            hand.charBodyPivot?.rotation.set(0.32, side * 0.36, 0);
            if (hand.charLeftArmPivot && hand.charRightArmPivot) {
              hand.charLeftArmPivot.rotation.x = -0.65;
              hand.charRightArmPivot.rotation.x = 0.55;
            }
          } else {
            // Violent snap forward toward -Z!
            hand.middleFingerPivot.rotation.x = 0.85;
            hand.root.position.set(tp.x + side * 1.95, tp.y + 1.75, tp.z + 0.85);
          }

          const cx = this.getTrackCenterX(tp.z);
          const inwardVx = THREE.MathUtils.clamp(
            (cx - tp.x) * 1.15 + (Math.random() - 0.5) * 4.5,
            -7,
            7
          );
          // Launch all 6 ragdoll bodies backward (-Z) & high (+Y) so racer flies ~18-22m back!
          target.setAllBodiesLinvel({ x: inwardVx, y: 13.5, z: -26.5 });
          target.triggerRagdoll(
            { x: inwardVx * 1.2, y: 12, z: -20 },
            { x: -24, y: (Math.random() - 0.5) * 18, z: (Math.random() - 0.5) * 18 },
            1.75
          );

          particles.spawnHitBurst(hand.impactPos, '#facc15', 20);
          particles.spawnHitBurst(hand.impactPos, '#ef4444', 12);
          if (hand.isCharacterBasher) {
            sound.playRagdollHit(1.75);
          }
          sound.playFingerFlick();

          hand.shockwaveMesh.visible = true;
          hand.shockwaveMesh.position.copy(hand.impactPos);
          hand.shockwaveMesh.scale.setScalar(0.5);
          (hand.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = 0.95;

          hand.comicSprite.visible = true;
          hand.comicSprite.position.set(
            tp.x - (hand.isCharacterBasher ? side * 1.4 : 0),
            tp.y + (hand.isCharacterBasher ? 4.3 : 2.4),
            tp.z
          );
          (hand.comicSprite.material as THREE.SpriteMaterial).opacity = 1;

          if (this.onFinishFlick) {
            this.onFinishFlick(target, this.flickedRacerIds.size, hand.isManual);
          }
        }
      } else if (hand.phase === 'IMPACT') {
        hand.phaseTimer += dt;
        const t = Math.min(1, hand.phaseTimer / 0.72);

        if (hand.isCharacterBasher) {
          // Recoil pose holding sturdy shoulder-bash follow-through on track
          hand.root.position.z += dt * 1.4;
          hand.charBodyPivot?.rotation.set(
            THREE.MathUtils.lerp(0.32, 0.02, t),
            THREE.MathUtils.lerp(side * 0.36, 0, t),
            0
          );
        } else {
          // Slight recoil lift & finger follow-through wobble
          hand.root.position.y += dt * 4.2;
          hand.middleFingerPivot.rotation.x = 0.72 + Math.sin(hand.phaseTimer * 36) * 0.14 * (1 - t);
        }

        // Shockwave ring expands rapidly and fades
        const ringScale = 0.6 + t * 4.6;
        hand.shockwaveMesh.scale.setScalar(ringScale);
        (hand.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          (1 - t) * 0.95
        );

        // Comic banner sprite pops up above character head and fades
        const spriteBaseY = hand.isCharacterBasher ? 4.2 : 2.1;
        hand.comicSprite.position.y = hand.impactPos.y + spriteBaseY + t * 1.8;
        const popScale = t < 0.2 ? 0.65 + (t / 0.2) * 0.48 : 1.13;
        hand.comicSprite.scale.set(5.4 * popScale, 1.98 * popScale, 1);
        (hand.comicSprite.material as THREE.SpriteMaterial).opacity =
          t > 0.65 ? Math.max(0, (1 - t) / 0.35) : 1;

        if (hand.phaseTimer >= 0.72) {
          hand.shockwaveMesh.visible = false;
          hand.comicSprite.visible = false;
          hand.targetRacer = null;
          hand.isManual = false;
          if (
            this.flickMode !== 'OFF' &&
            (hand.slotIndex === 0 || this.flickMode === 'CHAOS') &&
            this.flickedRacerIds.size < maxFlicks
          ) {
            hand.phase = 'IDLE';
            hand.phaseTimer = 0;
            hand.middleFingerPivot.rotation.x = -1.25;
            hand.charBodyPivot?.rotation.set(0, 0, 0);
          } else {
            hand.phase = 'DONE';
            hand.phaseTimer = 0;
          }
        }
      } else if (hand.phase === 'DONE') {
        hand.phaseTimer += dt;
        hand.root.position.y += dt * 16;
        const baseScale = hand.isCharacterBasher ? 1.95 : 1.38;
        const shrink = Math.max(0.01, baseScale * (1 - hand.phaseTimer * 2.5));
        hand.root.scale.setScalar(shrink);
        if (hand.phaseTimer >= 0.4) {
          hand.root.visible = false;
        }
      }
    }

    // 13. Flying Pteranodons & Airborne Poop Bombs (익룡이 날아가다 똥 투하!)
    for (const pt of this.flyingPterosaurs) {
      const t = this.elapsedTime * 0.85 + pt.phase;
      const nextX = pt.baseX + Math.sin(t) * pt.radiusX;
      const nextZ = pt.baseZ + Math.cos(t * 0.7) * 5.5;
      const nextY = pt.baseY + Math.sin(t * 1.9) * 1.35;
      const dx = nextX - pt.group.position.x;
      const dz = nextZ - pt.group.position.z;
      pt.group.position.set(nextX, nextY, nextZ);
      if (Math.hypot(dx, dz) > 0.001) {
        pt.group.rotation.y = Math.atan2(dx, dz);
      }
      const flap = Math.sin(this.elapsedTime * 7.2 + pt.phase) * 0.45;
      pt.leftWing.rotation.z = flap;
      pt.rightWing.rotation.z = -flap;

      if (isRacing && pt.canDropPoop) {
        pt.dropTimer -= dt;
        if (pt.dropTimer <= 0) {
          pt.dropTimer = pt.dropInterval * (0.85 + Math.random() * 0.35);
          const cx = this.getTrackCenterX(nextZ);
          const halfW = this.getTrackHalfWidthAtZ(nextZ);
          const dropX = THREE.MathUtils.clamp(nextX, cx - halfW + 1.2, cx + halfW - 1.2);
          const poopMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.42, 10, 10),
            new THREE.MeshStandardMaterial({
              color: 0x713f12,
              roughness: 0.4,
            })
          );
          poopMesh.position.set(dropX, nextY - 0.6, nextZ);
          poopMesh.castShadow = true;
          this.courseGroup.add(poopMesh);
          this.fallingPoops.push({
            mesh: poopMesh,
            x: dropX,
            y: nextY - 0.6,
            z: nextZ,
            vy: -4.0,
          });
        }
      }
    }

    // Falling Poop Bombs -> Splat into Slowing Poop Puddles on Track
    for (let i = this.fallingPoops.length - 1; i >= 0; i--) {
      const fp = this.fallingPoops[i];
      fp.vy -= 22.0 * dt;
      fp.y += fp.vy * dt;
      fp.mesh.position.set(fp.x, fp.y, fp.z);
      fp.mesh.rotation.x += dt * 5;

      const floorY = this.getTrackHeightAtZ(fp.z);
      if (fp.y <= floorY + 0.16) {
        this.courseGroup.remove(fp.mesh);
        this.fallingPoops.splice(i, 1);
        this.spawnPoopPuddle(fp.x, floorY, fp.z, 9.0);
        particles.spawnHitBurst(
          new THREE.Vector3(fp.x, floorY + 0.25, fp.z),
          '#713f12',
          6
        );
      }
    }

    // Active Poop Puddles (밟으면 느려짐 + 질척 효과음 + 💩 배지)
    for (let i = this.poopPuddles.length - 1; i >= 0; i--) {
      const puddle = this.poopPuddles[i];
      puddle.lifeLeft -= dt;
      if (puddle.lifeLeft <= 0) {
        this.courseGroup.remove(puddle.group);
        this.poopPuddles.splice(i, 1);
        continue;
      }

      if (puddle.lifeLeft < 1.2) {
        puddle.group.scale.setScalar(Math.max(0.1, puddle.lifeLeft / 1.2));
      }

      if (!isRacing) continue;
      let consumed = false;
      for (const r of racers) {
        if (r.state === 'FINISHED' || r.isSlowed()) continue;
        const rPos = r.getPosition();
        if (
          Math.hypot(rPos.x - puddle.x, rPos.z - puddle.z) < 1.65 &&
          Math.abs(rPos.y - puddle.y) < 1.95
        ) {
          r.applySlowDebuff(2.5, 0.44);
          sound.playPoopSplat();
          particles.spawnHitBurst(rPos, '#854d0e', 10);
          consumed = true;
          break;
        }
      }
      if (consumed) {
        this.courseGroup.remove(puddle.group);
        this.poopPuddles.splice(i, 1);
      }
    }

    // 14. Kart Turbo Boost Strips (⚡ 카트 가속 패드)
    for (const pad of this.turboPads) {
      pad.texture.offset.y -= dt * 2.4;
      if (!isRacing) continue;

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = pad.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.75) continue;

        const rPos = r.getPosition();
        if (Math.abs(rPos.z - pad.z) >= pad.halfL + 0.55) continue;

        const padX = this.getTrackCenterX(rPos.z) + pad.offsetX;
        const padY = this.getTrackHeightAtZ(rPos.z);
        if (
          Math.abs(rPos.x - padX) < pad.halfW + 0.55 &&
          Math.abs(rPos.y - padY) < 1.9
        ) {
          pad.hitCooldowns.set(r.id, this.elapsedTime);
          r.applyTurboBoost(1.65, 13.5);
          sound.playKartBoost();
          particles.spawnHitBurst(rPos, '#facc15', 10);
        }
      }
    }

    // 15. Charging / Running T-Rexes sprinting toward oncoming Karts (-Z)
    for (const trex of this.runningTRexes) {
      trex.curZ -= trex.speedZ * dt;
      if (trex.curZ < trex.zMin) {
        trex.curZ = trex.zMax;
      }

      const wx = this.getTrackCenterX(trex.curZ) + trex.laneOffset;
      const wy = this.getTrackHeightAtZ(trex.curZ);

      const fadeDist = 3.5;
      const fadeRatio = Math.min(
        1,
        Math.max(0, (trex.curZ - trex.zMin) / fadeDist),
        Math.max(0, (trex.zMax - trex.curZ) / fadeDist)
      );
      const curScale = trex.scale * Math.max(0.05, fadeRatio);
      const stridePhase = this.elapsedTime * 11.0 + trex.phase;
      const stompLift = Math.abs(Math.sin(stridePhase)) * 0.22 * trex.scale;

      trex.group.position.set(wx, wy + stompLift, trex.curZ);
      trex.group.scale.setScalar(curScale);
      trex.leftLeg.rotation.x = Math.sin(stridePhase) * 0.6;
      trex.rightLeg.rotation.x = -Math.sin(stridePhase) * 0.6;
      trex.jawPivot.rotation.x = Math.sin(this.elapsedTime * 7.5 + trex.phase) * 0.22;

      trex.body.setNextKinematicTranslation({
        x: wx,
        y: fadeRatio < 0.45 ? wy - 12 : wy + 1.8 * trex.scale,
        z: trex.curZ,
      });

      if (!isRacing || fadeRatio < 0.45) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = trex.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.7) continue;

        const rPos = r.getPosition();
        if (
          Math.abs(rPos.x - wx) < 1.3 * trex.scale + 0.45 &&
          Math.abs(rPos.z - trex.curZ) < 1.7 * trex.scale + 0.5 &&
          Math.abs(rPos.y - (wy + 1.3 * trex.scale)) < 2.2 * trex.scale
        ) {
          trex.hitCooldowns.set(r.id, this.elapsedTime);
          const dirX = rPos.x >= wx ? 1 : -1;
          r.triggerRagdoll(
            { x: dirX * 30 + (Math.random() - 0.5) * 8, y: 17, z: -8 },
            undefined,
            0.95
          );
          particles.spawnHitBurst(rPos, '#16a34a', 14);
          sound.playDinoRoar();
        }
      }
    }

    // 16. Rolling Volcano Boulders hurtling downhill
    for (const b of this.rollingBoulders) {
      b.curZ += b.speedZ * dt;
      if (b.curZ > b.zEnd) {
        b.curZ = b.zStart;
      }
      const bx =
        this.getTrackCenterX(b.curZ) +
        Math.sin(this.elapsedTime * b.laneFreq + b.phase) * b.laneAmp;
      const by = this.getTrackHeightAtZ(b.curZ) + b.radius;
      b.mesh.position.set(bx, by, b.curZ);
      b.mesh.rotation.x += (b.speedZ * dt) / b.radius;
      b.mesh.rotation.z += dt * 1.4;
      b.body.setNextKinematicTranslation({ x: bx, y: by, z: b.curZ });

      if (!isRacing) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = b.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.65) continue;

        const rPos = r.getPosition();
        if (Math.hypot(rPos.x - bx, rPos.y - by, rPos.z - b.curZ) < b.radius + 0.85) {
          b.hitCooldowns.set(r.id, this.elapsedTime);
          const dirX = rPos.x >= bx ? 1 : -1;
          r.triggerRagdoll(
            { x: dirX * 25, y: 21, z: 10 },
            undefined,
            1.2
          );
          particles.spawnHitBurst(rPos, '#f97316', 12);
          sound.playRagdollHit(1.3);
        }
      }
    }

    // 17. Erupting Lava Geysers (용암 간헐천)
    for (const g of this.lavaGeysers) {
      const gx = this.getTrackCenterX(g.z) + g.offsetX;
      const gy = this.getTrackHeightAtZ(g.z);
      const cycle = Math.sin(this.elapsedTime * g.freq + g.phase);
      const isTelegraph = cycle > 0.25 && cycle <= 0.62;
      const isErupting = cycle > 0.62;

      const ringMat = g.ringMesh.material as THREE.MeshBasicMaterial;
      if (isErupting) {
        ringMat.color.setHex(0xef4444);
        g.ringMesh.scale.setScalar(1.22);
        g.plumeMesh.visible = true;
        g.plumeMesh.position.set(gx, gy + 2.6, g.z);
        g.plumeMesh.scale.set(
          1 + Math.sin(this.elapsedTime * 24) * 0.12,
          1,
          1 + Math.cos(this.elapsedTime * 24) * 0.12
        );
      } else if (isTelegraph) {
        ringMat.color.setHex(0xfacc15);
        g.ringMesh.scale.setScalar(1.0 + Math.sin(this.elapsedTime * 20) * 0.15);
        g.plumeMesh.visible = false;
      } else {
        ringMat.color.setHex(0xf97316);
        g.ringMesh.scale.setScalar(0.95);
        g.plumeMesh.visible = false;
      }

      if (!isRacing || !isErupting) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = g.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.85) continue;

        const rPos = r.getPosition();
        if (
          Math.hypot(rPos.x - gx, rPos.z - g.z) < g.radius + 0.5 &&
          Math.abs(rPos.y - gy) < 3.6
        ) {
          g.hitCooldowns.set(r.id, this.elapsedTime);
          r.triggerRagdoll(
            { x: (Math.random() - 0.5) * 18, y: 34, z: -8 },
            undefined,
            1.35
          );
          particles.spawnHitBurst(rPos, '#fb923c', 14);
          sound.playBumperBounce();
        }
      }
    }

    // 18. Scenery Giant Dinosaurs Idle Animations
    for (const anim of this.animatedDinoParts) {
      anim.part.rotation.x =
        anim.baseRotX + Math.sin(this.elapsedTime * anim.freq + anim.phase) * anim.amp;
    }

    // 19. Pool Map: Mid-course Water Balloon / Rubber Duck Penalty Drops
    if (this.poolDropZones.length > 0) {
      this.updatePoolDrops(dt, racers, particles, sound, isRacing);
    }

    // 20. Fall Guys Map: 에어 쿠션 범퍼 · 좌우 풍선 펀치월 · 피스톤 펀치
    if (
      this.fallguysCushions.length > 0 ||
      this.fallguysPunchWalls.length > 0 ||
      this.fallguysPistons.length > 0
    ) {
      this.updateFallguysGimmicks(dt, racers, particles, sound, isRacing);
    }
  }
}
