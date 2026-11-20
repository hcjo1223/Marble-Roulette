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
import {
  createConveyorTexture,
  createCurvedFloorStripGeometry,
  createWaterWaveTexture,
} from '../courseTextures';
import type {
  CourseBuildContext,
  PoolDropData,
  PoolDropZoneData,
  PoolRideTubePadData,
  PoolSplashRingData,
  PoolWaterJetData,
  WaveCurrentZoneData,
} from '../courseTypes';
import type { SharedObstacleSystem } from '../obstacles/SharedObstacleSystem';
import {
  buildPoolScenery,
  createRideableTubePickupMesh,
  createRollingWaveCrestMesh,
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
  private rideTubePads: PoolRideTubePadData[] = [];
  private waterJets: PoolWaterJetData[] = [];
  private waveCurrentZones: WaveCurrentZoneData[] = [];

  public onPoolSplash?: (racer: RagdollRacer, kind: 'BALLOON' | 'DUCK') => void;
  public onTubeMount?: (racer: RagdollRacer) => void;
  public onWaveHit?: (racer: RagdollRacer, isTubeRider: boolean) => void;

  constructor(ctx: CourseBuildContext, shared: SharedObstacleSystem) {
    this.ctx = ctx;
    this.shared = shared;
  }

  public buildScenery(): void {
    buildPoolScenery(this.ctx);
  }

  public build(): void {
    this.buildSlideAndTubes();
    this.buildRideableTubes();
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
        new THREE.TorusGeometry(2.0, 0.42, 8, 14, Math.PI),
        chuteMat
      );
      chute.position.set(i * 1.6, 5.2 - i * 0.95, 0);
      chute.rotation.set(0, Math.PI / 2, Math.PI * 0.55);
      tower.add(chute);
    }

    const slidePool = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 0.5, 16),
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

  /** 수영장 2단계 기믹 ①: 탑승 가능한 대형 물놀이 튜브 (타면 물길 가속 + 파도 서핑!) */
  private buildRideableTubes(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';
    const specs = isLight
      ? [
          { z: 23, offsetX: 0, colorHex: 0xff5fa2 },
          { z: 42, offsetX: -3.2, colorHex: 0xfde047 },
          { z: 57, offsetX: 3.0, colorHex: 0x22d3ee },
        ]
      : [
          { z: 22, offsetX: -3.4, colorHex: 0xff5fa2 },
          { z: 27, offsetX: 2.6, colorHex: 0x22d3ee },
          { z: 36, offsetX: 0, colorHex: 0xfde047 },
          { z: 47, offsetX: -2.2, colorHex: 0xa855f7 },
          { z: 53, offsetX: 3.8, colorHex: 0xfb923c },
          { z: 59, offsetX: -0.6, colorHex: 0x4ade80 },
        ];

    for (const sp of specs) {
      const wx = getTrackCenterX(sp.z) + sp.offsetX;
      const wy = getTrackHeightAtZ(sp.z) + 0.52;
      const pos = new THREE.Vector3(wx, wy, sp.z);

      const mesh = createRideableTubePickupMesh(sp.colorHex);
      mesh.position.copy(pos);
      this.ctx.courseGroup.add(mesh);

      const ringGeo = new THREE.RingGeometry(1.15, 1.55, 22);
      ringGeo.rotateX(-Math.PI / 2 + TRACK_SLOPE);
      const ringMesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: sp.colorHex,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
        })
      );
      ringMesh.position.set(wx, getTrackHeightAtZ(sp.z) + 0.11, sp.z);
      this.ctx.courseGroup.add(ringMesh);

      this.rideTubePads.push({
        z: sp.z,
        offsetX: sp.offsetX,
        pos,
        colorHex: sp.colorHex,
        mesh,
        ringMesh,
        respawnTimer: 0,
      });
    }
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
          new THREE.SphereGeometry(0.3, 8, 6),
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

    // 실제 물살 분사 물리 + 분사 비주얼이 연동된 측면 물대포
    const jetZList = [84.5, 90.5, 95.5];
    jetZList.forEach((z, idx) => {
      for (const side of [-1, 1]) {
        const cx = getTrackCenterX(z);
        const jetGroup = new THREE.Group();
        jetGroup.position.set(cx + side * 9.9, getTrackHeightAtZ(z) + 0.9, z);
        const nozzle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.75, 1.5, 10),
          new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.3 })
        );
        nozzle.rotation.z = Math.PI / 2;
        nozzle.rotation.y = side * 0.35;
        jetGroup.add(nozzle);

        const sprayGeo = new THREE.ConeGeometry(1.05, 5.4, 8, 1, true);
        const spray = new THREE.Mesh(
          sprayGeo,
          new THREE.MeshBasicMaterial({
            color: 0xe0f2fe,
            transparent: true,
            opacity: 0.58,
            side: THREE.DoubleSide,
          })
        );
        spray.rotation.z = side * (Math.PI / 2 - 0.14);
        spray.position.set(-side * 2.4, 0.1, 0);
        jetGroup.add(spray);
        this.ctx.courseGroup.add(jetGroup);

        this.waterJets.push({
          z,
          side,
          dirX: -side,
          sprayMesh: spray,
          phase: idx * 1.4 + (side > 0 ? Math.PI : 0),
          hitCooldowns: new Map(),
        });
      }
    });
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
        new THREE.CylinderGeometry(radius, radius * 0.8, 1.5, 10),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 })
      );
      buoy.castShadow = true;
      group.add(buoy);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 0.06, radius + 0.06, 0.36, 10),
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

  /** 수영장 2단계 기믹 ② & 맵 에디터 공용: 파도 존 물살 밀림 구간 */
  public addWaveCurrentZone(
    zMin: number,
    zMax: number,
    dirX: number,
    pushForce: number = 22.0,
    freq: number = 1.6,
    phase: number = 0
  ): void {
    const zLen = Math.max(4, zMax - zMin);
    const zMid = (zMin + zMax) * 0.5;
    const tex = createWaterWaveTexture(dirX);
    tex.repeat.set(3, Math.max(1, zLen * 0.32));

    const stripGeo = createCurvedFloorStripGeometry(zMin, zMax, -8.7, 8.7, 0.1, 10);
    const floorStrip = new THREE.Mesh(
      stripGeo,
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    this.ctx.courseGroup.add(floorStrip);

    const waveWallMesh = createRollingWaveCrestMesh(zLen);
    waveWallMesh.position.set(getTrackCenterX(zMid), getTrackHeightAtZ(zMid) + 1.0, zMid);
    waveWallMesh.rotation.y = getTrackYawAtZ(zMid);
    this.ctx.courseGroup.add(waveWallMesh);

    this.waveCurrentZones.push({
      zMin,
      zMax,
      dirX: dirX >= 0 ? 1 : -1,
      pushForce,
      freq,
      phase,
      texture: tex,
      waveWallMesh,
      hitCooldowns: new Map(),
    });
  }

  private buildBigWaveZone(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';

    // 파도 존 물살 밀림 구간 (Z = 101 ~ 123): 좌우 교차 강풍 물살 + 3D 롤링 파도 벽!
    if (isLight) {
      this.addWaveCurrentZone(102, 114, 1, 18.0, 1.35, 0);
      this.shared.createSweeper(120, 0, 5.0, 3.4, 2, 0x22d3ee);
    } else {
      this.addWaveCurrentZone(101, 111.5, 1, 24.0, 1.65, 0);
      this.addWaveCurrentZone(112.5, 123, -1, 25.0, 1.8, Math.PI * 0.65);
      this.shared.createSweeper(114, -1.5, 5.0, 3.8, 2, 0x22d3ee);
      this.shared.createSweeper(125, 0, 5.6, 4.2, 3, 0x0ea5e9);
    }

    // 빅웨이브 조형물 (트랙 양옆 파도 아치)
    for (const side of [-1, 1]) {
      const z = 108;
      const cx = getTrackCenterX(z);
      const wave = new THREE.Mesh(
        new THREE.TorusGeometry(5.4, 0.75, 8, 18, Math.PI),
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

    const ringGeo = new THREE.RingGeometry(6.6, 8.4, 36);
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
          new THREE.CylinderGeometry(0.11, 0.11, 3.4, 6),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
        );
        post.position.set(postX, postBaseY + 1.7, pz);
        this.ctx.courseGroup.add(post);

        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.34, 10, 8),
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
      const markGeo = new THREE.RingGeometry(1.5, 2.1, 20);
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

    const markerGeo = new THREE.CircleGeometry(1.6, 16);
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
    const geo = new THREE.RingGeometry(0.4, 1.0, 20);
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
    particles.spawnHitBurst(pos, '#7dd3fc', 16);
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
    for (const pad of this.rideTubePads) {
      pad.respawnTimer = 0;
      pad.mesh.visible = true;
      pad.ringMesh.visible = true;
    }
    for (const jet of this.waterJets) {
      jet.hitCooldowns.clear();
    }
    for (const w of this.waveCurrentZones) {
      w.hitCooldowns.clear();
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
      this.poolDropZones.length === 0 &&
      this.poolSplashes.length === 0 &&
      this.rideTubePads.length === 0 &&
      this.waterJets.length === 0 &&
      this.waveCurrentZones.length === 0
    ) {
      return;
    }

    // 0. 탑승용 물놀이 튜브 픽업 기믹
    for (const pad of this.rideTubePads) {
      if (pad.respawnTimer > 0) {
        pad.respawnTimer = Math.max(0, pad.respawnTimer - dt);
        if (pad.respawnTimer === 0) {
          pad.mesh.visible = true;
          pad.ringMesh.visible = true;
        }
        continue;
      }

      pad.mesh.rotation.y += dt * 1.7;
      pad.mesh.position.y = pad.pos.y + Math.sin(elapsedTime * 3.4 + pad.z) * 0.14;
      pad.ringMesh.scale.setScalar(1 + Math.sin(elapsedTime * 4.5 + pad.z) * 0.08);

      if (!isRacing) continue;
      for (const r of racers) {
        if (r.state !== 'RUNNING' || r.isRidingTube()) continue;
        const rPos = r.getPosition();
        if (
          Math.hypot(rPos.x - pad.pos.x, rPos.z - pad.pos.z) < 1.85 &&
          Math.abs(rPos.y - pad.pos.y) < 2.2
        ) {
          if (r.mountTube(pad.colorHex, 5.8)) {
            pad.respawnTimer = 4.5;
            pad.mesh.visible = false;
            pad.ringMesh.visible = false;
            particles.spawnHitBurst(rPos, '#38bdf8', 12);
            sound.playTubeMount();
            this.onTubeMount?.(r);
            break;
          }
        }
      }
    }

    // 0-b. 물살 분사기(측면 워터캐논) 펄스 물리
    for (const jet of this.waterJets) {
      const pulse = Math.sin(elapsedTime * 2.5 + jet.phase);
      const firing = pulse > 0.12;
      jet.sprayMesh.visible = firing;
      if (firing) {
        const stretch = 0.8 + pulse * 0.55;
        jet.sprayMesh.scale.set(1, stretch, 1);
      }
      if (!isRacing || !firing) continue;

      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const rPos = r.getPosition();
        if (Math.abs(rPos.z - jet.z) > 2.3 || rPos.y - getTrackHeightAtZ(rPos.z) > 3.2) continue;

        const cx = getTrackCenterX(rPos.z);
        const lat = rPos.x - cx;
        // Jet shoots from wall (side * 9) across ~11m of the track
        const inStream = jet.side < 0 ? lat < 2.5 : lat > -2.5;
        if (!inStream) continue;

        r.applyWavePush(jet.dirX * 38 * dt, -2.5 * dt, false);
        const lastHit = jet.hitCooldowns.get(r.id) || 0;
        if (elapsedTime - lastHit > 0.9) {
          jet.hitCooldowns.set(r.id, elapsedTime);
          particles.spawnHitBurst(rPos, '#bae6fd', 6);
          sound.playWaterSplash(0.65);
        }
      }
    }

    // 0-c. 파도 존 물살 밀림 구간 (지속 횡류 물살 + 3D 롤링 파도 벽 덮침!)
    for (const wz of this.waveCurrentZones) {
      wz.texture.offset.x -= wz.dirX * dt * 1.45;
      const zMid = (wz.zMin + wz.zMax) * 0.5;
      const cx = getTrackCenterX(zMid);
      const waveCycle = ((elapsedTime * wz.freq * 0.38 + wz.phase) % 1 + 1) % 1;
      const sweepSpan = 16.4;
      const waveOffsetX = (wz.dirX > 0 ? -0.5 + waveCycle : 0.5 - waveCycle) * sweepSpan;
      const waveWorldX = cx + waveOffsetX;
      const waveY = getTrackHeightAtZ(zMid) + 0.95;

      wz.waveWallMesh.position.set(waveWorldX, waveY, zMid);
      wz.waveWallMesh.scale.set(1, 0.9 + Math.sin(waveCycle * Math.PI) * 0.45, 1);

      if (!isRacing) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const rPos = r.getPosition();
        if (rPos.z < wz.zMin || rPos.z > wz.zMax) continue;
        if (rPos.y - getTrackHeightAtZ(rPos.z) > 3.6) continue;

        // 1) 지속 물살 밀림 힘 (튜브 탑승자는 저항력 감소)
        r.applyWavePush(wz.dirX * wz.pushForce * dt, -1.8 * dt, false);

        // 2) 3D 파도 벽과 정면 충돌 시 파도 휩쓸림 (튜브 탑승자는 파도 타기 서핑 점프!)
        const localCenter = getTrackCenterX(rPos.z);
        const curWaveX = localCenter + waveOffsetX;
        if (Math.abs(rPos.x - curWaveX) < 1.85) {
          const lastHit = wz.hitCooldowns.get(r.id) || 0;
          if (elapsedTime - lastHit > 0.95) {
            wz.hitCooldowns.set(r.id, elapsedTime);
            r.applyWavePush(wz.dirX * 36, -6, true);
            this.spawnPoolSplash(
              new THREE.Vector3(rPos.x, getTrackHeightAtZ(rPos.z) + 0.25, rPos.z),
              '#38bdf8',
              particles
            );
            sound.playWaterSplash(1.1);
            this.onWaveHit?.(r, r.isRidingTube());
          }
        }
      }
    }

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
      sound.playWaterSplash(1.25);
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
