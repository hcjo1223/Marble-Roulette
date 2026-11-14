import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GROUP_ENV, GROUP_LIMB, GROUP_TORSO, makeCollisionGroups, RagdollRacer } from '../entities/RagdollRacer';
import { ParticleSystem } from '../effects/ParticleSystem';
import { SoundManager } from '../audio/SoundManager';

export const TRACK_LENGTH = 144;
export const FINISH_Z = 130;
export const TRACK_SLOPE = 0.105; // Downward slope radians

interface SweeperData {
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  center: THREE.Vector3;
  armLength: number;
  speed: number;
  angle: number;
  hitCooldowns: Map<string, number>;
}

interface PopupBumperData {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
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
  dirX: number; // +1 blows right, -1 blows left
  force: number;
  bladesMesh: THREE.Group;
  streamParticles: THREE.Points;
}

interface ConveyorData {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  speedZ: number;
  texture: THREE.CanvasTexture;
}

interface PendulumData {
  body: RAPIER.RigidBody;
  pivotGroup: THREE.Group;
  pivotPos: THREE.Vector3;
  armLength: number;
  freq: number;
  phase: number;
  maxAngle: number;
  hitCooldowns: Map<string, number>;
}

export class ObstacleCourse {
  private world: RAPIER.World;
  private scene: THREE.Scene;
  private courseGroup: THREE.Group;

  private startGateBody!: RAPIER.RigidBody;
  private startGateMesh!: THREE.Mesh;
  private gateOpen: boolean = false;
  private gateOpenProgress: number = 0;

  private sweepers: SweeperData[] = [];
  private popupBumpers: PopupBumperData[] = [];
  private pinballBumpers: PinballBumperData[] = [];
  private windFans: WindFanData[] = [];
  private conveyors: ConveyorData[] = [];
  private pendulums: PendulumData[] = [];

  private elapsedTime: number = 0;

  constructor(world: RAPIER.World, scene: THREE.Scene) {
    this.world = world;
    this.scene = scene;
    this.courseGroup = new THREE.Group();
    this.scene.add(this.courseGroup);

    this.buildTrackBase();
    this.buildStartGate();
    this.buildZone1Sweepers();
    this.buildZone2Bumpers();
    this.buildZone3WindAndConveyors();
    this.buildZone4BottleneckAndPendulums();
    this.buildZone5FinalChaosAndFinish();
  }

  public getTrackHeightAtZ(z: number): number {
    return -Math.tan(TRACK_SLOPE) * z;
  }

  public getTrackHalfWidthAtZ(z: number): number {
    // Zone 4 Bottleneck narrows between Z=90 and Z=116
    if (z >= 88 && z < 96) {
      const t = (z - 88) / 8;
      return 9.0 * (1 - t) + 4.3 * t;
    }
    if (z >= 96 && z <= 114) {
      return 4.3;
    }
    if (z > 114 && z <= 120) {
      const t = (z - 114) / 6;
      return 4.3 * (1 - t) + 9.0 * t;
    }
    return 9.0;
  }

  private envCollisionGroup(): number {
    return makeCollisionGroups(GROUP_ENV, GROUP_TORSO | GROUP_LIMB | GROUP_ENV);
  }

  private createCheckeredTexture(
    c1: string,
    c2: string,
    repeatX: number,
    repeatY: number
  ): THREE.CanvasTexture {
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
    tex.repeat.set(repeatX, repeatY);
    return tex;
  }

  private buildTrackBase(): void {
    const envGroup = this.envCollisionGroup();

    // Main sloped track segments
    // Segment A: Z = -4 to 88 (Width 18m)
    this.addTrackDeckSection(-4, 88, 18.0, '#1e293b', '#334155', envGroup, true);

    // Segment B: Funnel & Narrow Bridge Z = 88 to 118 (Width 8.8m)
    this.addTrackDeckSection(88, 118, 9.0, '#0f172a', '#1e293b', envGroup, false);

    // Segment C: Final Sprint & Finish Deck Z = 118 to 146 (Width 18m)
    this.addTrackDeckSection(118, 146, 18.0, '#1e293b', '#334155', envGroup, true);

    // Funnel guide walls at Z = 86..96 converging from X = ±9.0 to X = ±4.4
    this.addAngledFunnelWall(-9.0, 86, -4.4, 96, envGroup);
    this.addAngledFunnelWall(9.0, 86, 4.4, 96, envGroup);

    // Low side rails along the narrow bridge so some get knocked over while others bounce
    this.addAngledFunnelWall(-4.4, 96, -4.4, 114, envGroup, 0.75);
    this.addAngledFunnelWall(4.4, 96, 4.4, 114, envGroup, 0.75);

    // Diverging walls at Z = 114..120
    this.addAngledFunnelWall(-4.4, 114, -9.0, 120, envGroup);
    this.addAngledFunnelWall(4.4, 114, 9.0, 120, envGroup);

    // Zone Banner Signs along the track
    this.addZoneArchSign(12, 'ZONE 1 · SPINNING SWEEPERS', '#f59e0b');
    this.addZoneArchSign(38, 'ZONE 2 · POP-UP BUMPERS', '#10b981');
    this.addZoneArchSign(64, 'ZONE 3 · WIND FANS & CONVEYORS', '#06b6d4');
    this.addZoneArchSign(90, 'ZONE 4 · BOTTLENECK GAUNTLET', '#f43f5e');
  }

  private addTrackDeckSection(
    zStart: number,
    zEnd: number,
    width: number,
    color1: string,
    color2: string,
    collisionGroup: number,
    withSideWalls: boolean
  ): void {
    const zLen = zEnd - zStart;
    const zMid = (zStart + zEnd) * 0.5;
    const yMid = this.getTrackHeightAtZ(zMid);
    const slopeLength = zLen / Math.cos(TRACK_SLOPE);

    const rotQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(TRACK_SLOPE, 0, 0)
    );

    const floorTex = this.createCheckeredTexture(color1, color2, width * 0.5, zLen * 0.5);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.55,
      metalness: 0.1,
    });

    const floorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1.2, slopeLength),
      floorMat
    );
    floorMesh.position.set(0, yMid - 0.6, zMid);
    floorMesh.quaternion.copy(rotQuat);
    floorMesh.receiveShadow = true;
    this.courseGroup.add(floorMesh);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, yMid - 0.6, zMid)
      .setRotation({ x: rotQuat.x, y: rotQuat.y, z: rotQuat.z, w: rotQuat.w });
    const floorBody = this.world.createRigidBody(bodyDesc);
    const floorCol = RAPIER.ColliderDesc.cuboid(width * 0.5, 0.6, slopeLength * 0.5)
      .setFriction(0.15)
      .setRestitution(0.2)
      .setCollisionGroups(collisionGroup);
    this.world.createCollider(floorCol, floorBody);

    if (withSideWalls) {
      const wallHeight = 2.2;
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.4,
        metalness: 0.3,
      });
      const trimMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
      });

      for (const side of [-1, 1]) {
        const xPos = side * (width * 0.5 + 0.35);
        const wallMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, wallHeight, slopeLength),
          wallMat
        );
        wallMesh.position.set(xPos, yMid + wallHeight * 0.5, zMid);
        wallMesh.quaternion.copy(rotQuat);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        this.courseGroup.add(wallMesh);

        const trimMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.74, 0.18, slopeLength),
          trimMat
        );
        trimMesh.position.set(xPos, yMid + wallHeight, zMid);
        trimMesh.quaternion.copy(rotQuat);
        this.courseGroup.add(trimMesh);

        const wallCol = RAPIER.ColliderDesc.cuboid(0.35, wallHeight * 0.5, slopeLength * 0.5)
          .setTranslation(xPos, wallHeight * 0.5 + 0.6, 0)
          .setFriction(0.05)
          .setRestitution(0.45)
          .setCollisionGroups(collisionGroup);
        this.world.createCollider(wallCol, floorBody);
      }
    }

    // Back wall behind start line
    if (zStart < 0) {
      const backY = this.getTrackHeightAtZ(-3.5);
      const backBody = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, backY + 2, -3.5)
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(width * 0.5, 2.5, 0.5).setCollisionGroups(collisionGroup),
        backBody
      );
    }
  }

  private addAngledFunnelWall(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    collisionGroup: number,
    wallHeight: number = 2.4
  ): void {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenXZ = Math.hypot(dx, dz);
    const midX = (x1 + x2) * 0.5;
    const midZ = (z1 + z2) * 0.5;
    const midY = this.getTrackHeightAtZ(midZ);

    const yaw = Math.atan2(dx, dz);
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(TRACK_SLOPE, yaw, 0, 'YXZ')
    );

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.35,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, wallHeight, lenXZ), mat);
    mesh.position.set(midX, midY + wallHeight * 0.5, midZ);
    mesh.quaternion.copy(quat);
    mesh.castShadow = true;
    this.courseGroup.add(mesh);

    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(midX, midY + wallHeight * 0.5, midZ)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.35, wallHeight * 0.5, lenXZ * 0.5)
        .setFriction(0.05)
        .setRestitution(0.55)
        .setCollisionGroups(collisionGroup),
      body
    );
  }

  private addZoneArchSign(z: number, title: string, accentHex: string): void {
    const y = this.getTrackHeightAtZ(z);
    const halfW = this.getTrackHalfWidthAtZ(z);

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.4,
    });

    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 7.2, 12), pillarMat);
      pillar.position.set(side * (halfW + 0.1), y + 3.6, z);
      this.courseGroup.add(pillar);
    }

    // Banner canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 72);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 506, 66);

    ctx.fillStyle = accentHex;
    ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, 37);

    const tex = new THREE.CanvasTexture(canvas);
    const bannerMat = new THREE.MeshBasicMaterial({ map: tex });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.6, 1.3, 0.35), bannerMat);
    banner.position.set(0, y + 6.8, z);
    this.courseGroup.add(banner);
  }

  private buildStartGate(): void {
    const z = 9.5;
    const y = this.getTrackHeightAtZ(z);
    const gateTex = this.createCheckeredTexture('#f59e0b', '#0f172a', 12, 2);

    this.startGateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(17.8, 2.6, 0.5),
      new THREE.MeshStandardMaterial({ map: gateTex, roughness: 0.3 })
    );
    this.startGateMesh.position.set(0, y + 1.3, z);
    this.startGateMesh.castShadow = true;
    this.courseGroup.add(this.startGateMesh);

    this.startGateBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, y + 1.3, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(8.9, 1.3, 0.25).setCollisionGroups(this.envCollisionGroup()),
      this.startGateBody
    );
  }

  public openStartGate(): void {
    this.gateOpen = true;
  }

  private buildZone1Sweepers(): void {
    // Zone 1: Rotating Sweeper Hammers at Z = 18, 26, 33
    const configs = [
      { x: -3.2, z: 18, len: 5.2, speed: 3.4 },
      { x: 3.2, z: 24.5, len: 5.2, speed: -3.7 },
      { x: 0, z: 32, len: 6.8, speed: 4.1 },
    ];

    for (const cfg of configs) {
      this.createSweeper(cfg.x, cfg.z, cfg.len, cfg.speed);
    }
  }

  private createSweeper(
    x: number,
    z: number,
    armLength: number,
    speed: number
  ): void {
    const y = this.getTrackHeightAtZ(z) + 0.95;
    const center = new THREE.Vector3(x, y, z);

    const group = new THREE.Group();
    group.position.copy(center);

    // Center hub
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.85, 1.8, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.3 })
    );
    hub.castShadow = true;
    group.add(hub);

    // Sweeper bar
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.25,
      roughness: 0.3,
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(armLength * 2, 0.58, 0.58), barMat);
    bar.castShadow = true;
    group.add(bar);

    // Hammer heads at both ends of the sweeper bar
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.25,
      metalness: 0.2,
    });
    for (const side of [-1, 1]) {
      const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.4), headMat);
      hammerHead.position.set(side * (armLength - 0.3), 0, 0);
      hammerHead.castShadow = true;
      group.add(hammerHead);
    }

    this.courseGroup.add(group);

    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, center.y, center.z)
    );
    const col = RAPIER.ColliderDesc.cuboid(armLength, 0.45, 0.45)
      .setRestitution(0.95)
      .setFriction(0.05)
      .setCollisionGroups(this.envCollisionGroup());
    this.world.createCollider(col, body);

    this.sweepers.push({
      body,
      mesh: group,
      center,
      armLength,
      speed,
      angle: Math.random() * Math.PI * 2,
      hitCooldowns: new Map(),
    });
  }

  private buildZone2Bumpers(): void {
    // 1. Floor Pop-up Spring Bumpers (pistons that launch characters skyward!)
    const popupCoords = [
      { x: -4.2, z: 42, phase: 0, freq: 3.4 },
      { x: 0.0, z: 44, phase: 1.5, freq: 3.8 },
      { x: 4.2, z: 42, phase: 3.0, freq: 3.4 },
      { x: -2.6, z: 51, phase: 0.8, freq: 4.1 },
      { x: 2.6, z: 51, phase: 2.4, freq: 4.1 },
      { x: 0.0, z: 58, phase: 1.1, freq: 4.5 },
    ];

    for (const pc of popupCoords) {
      const basePos = new THREE.Vector3(pc.x, this.getTrackHeightAtZ(pc.z), pc.z);
      const radius = 1.65;

      const mat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.4,
        roughness: 0.25,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, 1.4, 20), mat);
      mesh.position.set(basePos.x, basePos.y - 0.5, basePos.z);
      mesh.castShadow = true;
      this.courseGroup.add(mesh);

      const ringGeo = new THREE.RingGeometry(radius + 0.1, radius + 0.35, 24);
      ringGeo.rotateX(-Math.PI / 2 + TRACK_SLOPE);
      const ringMesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide })
      );
      ringMesh.position.set(basePos.x, basePos.y + 0.08, basePos.z);
      this.courseGroup.add(ringMesh);

      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          basePos.x,
          basePos.y - 0.5,
          basePos.z
        )
      );
      const col = RAPIER.ColliderDesc.cylinder(0.7, radius)
        .setRestitution(1.1)
        .setCollisionGroups(this.envCollisionGroup());
      this.world.createCollider(col, body);

      this.popupBumpers.push({
        body,
        mesh,
        ringMesh,
        basePos,
        phase: pc.phase,
        freq: pc.freq,
        radius,
        hitCooldowns: new Map(),
      });
    }

    // 2. Pinball Bouncer Pillars
    const pinballCoords = [
      { x: -5.5, z: 47 },
      { x: 0, z: 47.5 },
      { x: 5.5, z: 47 },
      { x: -4.8, z: 55 },
      { x: 4.8, z: 55 },
      { x: -2.8, z: 60.5 },
      { x: 2.8, z: 60.5 },
    ];

    for (const pb of pinballCoords) {
      const y = this.getTrackHeightAtZ(pb.z) + 1.1;
      const pos = new THREE.Vector3(pb.x, y, pb.z);
      const radius = 1.15;

      const group = new THREE.Group();
      group.position.copy(pos);

      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.85, 2.2, 20),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.25 })
      );
      core.castShadow = true;
      group.add(core);

      const neonRing = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 0.14, radius + 0.14, 0.45, 20),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfacc15,
          emissiveIntensity: 0.7,
        })
      );
      group.add(neonRing);
      this.courseGroup.add(group);

      const body = this.world.createRigidBody(
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

  private buildZone3WindAndConveyors(): void {
    // 1. Conveyor Belts (Green fast-forward belts & Red reverse trap belts)
    const beltConfigs = [
      { xMin: -7.8, xMax: -2.8, zMin: 66, zMax: 78, speedZ: 13.5, isBoost: true },
      { xMin: -2.4, xMax: 2.4, zMin: 66, zMax: 78, speedZ: -9.5, isBoost: false },
      { xMin: 2.8, xMax: 7.8, zMin: 66, zMax: 78, speedZ: 13.5, isBoost: true },
      { xMin: -6.5, xMax: 0.0, zMin: 79, zMax: 88, speedZ: -8.5, isBoost: false },
      { xMin: 0.0, xMax: 6.5, zMin: 79, zMax: 88, speedZ: 14.5, isBoost: true },
    ];

    for (const cfg of beltConfigs) {
      const width = cfg.xMax - cfg.xMin;
      const zLen = cfg.zMax - cfg.zMin;
      const xMid = (cfg.xMin + cfg.xMax) * 0.5;
      const zMid = (cfg.zMin + cfg.zMax) * 0.5;
      const yMid = this.getTrackHeightAtZ(zMid) + 0.06;

      const tex = this.createConveyorTexture(cfg.isBoost);
      tex.repeat.set(1, zLen * 0.45);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, zLen / Math.cos(TRACK_SLOPE)),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      mesh.position.set(xMid, yMid, zMid);
      mesh.rotation.x = -Math.PI / 2 + TRACK_SLOPE;
      this.courseGroup.add(mesh);

      this.conveyors.push({
        xMin: cfg.xMin,
        xMax: cfg.xMax,
        zMin: cfg.zMin,
        zMax: cfg.zMax,
        speedZ: cfg.speedZ,
        texture: tex,
      });
    }

    // 2. Giant Side Wind Fans blowing crosswinds across Zone 3
    const fanConfigs = [
      { zMin: 67, zMax: 74, side: -1, dirX: 1, force: 34 },
      { zMin: 74.5, zMax: 81.5, side: 1, dirX: -1, force: 36 },
      { zMin: 82, zMax: 88, side: -1, dirX: 1, force: 34 },
    ];

    for (const fc of fanConfigs) {
      const zMid = (fc.zMin + fc.zMax) * 0.5;
      const yMid = this.getTrackHeightAtZ(zMid) + 2.2;
      const xHousing = fc.side * 9.8;

      // Industrial Fan Housing
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.3, 1.4, 24),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.3, metalness: 0.4 })
      );
      housing.rotation.z = Math.PI / 2;
      housing.position.set(xHousing, yMid, zMid);
      this.courseGroup.add(housing);

      // Rotating fan blades group
      const bladesGroup = new THREE.Group();
      bladesGroup.position.set(xHousing - fc.side * 0.5, yMid, zMid);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        metalness: 0.5,
        roughness: 0.2,
      });
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.8, 0.65), bladeMat);
        blade.rotation.x = (b * Math.PI) / 4;
        bladesGroup.add(blade);
      }
      this.courseGroup.add(bladesGroup);

      // Wind stream particle lines
      const pCount = 45;
      const positions = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 16;
        positions[i * 3 + 1] = yMid - 1.2 + Math.random() * 2.4;
        positions[i * 3 + 2] = fc.zMin + Math.random() * (fc.zMax - fc.zMin);
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const pMat = new THREE.PointsMaterial({
        color: 0x7dd3fc,
        size: 0.32,
        transparent: true,
        opacity: 0.75,
      });
      const streamParticles = new THREE.Points(pGeo, pMat);
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

    ctx.fillStyle = isBoost ? '#064e3b' : '#7f1d1d';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = isBoost ? '#34d399' : '#f87171';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (isBoost) {
      // Forward chevron (+Z is down in UV or up depending on orientation)
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

  private buildZone4BottleneckAndPendulums(): void {
    // 3 Giant Overhead Swinging Pendulum Hammers across the narrow bottleneck bridge (Z = 97, 104, 111)
    const pConfigs = [
      { z: 97, freq: 2.35, phase: 0, maxAngle: 0.95 },
      { z: 104, freq: 2.55, phase: Math.PI, maxAngle: 0.95 },
      { z: 111, freq: 2.75, phase: Math.PI * 0.5, maxAngle: 0.95 },
    ];

    for (const pc of pConfigs) {
      const floorY = this.getTrackHeightAtZ(pc.z);
      const armLength = 6.2;
      const pivotPos = new THREE.Vector3(0, floorY + armLength + 1.05, pc.z);

      // Support arch frame
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4 });
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 7.6, 12), frameMat);
        leg.position.set(side * 4.5, floorY + 3.8, pc.z);
        this.courseGroup.add(leg);
      }
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.45, 0.45), frameMat);
      crossbar.position.copy(pivotPos);
      this.courseGroup.add(crossbar);

      // Swinging pendulum group
      const pivotGroup = new THREE.Group();
      pivotGroup.position.copy(pivotPos);

      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, armLength, 10),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 })
      );
      rod.position.set(0, -armLength * 0.5, 0);
      pivotGroup.add(rod);

      const hammerMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 2.4, 20),
        new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          emissive: 0xbe123c,
          emissiveIntensity: 0.35,
          roughness: 0.25,
        })
      );
      hammerMesh.rotation.x = Math.PI / 2;
      hammerMesh.position.set(0, -armLength, 0);
      hammerMesh.castShadow = true;
      pivotGroup.add(hammerMesh);

      this.courseGroup.add(pivotGroup);

      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          pivotPos.x,
          pivotPos.y - armLength,
          pivotPos.z
        )
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(1.2, 1.1)
          .setRotation({ x: 0.7071, y: 0, z: 0, w: 0.7071 })
          .setRestitution(1.1)
          .setCollisionGroups(this.envCollisionGroup()),
        body
      );

      this.pendulums.push({
        body,
        pivotGroup,
        pivotPos,
        armLength,
        freq: pc.freq,
        phase: pc.phase,
        maxAngle: pc.maxAngle,
        hitCooldowns: new Map(),
      });
    }
  }

  private buildZone5FinalChaosAndFinish(): void {
    // Final Dual Sweepers right before the finish line at Z = 122
    this.createSweeper(-3.6, 122, 4.4, 4.2);
    this.createSweeper(3.6, 122, 4.4, -4.2);

    // Checkered Finish Line Deck & Arch at FINISH_Z (130)
    const finishY = this.getTrackHeightAtZ(FINISH_Z);
    const checkTex = this.createCheckeredTexture('#ffffff', '#0f172a', 12, 2);

    const finishStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 3.2),
      new THREE.MeshBasicMaterial({ map: checkTex, side: THREE.DoubleSide })
    );
    finishStrip.position.set(0, finishY + 0.08, FINISH_Z);
    finishStrip.rotation.x = -Math.PI / 2 + TRACK_SLOPE;
    this.courseGroup.add(finishStrip);

    // Grand Finish Arch
    const archMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.35,
      roughness: 0.25,
    });
    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.5, 0.9), archMat);
      col.position.set(side * 8.6, finishY + 4.2, FINISH_Z);
      col.castShadow = true;
      this.courseGroup.add(col);
    }

    const topBanner = new THREE.Mesh(
      new THREE.BoxGeometry(18.4, 1.8, 1.1),
      new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.3 })
    );
    topBanner.position.set(0, finishY + 8.2, FINISH_Z);
    this.courseGroup.add(topBanner);
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
      const z = 9.5;
      const baseY = this.getTrackHeightAtZ(z) + 1.3;
      const curY = baseY - this.gateOpenProgress * 4.2;
      this.startGateMesh.position.y = curY;
      this.startGateBody.setNextKinematicTranslation({ x: 0, y: curY, z });
    }

    // 2. Update Rotating Sweepers & Check Knockback Hits
    for (const sw of this.sweepers) {
      sw.angle += sw.speed * dt;
      const quat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        sw.angle
      );
      sw.mesh.quaternion.copy(quat);
      sw.body.setNextKinematicRotation({
        x: quat.x,
        y: quat.y,
        z: quat.z,
        w: quat.w,
      });

      const cosA = Math.cos(sw.angle);
      const sinA = Math.sin(sw.angle);

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = sw.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.55) continue;

        const rPos = r.getPosition();
        const dx = rPos.x - sw.center.x;
        const dz = rPos.z - sw.center.z;
        const dy = Math.abs(rPos.y - sw.center.y);
        if (dy > 1.75) continue;

        // Project racer position onto rotating sweeper bar axis
        const alongBar = dx * cosA - dz * sinA;
        const perpBar = dx * sinA + dz * cosA;

        if (Math.abs(alongBar) <= sw.armLength + 0.55 && Math.abs(perpBar) <= 0.88) {
          sw.hitCooldowns.set(r.id, this.elapsedTime);
          const sign = alongBar >= 0 ? 1 : -1;
          const tangentDirX = -sinA * sign * Math.sign(sw.speed);
          const tangentDirZ = cosA * sign * Math.sign(sw.speed);

          r.triggerRagdoll(
            {
              x: tangentDirX * 36 + (Math.random() - 0.5) * 8,
              y: 26 + Math.random() * 10,
              z: tangentDirZ * 26 - 6,
            },
            {
              x: (Math.random() - 0.5) * 22,
              y: Math.sign(sw.speed) * 18,
              z: (Math.random() - 0.5) * 22,
            },
            1.35
          );
          particles.spawnHitBurst(rPos, '#f59e0b', 10);
          sound.playRagdollHit(1.2);
        }
      }
    }

    // 3. Update Pop-up Floor Bumpers
    for (const pb of this.popupBumpers) {
      const wave = Math.sin(this.elapsedTime * pb.freq + pb.phase);
      // Sharp pop-up profile when wave > 0.55
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
          const distXZ = Math.hypot(rPos.x - pb.basePos.x, rPos.z - pb.basePos.z);
          if (distXZ < pb.radius + 0.55 && Math.abs(rPos.y - pb.basePos.y) < 2.2) {
            pb.hitCooldowns.set(r.id, this.elapsedTime);
            r.triggerRagdoll(
              {
                x: (rPos.x - pb.basePos.x) * 18 + (Math.random() - 0.5) * 10,
                y: 42 + Math.random() * 12,
                z: -8 + Math.random() * 14,
              },
              {
                x: -18 + Math.random() * 36,
                y: (Math.random() - 0.5) * 15,
                z: -18 + Math.random() * 36,
              },
              1.4
            );
            particles.spawnHitBurst(rPos, '#10b981', 12);
            sound.playBumperBounce();
          }
        }
      }
    }

    // 4. Update Pinball Bumpers
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
          const nx = dx / (dist || 1);
          const nz = dz / (dist || 1);

          r.triggerRagdoll(
            {
              x: nx * 36,
              y: 18,
              z: nz * 32,
            },
            undefined,
            1.05
          );
          particles.spawnHitBurst(rPos, '#f43f5e', 8);
          sound.playBumperBounce();
        }
      }
    }

    // 5. Update Conveyor Belts & Wind Fans
    for (const conv of this.conveyors) {
      conv.texture.offset.y -= conv.speedZ * dt * 0.12;

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const rPos = r.getPosition();
        if (
          rPos.x >= conv.xMin &&
          rPos.x <= conv.xMax &&
          rPos.z >= conv.zMin &&
          rPos.z <= conv.zMax &&
          rPos.y - this.getTrackHeightAtZ(rPos.z) < 2.2
        ) {
          r.torsoBody.applyImpulse({ x: 0, y: 0, z: conv.speedZ * 3.4 * dt }, true);
        }
      }
    }

    for (const fan of this.windFans) {
      fan.bladesMesh.rotation.x += dt * 16 * fan.dirX;

      // Animate wind particles
      const posAttr = fan.streamParticles.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let px = posAttr.getX(i) + fan.dirX * 18 * dt;
        if (fan.dirX > 0 && px > 8.5) px = -8.5;
        if (fan.dirX < 0 && px < -8.5) px = 8.5;
        posAttr.setX(i, px);
      }
      posAttr.needsUpdate = true;

      // Apply wind force to racers inside fan corridor
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const rPos = r.getPosition();
        if (rPos.z >= fan.zMin && rPos.z <= fan.zMax) {
          r.torsoBody.applyImpulse(
            {
              x: fan.dirX * fan.force * dt,
              y: 1.5 * dt,
              z: -2.0 * dt,
            },
            true
          );
        }
      }
    }

    // 6. Update Swinging Pendulums in Zone 4
    for (const pend of this.pendulums) {
      const swingAngle =
        Math.sin(this.elapsedTime * pend.freq + pend.phase) * pend.maxAngle;
      const angularVel =
        Math.cos(this.elapsedTime * pend.freq + pend.phase) *
        pend.freq *
        pend.maxAngle;

      pend.pivotGroup.rotation.z = swingAngle;

      const hammerX = pend.pivotPos.x + Math.sin(swingAngle) * pend.armLength;
      const hammerY = pend.pivotPos.y - Math.cos(swingAngle) * pend.armLength;
      const hammerZ = pend.pivotPos.z;

      pend.body.setNextKinematicTranslation({ x: hammerX, y: hammerY, z: hammerZ });

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = pend.hitCooldowns.get(r.id) || 0;
        if (this.elapsedTime - lastHit < 0.6) continue;

        const rPos = r.getPosition();
        const dist = Math.hypot(
          rPos.x - hammerX,
          rPos.y - hammerY,
          rPos.z - hammerZ
        );
        if (dist < 2.05) {
          pend.hitCooldowns.set(r.id, this.elapsedTime);
          const dirX = Math.sign(angularVel) || (Math.random() > 0.5 ? 1 : -1);
          r.triggerRagdoll(
            {
              x: dirX * 42,
              y: 28,
              z: -12 + Math.random() * 16,
            },
            {
              x: (Math.random() - 0.5) * 20,
              y: dirX * 20,
              z: -dirX * 25,
            },
            1.45
          );
          particles.spawnHitBurst(rPos, '#f43f5e', 14);
          sound.playRagdollHit(1.5);
        }
      }
    }
  }

  public resetGate(): void {
    this.gateOpen = false;
    this.gateOpenProgress = 0;
    const z = 9.5;
    const baseY = this.getTrackHeightAtZ(z) + 1.3;
    this.startGateMesh.position.y = baseY;
    this.startGateBody.setNextKinematicTranslation({ x: 0, y: baseY, z });
  }
}
