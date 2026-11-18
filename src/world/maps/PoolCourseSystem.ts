import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
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
  CourseBuildContext,
  PoolDropData,
  PoolDropZoneData,
  PoolSplashRingData,
} from '../courseTypes';
import type { SharedObstacleSystem } from '../obstacles/SharedObstacleSystem';
import {
  buildPoolScenery,
  createRubberDuckMesh,
  createTubeBumperMesh,
  createWaterBalloonMesh,
} from './poolModels';

export class PoolCourseSystem {
  private ctx: CourseBuildContext;
  private shared: SharedObstacleSystem;

  private poolDropZones: PoolDropZoneData[] = [];
  private poolDrops: PoolDropData[] = [];
  private poolSplashes: PoolSplashRingData[] = [];

  public onPoolSplash?: (racer: RagdollRacer, kind: 'BALLOON' | 'DUCK') => void;

  constructor(ctx: CourseBuildContext, shared: SharedObstacleSystem) {
    this.ctx = ctx;
    this.shared = shared;
  }

  public buildScenery(): void {
    buildPoolScenery(this.ctx);
  }

  public build(): void {
    this.buildSlideAndTubes();
    this.buildTubeSlalom();
    this.buildDropZone(73, 7.0);
    this.buildConveyorBelts();
    this.buildBuoySlalom();
    this.buildBigWaveZone();
  }

  private addTubeBumpers(specs: { z: number; offset: number; color: number }[]): void {
    for (const spec of specs) {
      const cx = getTrackCenterX(spec.z);
      const wx = cx + spec.offset;
      const wy = getTrackHeightAtZ(spec.z) + 0.55;
      const pos = new THREE.Vector3(wx, wy, spec.z);
      const radius = 1.45;

      const group = createTubeBumperMesh(spec.color);
      group.position.copy(pos);
      this.ctx.courseGroup.add(group);

      const body = this.ctx.createBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z)
      );
      this.ctx.world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.5, radius)
          .setRestitution(1.15)
          .setCollisionGroups(envCollisionGroup()),
        body
      );

      this.shared.pinballBumpers.push({
        pos,
        mesh: group,
        radius,
        pulseScale: 1.0,
        hitCooldowns: new Map(),
      });
    }
  }

  private buildSlideAndTubes(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';

    // 1. 젖은 워터슬라이드 물길 (트랙 위 얇은 물막 + 측면 슬라이드 레일)
    const wetGeo = createCurvedFloorStripGeometry(15, 34, -8.5, 8.5, 0.1, 10);
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
    this.ctx.courseGroup.add(wetMesh);

    for (const side of [-1, 1]) {
      for (let z = 16; z <= 33; z += 8.5) {
        const cx = getTrackCenterX(z);
        const yaw = getTrackYawAtZ(z);
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 1.1, 7.6),
          new THREE.MeshStandardMaterial({
            color: side === -1 ? 0x22d3ee : 0xf472b6,
            roughness: 0.3,
          })
        );
        rail.position.set(cx + side * 8.1, getTrackHeightAtZ(z) + 0.55, z);
        rail.rotation.y = yaw;
        rail.castShadow = true;
        this.ctx.courseGroup.add(rail);
      }
    }

    // 2. 워터슬라이드 타워 & 슬라이드 슈트 (트랙 왼쪽 조형물)
    const slideZ = 25;
    const scx = getTrackCenterX(slideZ) - 15.5;
    const sy = getTrackHeightAtZ(slideZ) - 2.2;
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
      const chute = new THREE.Mesh(
        new THREE.TorusGeometry(2.0, 0.42, 10, 18, Math.PI),
        chuteMat
      );
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
    this.ctx.courseGroup.add(tower);

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

  private buildTubeSlalom(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';
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
      const cx = getTrackCenterX(z);
      const yaw = getTrackYawAtZ(z);
      const rope = new THREE.Group();
      rope.position.set(cx, getTrackHeightAtZ(z) + 0.15, z);
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
      this.ctx.courseGroup.add(rope);
    }
  }

  private buildConveyorBelts(): void {
    const beltSpecs =
      this.ctx.obstacleDensity === 'LIGHT'
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
      this.ctx.courseGroup.add(mesh);

      this.shared.conveyors.push({
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
        const cx = getTrackCenterX(z);
        const jetGroup = new THREE.Group();
        jetGroup.position.set(cx + side * 9.9, getTrackHeightAtZ(z) + 0.9, z);
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
        this.ctx.courseGroup.add(jetGroup);
      }
    }
  }

  private buildBuoySlalom(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';
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
      const cx = getTrackCenterX(spec.z);
      const wx = cx + spec.offset;
      const wy = getTrackHeightAtZ(spec.z) + 0.75;
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
      this.ctx.courseGroup.add(group);

      const body = this.ctx.createBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z)
      );
      this.ctx.world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.75, radius)
          .setRestitution(1.05)
          .setCollisionGroups(envCollisionGroup()),
        body
      );

      this.shared.pinballBumpers.push({
        pos,
        mesh: group,
        radius,
        pulseScale: 1.0,
        hitCooldowns: new Map(),
      });
    }
  }

  private buildBigWaveZone(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';

    if (isLight) {
      this.shared.createSweeper(118, 0, 5.0, 3.4, 2, 0x22d3ee);
    } else {
      this.shared.createSweeper(112, -1.6, 5.2, 4.0, 2, 0x22d3ee);
      this.shared.createSweeper(120, 1.8, 4.8, -3.6, 2, 0xf472b6);
      this.shared.createSweeper(127, 0, 5.6, 4.4, 3, 0x0ea5e9);
    }

    // 빅웨이브 조형물 (트랙 양옆에서 밀려오는 반투명 파도)
    for (const side of [-1, 1]) {
      const z = 108;
      const cx = getTrackCenterX(z);
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
      wave.position.set(cx + side * 8.4, getTrackHeightAtZ(z) + 0.3, z);
      wave.rotation.set(0, side * 0.5, Math.PI);
      this.ctx.courseGroup.add(wave);
    }
  }

  /** 물벼락 낙하 존: 하늘에서 거대 물풍선/고무오리가 떨어져 맞은 레이서를 크게 날려보낸다 (중간 45~55% 지점) */
  private buildDropZone(zCenter: number, halfZ: number): void {
    const cx = getTrackCenterX(zCenter);
    const ringY = getTrackHeightAtZ(zCenter);

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
    this.ctx.courseGroup.add(ring);

    const warnLights: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      for (const dz of [-halfZ + 0.6, halfZ - 0.6]) {
        const pz = zCenter + dz;
        const postX = getTrackCenterX(pz) + side * 8.9;
        const postBaseY = getTrackHeightAtZ(pz);
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 3.4, 8),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
        );
        post.position.set(postX, postBaseY + 1.7, pz);
        this.ctx.courseGroup.add(post);

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
        this.ctx.courseGroup.add(light);
        warnLights.push(light);
      }
    }

    // 낙하 지점의 바닥 표식
    for (let i = -1; i <= 1; i++) {
      const markZ = zCenter + i * (halfZ * 0.62);
      const markCX = getTrackCenterX(markZ);
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
      mark.position.set(markCX, getTrackHeightAtZ(markZ) + 0.08, markZ);
      this.ctx.courseGroup.add(mark);
      this.ctx.overheadBanners.push({
        mat: mark.material as THREE.MeshBasicMaterial,
        z: markZ,
      });
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

  private spawnPoolDrop(zone: PoolDropZoneData, racers: RagdollRacer[]): void {
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
      dropX = getTrackCenterX(dropZ) + (Math.random() - 0.5) * 12;
    }
    dropZ = THREE.MathUtils.clamp(dropZ, zone.z - zone.halfZ, zone.z + zone.halfZ);
    const halfW = getTrackHalfWidthAtZ(dropZ, this.ctx.mapTheme);
    const centerX = getTrackCenterX(dropZ);
    dropX = THREE.MathUtils.clamp(dropX, centerX - halfW + 1.4, centerX + halfW - 1.4);

    const floorY = getTrackHeightAtZ(dropZ);
    const startY = floorY + 21 + Math.random() * 5;
    const mesh = kind === 'BALLOON' ? createWaterBalloonMesh() : createRubberDuckMesh();
    mesh.scale.setScalar(kind === 'BALLOON' ? 1 : 0.95);
    mesh.position.set(dropX, startY, dropZ);
    this.ctx.courseGroup.add(mesh);

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
    this.ctx.courseGroup.add(marker);

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

  public spawnPoolSplash(pos: THREE.Vector3, color: string, particles: ParticleSystem): void {
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
    this.ctx.courseGroup.add(mesh);
    this.poolSplashes.push({ mesh, life: 0.62, maxLife: 0.62 });
    particles.spawnHitBurst(pos, '#7dd3fc', 18);
  }

  public reset(): void {
    for (const drop of this.poolDrops) {
      this.ctx.courseGroup.remove(drop.mesh);
      this.ctx.courseGroup.remove(drop.marker);
    }
    this.poolDrops = [];
    for (const splash of this.poolSplashes) {
      this.ctx.courseGroup.remove(splash.mesh);
    }
    this.poolSplashes = [];
    for (const zone of this.poolDropZones) {
      zone.timer = 1.6;
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
    if (this.poolDropZones.length === 0 && this.poolSplashes.length === 0) return;

    // 1. 경고 링 & 경고등 점멸 + 낙하 스케줄
    for (const zone of this.poolDropZones) {
      const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 4.6);
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
      drop.mesh.rotation.z = Math.sin(elapsedTime * 6 + i) * 0.18;

      const floorY = getTrackHeightAtZ(drop.z);
      const markerScale = Math.max(0.35, 1 - (drop.y - floorY) / 26);
      drop.marker.scale.setScalar(markerScale);

      if (drop.y > floorY + drop.radius * 0.9) continue;

      const impact = new THREE.Vector3(drop.x, floorY + 0.35, drop.z);
      this.ctx.courseGroup.remove(drop.mesh);
      this.ctx.courseGroup.remove(drop.marker);
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
        this.ctx.courseGroup.remove(splash.mesh);
        this.poolSplashes.splice(i, 1);
        continue;
      }
      const t = 1 - splash.life / splash.maxLife;
      splash.mesh.scale.setScalar(1 + t * 3.2);
      (splash.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1 - t));
    }
  }
}
