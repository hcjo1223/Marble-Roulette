import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import type { RagdollRacer } from '../../entities/RagdollRacer';
import type { ParticleSystem } from '../../effects/ParticleSystem';
import type { SoundManager } from '../../audio/SoundManager';
import {
  TRACK_SLOPE,
  envCollisionGroup,
  getTrackCenterX,
  getTrackHalfWidthAtZ,
  getTrackHeightAtZ,
  getTrackYawAtZ,
} from '../courseMath';
import { createConveyorTexture, createCurvedFloorStripGeometry } from '../courseTextures';
import type {
  ConveyorData,
  CourseBuildContext,
  MysteryDoorData,
  PendulumData,
  PinballBumperData,
  PopupBumperData,
  ShockwaveDrumData,
  SlidingShieldData,
  SpringboardData,
  SweeperData,
  WindFanData,
} from '../courseTypes';
import { resetMysteryDoors, updateSharedObstacles } from './sharedObstacleUpdate';

export class SharedObstacleSystem {
  public sweepers: SweeperData[] = [];
  public mysteryDoors: MysteryDoorData[] = [];
  public popupBumpers: PopupBumperData[] = [];
  public pinballBumpers: PinballBumperData[] = [];
  public windFans: WindFanData[] = [];
  public conveyors: ConveyorData[] = [];
  public pendulums: PendulumData[] = [];
  public slidingShields: SlidingShieldData[] = [];
  public springboards: SpringboardData[] = [];
  public shockwaveDrums: ShockwaveDrumData[] = [];

  private ctx: CourseBuildContext;

  constructor(ctx: CourseBuildContext) {
    this.ctx = ctx;
  }

  public createSlidingShield(
    z: number,
    halfW: number,
    halfH: number,
    halfD: number,
    ampX: number,
    freq: number,
    phase: number,
    colorHex: number
  ): void {
    const cx = getTrackCenterX(z);
    const y = getTrackHeightAtZ(z) + halfH + 0.05;
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
    this.ctx.courseGroup.add(group);

    const body = this.ctx.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(initX, y, z)
    );
    this.ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
        .setRestitution(1.0)
        .setCollisionGroups(envCollisionGroup()),
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

  public createSpringboard(
    z: number,
    offsetX: number,
    halfW: number,
    halfL: number,
    boostZ: number,
    boostY: number
  ): void {
    const cx = getTrackCenterX(z);
    const wx = cx + offsetX;
    const wy = getTrackHeightAtZ(z) + 0.08;

    const group = new THREE.Group();
    group.position.set(wx, wy, z);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx2d = canvas.getContext('2d')!;
    ctx2d.fillStyle = '#facc15';
    ctx2d.fillRect(0, 0, 128, 128);
    ctx2d.strokeStyle = '#dc2626';
    ctx2d.lineWidth = 14;
    ctx2d.lineCap = 'round';
    ctx2d.lineJoin = 'round';
    ctx2d.beginPath();
    ctx2d.moveTo(24, 42);
    ctx2d.lineTo(64, 92);
    ctx2d.lineTo(104, 42);
    ctx2d.stroke();
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
    this.ctx.courseGroup.add(group);

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

  public createSweeper(
    z: number,
    lateralOffset: number,
    armLength: number,
    speed: number,
    blades: number = 2,
    barColorHex: number = 0xef4444
  ): void {
    const cx = getTrackCenterX(z);
    const wx = cx + lateralOffset;
    const wz = z;
    const wy = getTrackHeightAtZ(wz) + 0.95;
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

    this.ctx.courseGroup.add(group);

    const body = this.ctx.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, center.y, center.z)
    );
    for (let b = 0; b < blades; b++) {
      const a = (b * Math.PI * 2) / blades;
      const midDist = armLength * 0.5;
      const col = RAPIER.ColliderDesc.cuboid(armLength * 0.5, 0.45, 0.45)
        .setTranslation(Math.cos(a) * midDist, 0, -Math.sin(a) * midDist)
        .setRotation({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) })
        .setRestitution(0.95)
        .setCollisionGroups(envCollisionGroup());
      this.ctx.world.createCollider(col, body);
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

  public addPopupBumpers(
    specs: { z: number; offset: number; phase: number; freq: number }[],
    colorHex: number
  ): void {
    for (const ps of specs) {
      const cx = getTrackCenterX(ps.z);
      const wx = cx + ps.offset;
      const wz = ps.z;
      const wy = getTrackHeightAtZ(wz);
      const basePos = new THREE.Vector3(wx, wy, wz);
      const radius = 1.65;

      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.9, 1.4, 20),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.25 })
      );
      mesh.position.set(basePos.x, basePos.y - 0.5, basePos.z);
      mesh.castShadow = true;
      this.ctx.courseGroup.add(mesh);

      const ringGeo = new THREE.RingGeometry(radius + 0.1, radius + 0.35, 24);
      ringGeo.rotateX(-Math.PI / 2 + TRACK_SLOPE);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
      );
      ring.position.set(basePos.x, basePos.y + 0.08, basePos.z);
      this.ctx.courseGroup.add(ring);

      const body = this.ctx.createBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          basePos.x,
          basePos.y - 0.5,
          basePos.z
        )
      );
      this.ctx.world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.7, radius)
          .setRestitution(1.1)
          .setCollisionGroups(envCollisionGroup()),
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

  public addPinballBumpers(specs: { z: number; offset: number }[], colorHex: number): void {
    for (const pb of specs) {
      const cx = getTrackCenterX(pb.z);
      const wx = cx + pb.offset;
      const wz = pb.z;
      const wy = getTrackHeightAtZ(wz) + 1.1;
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
      this.ctx.courseGroup.add(group);

      const body = this.ctx.createBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z)
      );
      this.ctx.world.createCollider(
        RAPIER.ColliderDesc.cylinder(1.1, radius)
          .setRestitution(1.25)
          .setCollisionGroups(envCollisionGroup()),
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

  public buildBreakingDoorRow(
    z: number,
    doorCount: number,
    rowGroup: number,
    style: 'MYSTERY' | 'PINEWOOD' | 'ROOFTILE' | 'EGG'
  ): void {
    const cx = getTrackCenterX(z);
    const y = getTrackHeightAtZ(z);
    const yaw = getTrackYawAtZ(z);
    const halfW = getTrackHalfWidthAtZ(z, this.ctx.mapTheme);
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
    this.ctx.courseGroup.add(headerMesh);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 192;
    const ctx2d = canvas.getContext('2d')!;

    if (style === 'PINEWOOD') {
      ctx2d.fillStyle = '#fde68a';
      ctx2d.fillRect(0, 0, 128, 192);
      ctx2d.strokeStyle = '#d97706';
      ctx2d.lineWidth = 6;
      ctx2d.strokeRect(6, 6, 116, 180);
      ctx2d.strokeStyle = 'rgba(180, 83, 9, 0.25)';
      ctx2d.lineWidth = 3;
      for (let gx = 20; gx < 120; gx += 22) {
        ctx2d.beginPath();
        ctx2d.moveTo(gx, 8);
        ctx2d.lineTo(gx, 184);
        ctx2d.stroke();
      }
      ctx2d.fillStyle = '#991b1b';
      ctx2d.font = '900 42px "Plus Jakarta Sans", sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText('송판', 64, 74);
      ctx2d.font = '800 28px "Plus Jakarta Sans", sans-serif';
      ctx2d.fillStyle = '#1e293b';
      ctx2d.fillText('격파!', 64, 124);
    } else if (style === 'ROOFTILE') {
      ctx2d.fillStyle = '#334155';
      ctx2d.fillRect(0, 0, 128, 192);
      ctx2d.strokeStyle = '#0f172a';
      ctx2d.lineWidth = 6;
      for (let gy = 28; gy < 180; gy += 28) {
        ctx2d.beginPath();
        ctx2d.moveTo(8, gy);
        ctx2d.lineTo(120, gy);
        ctx2d.stroke();
      }
      ctx2d.fillStyle = '#facc15';
      ctx2d.font = '900 40px "Plus Jakarta Sans", sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText('기와', 64, 76);
      ctx2d.font = '800 26px "Plus Jakarta Sans", sans-serif';
      ctx2d.fillStyle = '#ffffff';
      ctx2d.fillText('擊破', 64, 126);
    } else if (style === 'EGG') {
      ctx2d.fillStyle = '#14532d';
      ctx2d.fillRect(0, 0, 128, 192);
      ctx2d.strokeStyle = '#4ade80';
      ctx2d.lineWidth = 6;
      ctx2d.strokeRect(6, 6, 116, 180);

      ctx2d.fillStyle = '#fef3c7';
      ctx2d.beginPath();
      ctx2d.ellipse(64, 96, 40, 56, 0, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.strokeStyle = '#ca8a04';
      ctx2d.lineWidth = 4;
      ctx2d.stroke();

      ctx2d.fillStyle = '#16a34a';
      for (const [sx, sy, sr] of [
        [48, 72, 8],
        [78, 66, 6],
        [72, 116, 9],
        [46, 110, 6],
      ]) {
        ctx2d.beginPath();
        ctx2d.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx2d.fill();
      }

      ctx2d.fillStyle = '#0f172a';
      ctx2d.font = '900 24px "Plus Jakarta Sans", sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText('공룡알', 64, 96);
    } else {
      ctx2d.fillStyle = '#92400e';
      ctx2d.fillRect(0, 0, 128, 192);
      ctx2d.strokeStyle = '#fde68a';
      ctx2d.lineWidth = 8;
      ctx2d.strokeRect(8, 8, 112, 176);
      ctx2d.fillStyle = '#fef3c7';
      ctx2d.font = '800 84px "Plus Jakarta Sans", sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText('?', 64, 96);
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
      const dy = getTrackHeightAtZ(dz);

      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(dx, dy + 1.65, dz);
      pivotGroup.rotation.y = yaw;

      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(doorW, 3.3, style === 'MYSTERY' ? 0.42 : 0.32),
        new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.45 })
      );
      doorMesh.castShadow = true;
      pivotGroup.add(doorMesh);
      this.ctx.courseGroup.add(pivotGroup);

      if (i < doorCount - 1) {
        const divOffset = -halfW + slotW * (i + 1);
        const px = cx + rightX * divOffset;
        const pz = z + rightZ * divOffset;
        const py = getTrackHeightAtZ(pz);
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 3.8, 0.7),
          new THREE.MeshStandardMaterial({
            color: style === 'MYSTERY' ? 0xb45309 : style === 'EGG' ? 0x15803d : 0x1e293b,
          })
        );
        pillar.position.set(px, py + 1.9, pz);
        pillar.rotation.y = yaw;
        this.ctx.courseGroup.add(pillar);
      }

      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      const body = this.ctx.createBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(dx, dy + 1.65, dz)
          .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      );
      const collider = this.ctx.world.createCollider(
        RAPIER.ColliderDesc.cuboid(doorW * 0.5, 1.65, 0.25)
          .setRestitution(0.75)
          .setCollisionGroups(envCollisionGroup()),
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

  public buildConveyorBeltsAndFans(includeFans: boolean): void {
    const beltSpecs =
      this.ctx.obstacleDensity === 'LIGHT'
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
      const tex = createConveyorTexture(this.ctx.mapTheme, cfg.isBoost);
      tex.repeat.set(1, zLen * 0.45);

      const stripGeo = createCurvedFloorStripGeometry(
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
      this.ctx.courseGroup.add(mesh);

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
      this.ctx.obstacleDensity === 'LIGHT'
        ? [{ zMin: 79, zMax: 86, side: -1, dirX: 1, force: 18 }]
        : [
            { zMin: 75, zMax: 82, side: -1, dirX: 1, force: 34 },
            { zMin: 82.5, zMax: 89.5, side: 1, dirX: -1, force: 35 },
            { zMin: 90, zMax: 97, side: -1, dirX: 1, force: 34 },
          ];

    for (const fc of fanConfigs) {
      const zMid = (fc.zMin + fc.zMax) * 0.5;
      const cx = getTrackCenterX(zMid);
      const yMid = getTrackHeightAtZ(zMid) + 2.3;
      const xHousing = cx + fc.side * 9.8;

      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.3, 1.2, 24),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25 })
      );
      housing.rotation.z = Math.PI / 2;
      housing.position.set(xHousing, yMid, zMid);
      this.ctx.courseGroup.add(housing);

      const bladesGroup = new THREE.Group();
      bladesGroup.position.set(xHousing - fc.side * 0.55, yMid, zMid);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.6, 0.72), bladeMat);
        blade.rotation.x = (b * Math.PI) / 3;
        bladesGroup.add(blade);
      }
      this.ctx.courseGroup.add(bladesGroup);

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
      this.ctx.courseGroup.add(streamParticles);

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

  public addConveyorBelt(
    zMin: number,
    zMax: number,
    sideOffsetMin: number,
    sideOffsetMax: number,
    speedZ: number,
    isBoost: boolean
  ): void {
    const zLen = Math.max(2, zMax - zMin);
    const tex = createConveyorTexture(this.ctx.mapTheme, isBoost);
    tex.repeat.set(1, zLen * 0.45);

    const stripGeo = createCurvedFloorStripGeometry(
      zMin,
      zMax,
      sideOffsetMin,
      sideOffsetMax,
      0.09,
      10
    );
    const stripMat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.ctx.courseGroup.add(new THREE.Mesh(stripGeo, stripMat));

    this.conveyors.push({
      zMin,
      zMax,
      sideOffsetMin,
      sideOffsetMax,
      speedZ,
      texture: tex,
    });
  }

  public addWindFan(zMin: number, zMax: number, side: 1 | -1, force: number): void {
    const dirX = side < 0 ? 1 : -1;
    const zMid = (zMin + zMax) * 0.5;
    const cx = getTrackCenterX(zMid);
    const yMid = getTrackHeightAtZ(zMid) + 2.3;
    const xHousing = cx + side * 9.8;

    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.1, 1.1, 18),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25 })
    );
    housing.rotation.z = Math.PI / 2;
    housing.position.set(xHousing, yMid, zMid);
    this.ctx.courseGroup.add(housing);

    const bladesGroup = new THREE.Group();
    bladesGroup.position.set(xHousing - side * 0.55, yMid, zMid);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.68), bladeMat);
      blade.rotation.x = (b * Math.PI) / 3;
      bladesGroup.add(blade);
    }
    this.ctx.courseGroup.add(bladesGroup);

    const pCount = 32;
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      positions[i * 3] = cx + (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = yMid - 1.1 + Math.random() * 2.2;
      positions[i * 3 + 2] = zMin + Math.random() * (zMax - zMin);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const streamParticles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.36, transparent: true, opacity: 0.85 })
    );
    this.ctx.courseGroup.add(streamParticles);

    this.windFans.push({
      zMin,
      zMax,
      dirX,
      force,
      bladesMesh: bladesGroup,
      streamParticles,
    });
  }

  public addSwingingPendulums(
    configs: { z: number; freq: number; phase: number; maxAngle: number }[],
    isTaekwondoSandbag: boolean
  ): void {
    for (const pc of configs) {
      const cx = getTrackCenterX(pc.z);
      const yaw = getTrackYawAtZ(pc.z);
      const floorY = getTrackHeightAtZ(pc.z);
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
      this.ctx.courseGroup.add(frameGroup);

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

      this.ctx.courseGroup.add(pivotGroup);

      const body = this.ctx.createBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          pivotPos.x,
          pivotPos.y - armLength,
          pivotPos.z
        )
      );
      this.ctx.world.createCollider(
        RAPIER.ColliderDesc.cylinder(1.1, 1.05)
          .setRotation({ x: 0.7071, y: 0, z: 0, w: 0.7071 })
          .setRestitution(1.1)
          .setCollisionGroups(envCollisionGroup()),
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

  public reset(): void {
    resetMysteryDoors(this.mysteryDoors);
  }

  public update(
    dt: number,
    elapsedTime: number,
    racers: RagdollRacer[],
    particles: ParticleSystem,
    sound: SoundManager
  ): void {
    updateSharedObstacles(this, dt, elapsedTime, racers, particles, sound);
  }
}
