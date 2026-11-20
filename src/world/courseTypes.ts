import type * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d';
import type { MapTheme, ObstacleDensity } from '../types';
import type { RagdollRacer } from '../entities/RagdollRacer';

export interface SweeperData {
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  center: THREE.Vector3;
  armLength: number;
  speed: number;
  angle: number;
  blades: number;
  hitCooldowns: Map<string, number>;
}

export interface MysteryDoorData {
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

export interface PopupBumperData {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  phase: number;
  freq: number;
  radius: number;
  hitCooldowns: Map<string, number>;
}

export interface PinballBumperData {
  pos: THREE.Vector3;
  mesh: THREE.Group;
  radius: number;
  pulseScale: number;
  hitCooldowns: Map<string, number>;
}

export interface WindFanData {
  zMin: number;
  zMax: number;
  dirX: number;
  force: number;
  bladesMesh: THREE.Group;
  streamParticles: THREE.Points;
}

export interface ConveyorData {
  zMin: number;
  zMax: number;
  sideOffsetMin: number;
  sideOffsetMax: number;
  speedZ: number;
  texture: THREE.CanvasTexture;
}

export interface PendulumData {
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

export interface SlidingShieldData {
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

export interface SpringboardData {
  z: number;
  offsetX: number;
  halfW: number;
  halfL: number;
  boostZ: number;
  boostY: number;
  mesh: THREE.Group;
  hitCooldowns: Map<string, number>;
}

export interface ShockwaveDrumData {
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

export type GiantTrapKind =
  | 'BASHER'
  | 'FINGER'
  | 'DINO_CHARGE'
  | 'POOL_SPLASH'
  | 'FALLGUYS_PUNCH';

export interface GiantFlickHandData {
  slotIndex: number;
  trapKind: GiantTrapKind;
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
  dinoBodyPivot?: THREE.Group;
  dinoLeftLeg?: THREE.Mesh;
  dinoRightLeg?: THREE.Mesh;
  dinoHeadPivot?: THREE.Group;
  bucketPivot?: THREE.Group;
  splashJetGroup?: THREE.Group;
  springGroup?: THREE.Group;
  gloveGroup?: THREE.Group;
}

export interface FlyingPterosaurData {
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

export interface AnimatedDinoPart {
  part: THREE.Object3D;
  baseRotX: number;
  amp: number;
  freq: number;
  phase: number;
}

export interface RunningTRexData {
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

export interface FallingPoopData {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vy: number;
}

export interface PoopPuddleData {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  lifeLeft: number;
  maxLife: number;
}

export interface TurboPadData {
  z: number;
  offsetX: number;
  halfW: number;
  halfL: number;
  texture: THREE.CanvasTexture;
  hitCooldowns: Map<string, number>;
}

export interface RollingBoulderData {
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

export interface LavaGeyserData {
  z: number;
  offsetX: number;
  radius: number;
  plumeMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  freq: number;
  phase: number;
  hitCooldowns: Map<string, number>;
}

export interface PoolDropZoneData {
  z: number;
  halfZ: number;
  timer: number;
  interval: number;
  ringMesh: THREE.Mesh;
  warnLights: THREE.Mesh[];
}

export interface PoolDropData {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vy: number;
  radius: number;
  kind: 'BALLOON' | 'DUCK';
  marker: THREE.Mesh;
}

export interface PoolSplashRingData {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export interface PoolRideTubePadData {
  z: number;
  offsetX: number;
  pos: THREE.Vector3;
  colorHex: number;
  mesh: THREE.Group;
  ringMesh: THREE.Mesh;
  respawnTimer: number;
}

export interface PoolWaterJetData {
  z: number;
  side: number;
  dirX: number;
  sprayMesh: THREE.Mesh;
  phase: number;
  hitCooldowns: Map<string, number>;
}

export interface WaveCurrentZoneData {
  zMin: number;
  zMax: number;
  dirX: number;
  pushForce: number;
  freq: number;
  phase: number;
  texture: THREE.CanvasTexture;
  waveWallMesh: THREE.Group;
  hitCooldowns: Map<string, number>;
}

export interface FallguysCushionData {
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  pos: THREE.Vector3;
  radius: number;
  squash: number;
  hitCooldowns: Map<string, number>;
}

export interface FallguysPunchWallData {
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

export interface FallguysPistonData {
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

export interface OverheadBannerData {
  mat: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  z: number;
}

export interface CourseBuildContext {
  world: RAPIER.World;
  courseGroup: THREE.Group;
  mapTheme: MapTheme;
  obstacleDensity: ObstacleDensity;
  finishZ: number;
  trackLength: number;
  createBody: (desc: RAPIER.RigidBodyDesc) => RAPIER.RigidBody;
  overheadBanners: OverheadBannerData[];
}
