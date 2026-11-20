import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import type { RagdollRacer } from '../../entities/RagdollRacer';
import type { ParticleSystem } from '../../effects/ParticleSystem';
import type { SoundManager } from '../../audio/SoundManager';
import {
  envCollisionGroup,
  getTrackCenterX,
  getTrackHeightAtZ,
  getTrackYawAtZ,
} from '../courseMath';
import { createCurvedFloorStripGeometry, createSlimeTexture } from '../courseTextures';
import type {
  CourseBuildContext,
  FallguysCushionData,
  FallguysPistonData,
  FallguysPunchWallData,
} from '../courseTypes';
import type { SharedObstacleSystem } from '../obstacles/SharedObstacleSystem';

export class FallguysCourseSystem {
  private ctx: CourseBuildContext;
  private shared: SharedObstacleSystem;

  private fallguysCushions: FallguysCushionData[] = [];
  private fallguysPunchWalls: FallguysPunchWallData[] = [];
  private fallguysPistons: FallguysPistonData[] = [];

  constructor(ctx: CourseBuildContext, shared: SharedObstacleSystem) {
    this.ctx = ctx;
    this.shared = shared;
  }

  /** 폴가이즈 맵 장식: 솜사탕 구름 · 에어벌룬 · 파스텔 깃발 */
  public buildScenery(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      emissive: 0xffffff,
      emissiveIntensity: 0.06,
    });

    // 1. 트랙 양옆 둥실둥실 솜사탕 구름
    for (let z = 6; z <= 146; z += 15) {
      const cx = getTrackCenterX(z);
      const baseY = getTrackHeightAtZ(z) + 11.5 + Math.random() * 4.5;
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
        this.ctx.courseGroup.add(cloud);
      }
    }

    // 2. 비비드 파스텔 에어벌룬
    const balloonPalette = [0xff6fb5, 0x6fe7c8, 0xffe066, 0x7cc9ff, 0xc9a3ff];
    const basketMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    for (let z = 22; z <= 134; z += 26) {
      const cx = getTrackCenterX(z);
      const baseY = getTrackHeightAtZ(z) + 8.5;
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

        this.ctx.courseGroup.add(balloon);
      }
    }

    // 3. 결승까지 이어지는 삼각 깃발 줄
    const flagPalette = [0xff6fb5, 0x6fe7c8, 0xffe066, 0x7cc9ff, 0xc9a3ff];
    for (let z = 16; z <= 128; z += 16) {
      const cx = getTrackCenterX(z);
      for (const side of [-1, 1]) {
        const line = new THREE.Group();
        line.position.set(cx + side * 9.6, getTrackHeightAtZ(z) + 4.6, z);
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
        this.ctx.courseGroup.add(line);
      }
    }
  }

  public build(): void {
    this.buildAirCushionZone();
    this.buildSweeperZone();
    this.buildPunchZone();
    this.buildSlimeRamp();
    this.buildCrownArch();
  }

  private buildAirCushionZone(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';
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
      this.createAirCushion(
        spec.z,
        spec.offset,
        isLight ? 2.0 : 2.15,
        colors[idx % colors.length]
      );
    });
  }

  private createAirCushion(
    z: number,
    offsetX: number,
    radius: number,
    colorHex: number
  ): void {
    const wx = getTrackCenterX(z) + offsetX;
    const wy = getTrackHeightAtZ(z);

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

    this.ctx.courseGroup.add(group);

    const body = this.ctx.createBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(wx, wy + 0.6, z)
    );
    this.ctx.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.72, radius)
        .setRestitution(1.45)
        .setFriction(0.06)
        .setCollisionGroups(envCollisionGroup()),
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

  private buildSweeperZone(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';
    if (isLight) {
      this.shared.createSweeper(53, 0, 7.2, 2.4, 2, 0xff5fa2);
      return;
    }
    this.shared.createSweeper(47, 0, 7.6, 2.6, 2, 0xff5fa2);
    this.shared.createSweeper(57, 0, 8.2, -2.2, 2, 0x5ee7c7);
    this.shared.createSweeper(66, 0, 7.4, 3.0, 3, 0xffe45c);
  }

  private buildPunchZone(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';

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
      this.createPunchWall(
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
      this.createPiston(spec.z, spec.side, spec.phase);
    }
  }

  private createPunchWall(
    z: number,
    ampX: number,
    freq: number,
    phase: number,
    colorHex: number,
    halfWallWidth: number = 2.4
  ): void {
    const cx = getTrackCenterX(z);
    const halfW = halfWallWidth;
    const halfH = 1.15;
    const halfD = 0.55;
    const y = getTrackHeightAtZ(z) + halfH + 0.06;
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

    this.ctx.courseGroup.add(group);

    const body = this.ctx.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(initX, y, z)
    );
    this.ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
        .setRestitution(1.15)
        .setFriction(0.05)
        .setCollisionGroups(envCollisionGroup()),
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

  private createPiston(z: number, side: number, phase: number): void {
    const cx = getTrackCenterX(z);
    const halfW = 1.0;
    const halfH = 1.0;
    const halfD = 0.55;
    const baseY = getTrackHeightAtZ(z) + halfH + 0.05;
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

    this.ctx.courseGroup.add(group);

    const body = this.ctx.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(restX, baseY, z)
    );
    this.ctx.world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfD, halfH)
        .setRotation({ x: 0, y: 0, z: 0.7071, w: 0.7071 })
        .setRestitution(1.1)
        .setCollisionGroups(envCollisionGroup()),
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
  private buildSlimeRamp(): void {
    const zMin = 104;
    const zMax = 119;
    const tex = createSlimeTexture();
    tex.repeat.set(1, (zMax - zMin) * 0.5);

    const geo = createCurvedFloorStripGeometry(zMin, zMax, -8.6, 8.6, 0.11, 12);
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
    this.ctx.courseGroup.add(mesh);

    this.shared.conveyors.push({
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
      const cx = getTrackCenterX(z);
      for (const side of [-1, 1]) {
        const blob = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), blobMat);
        blob.position.set(cx + side * 7.4, getTrackHeightAtZ(z) + 0.3, z);
        blob.scale.set(1.5, 0.55, 1.2);
        this.ctx.courseGroup.add(blob);
      }
    }
  }

  /** 결승 아치 위에 얹는 거대 황금 왕관 */
  private buildCrownArch(): void {
    const z = this.ctx.finishZ;
    const cx = getTrackCenterX(z);
    const floorY = getTrackHeightAtZ(z);
    const yaw = getTrackYawAtZ(z);

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

    this.ctx.courseGroup.add(crown);
  }

  public reset(): void {
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
  }

  public update(
    dt: number,
    elapsedTime: number,
    racers: RagdollRacer[],
    particles: ParticleSystem,
    sound: SoundManager,
    isRacing: boolean
  ): void {
    if (
      this.fallguysCushions.length === 0 &&
      this.fallguysPunchWalls.length === 0 &&
      this.fallguysPistons.length === 0
    ) {
      return;
    }

    // 1) 에어 쿠션 범퍼: 닿으면 통통 튕겨나간다
    for (const cu of this.fallguysCushions) {
      cu.squash = Math.max(0, cu.squash - dt * 3.4);
      const pulse = 1 - cu.squash * 0.16 + Math.sin(elapsedTime * 2.1 + cu.pos.z) * 0.015;
      cu.mesh.scale.set(1 + cu.squash * 0.12, pulse, 1 + cu.squash * 0.12);

      if (!isRacing) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = cu.hitCooldowns.get(r.id) || 0;
        if (elapsedTime - lastHit < 0.45) continue;

        const rPos = r.getPosition();
        const dx = rPos.x - cu.pos.x;
        const dz = rPos.z - cu.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < cu.radius + 0.8 && rPos.y - getTrackHeightAtZ(rPos.z) < 3.2) {
          cu.hitCooldowns.set(r.id, elapsedTime);
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
      const cx = getTrackCenterX(wall.baseZ);
      const curX = cx + Math.sin(elapsedTime * wall.freq + wall.phase) * wall.ampX;
      const vx = curX - wall.lastX;
      wall.lastX = curX;
      wall.mesh.position.set(curX, wall.baseY, wall.baseZ);
      wall.body.setNextKinematicTranslation({ x: curX, y: wall.baseY, z: wall.baseZ });

      if (!isRacing) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = wall.hitCooldowns.get(r.id) || 0;
        if (elapsedTime - lastHit < 0.55) continue;

        const rPos = r.getPosition();
        if (
          Math.abs(rPos.x - curX) < wall.halfW + 0.6 &&
          Math.abs(rPos.z - wall.baseZ) < wall.halfD + 0.9 &&
          Math.abs(rPos.y - wall.baseY) < wall.halfH + 1.0
        ) {
          wall.hitCooldowns.set(r.id, elapsedTime);
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
      const extend = Math.max(0, Math.sin(elapsedTime * piston.freq + piston.phase));
      const curX = piston.restX - piston.side * piston.stroke * extend;
      piston.mesh.position.set(curX, piston.baseY, piston.z);
      piston.body.setNextKinematicTranslation({ x: curX, y: piston.baseY, z: piston.z });

      if (!isRacing || extend < 0.28) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = piston.hitCooldowns.get(r.id) || 0;
        if (elapsedTime - lastHit < 0.6) continue;

        const rPos = r.getPosition();
        if (
          Math.abs(rPos.x - curX) < piston.halfD + 0.75 &&
          Math.abs(rPos.z - piston.z) < piston.halfW + 0.8 &&
          Math.abs(rPos.y - piston.baseY) < piston.halfH + 1.0
        ) {
          piston.hitCooldowns.set(r.id, elapsedTime);
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
}
