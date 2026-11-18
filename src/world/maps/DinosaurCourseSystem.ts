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
} from '../courseMath';
import { createCurvedFloorStripGeometry } from '../courseTextures';
import type {
  AnimatedDinoPart,
  CourseBuildContext,
  FallingPoopData,
  FlyingPterosaurData,
  LavaGeyserData,
  PoopPuddleData,
  RollingBoulderData,
  RunningTRexData,
  TurboPadData,
} from '../courseTypes';
import type { SharedObstacleSystem } from '../obstacles/SharedObstacleSystem';
import { buildDinosaurJungleScenery, createDinosaurMesh } from './dinosaurModels';

export class DinosaurCourseSystem {
  private ctx: CourseBuildContext;
  private shared: SharedObstacleSystem;

  private flyingPterosaurs: FlyingPterosaurData[] = [];
  private animatedDinoParts: AnimatedDinoPart[] = [];
  private runningTRexes: RunningTRexData[] = [];
  private fallingPoops: FallingPoopData[] = [];
  private poopPuddles: PoopPuddleData[] = [];
  private turboPads: TurboPadData[] = [];
  private rollingBoulders: RollingBoulderData[] = [];
  private lavaGeysers: LavaGeyserData[] = [];

  constructor(ctx: CourseBuildContext, shared: SharedObstacleSystem) {
    this.ctx = ctx;
    this.shared = shared;
  }

  public buildScenery(): void {
    buildDinosaurJungleScenery(this.ctx, this.animatedDinoParts, this.flyingPterosaurs);
  }

  public build(): void {
    this.buildZone1KartCircuit();
    this.buildZone2TrexStampede();
    this.buildZone3PoopAndVolcano();
    this.buildZone4FinalCanyon();
    this.seedInitialPoopPuddles();
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
    const wx = getTrackCenterX(curZ) + laneOffset;
    const wy = getTrackHeightAtZ(curZ);

    const dino = createDinosaurMesh('TREX', scale, false);
    // Face straight -Z toward oncoming kart racers!
    dino.group.rotation.y = Math.PI;
    dino.group.position.set(wx, wy, curZ);
    this.ctx.courseGroup.add(dino.group);

    const body = this.ctx.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(wx, wy + 1.8 * scale, curZ)
    );
    this.ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.1 * scale, 1.6 * scale, 1.65 * scale)
        .setRestitution(1.05)
        .setCollisionGroups(envCollisionGroup()),
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
      if (oldest) this.ctx.courseGroup.remove(oldest.group);
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
    this.ctx.courseGroup.add(group);

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
    const isLight = this.ctx.obstacleDensity === 'LIGHT';
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
      const wx = getTrackCenterX(s.z) + s.offset;
      const wy = getTrackHeightAtZ(s.z);
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
    const ctx2d = canvas.getContext('2d')!;
    ctx2d.fillStyle = '#ea580c';
    ctx2d.fillRect(0, 0, 128, 128);
    // Bright neon yellow side trim rails
    ctx2d.fillStyle = '#facc15';
    ctx2d.fillRect(0, 0, 10, 128);
    ctx2d.fillRect(118, 0, 10, 128);

    // Chevrons pointing toward Canvas y = 0 (v = 1 -> +Z forward along curved strip)
    ctx2d.strokeStyle = '#fef08a';
    ctx2d.lineWidth = 15;
    ctx2d.lineCap = 'round';
    ctx2d.lineJoin = 'round';
    for (const cy of [42, 98]) {
      ctx2d.beginPath();
      ctx2d.moveTo(24, cy + 20);
      ctx2d.lineTo(64, cy - 20);
      ctx2d.lineTo(104, cy + 20);
      ctx2d.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);

    const stripGeo = createCurvedFloorStripGeometry(
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
    this.ctx.courseGroup.add(mesh);

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
    const wx = getTrackCenterX(initZ) + Math.sin(phase) * laneAmp;
    const wy = getTrackHeightAtZ(initZ) + radius;

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
    this.ctx.courseGroup.add(mesh);

    const body = this.ctx.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(wx, wy, initZ)
    );
    this.ctx.world.createCollider(
      RAPIER.ColliderDesc.ball(radius)
        .setRestitution(1.1)
        .setCollisionGroups(envCollisionGroup()),
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
    const wx = getTrackCenterX(z) + offsetX;
    const wy = getTrackHeightAtZ(z) + 0.08;

    const ringGeo = new THREE.RingGeometry(radius * 0.45, radius, 22);
    ringGeo.rotateX(-Math.PI / 2 + TRACK_SLOPE);
    const ringMesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide })
    );
    ringMesh.position.set(wx, wy, z);
    this.ctx.courseGroup.add(ringMesh);

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
    this.ctx.courseGroup.add(plumeMesh);

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

  private createTriceratopsCharger(z: number, ampX: number, freq: number, phase: number): void {
    const cx = getTrackCenterX(z);
    const halfW = 1.65;
    const halfH = 1.1;
    const halfD = 0.9;
    const y = getTrackHeightAtZ(z) + 0.05;
    const initX = cx + Math.sin(phase) * ampX;

    const group = new THREE.Group();
    group.position.set(initX, y, z);

    const dino = createDinosaurMesh('TRICERATOPS', 0.88, false);
    // Face +X inside local group, then flip outer group Y rotation based on charging velocity
    dino.group.rotation.y = Math.PI * 0.5;
    group.rotation.y = Math.cos(phase) >= 0 ? 0 : Math.PI;
    group.userData.isCharger = true;
    group.add(dino.group);
    this.ctx.courseGroup.add(group);

    const body = this.ctx.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(initX, y + halfH, z)
    );
    this.ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
        .setRestitution(1.05)
        .setCollisionGroups(envCollisionGroup()),
      body
    );

    this.shared.slidingShields.push({
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

  private buildZone1KartCircuit(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';

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

  private buildZone2TrexStampede(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';

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

  private buildZone3PoopAndVolcano(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';

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

  private buildZone4FinalCanyon(): void {
    const isLight = this.ctx.obstacleDensity === 'LIGHT';

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

  public reset(): void {
    for (const fp of this.fallingPoops) {
      this.ctx.courseGroup.remove(fp.mesh);
    }
    this.fallingPoops = [];

    for (const puddle of this.poopPuddles) {
      this.ctx.courseGroup.remove(puddle.group);
    }
    this.poopPuddles = [];
    if (this.ctx.mapTheme === 'DINOSAUR') {
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
  }

  public update(
    dt: number,
    elapsedTime: number,
    racers: RagdollRacer[],
    particles: ParticleSystem,
    sound: SoundManager,
    isRacing: boolean
  ): void {
    // 13. Flying Pteranodons & Airborne Poop Bombs (익룡이 날아가다 똥 투하!)
    for (const pt of this.flyingPterosaurs) {
      const t = elapsedTime * 0.85 + pt.phase;
      const nextX = pt.baseX + Math.sin(t) * pt.radiusX;
      const nextZ = pt.baseZ + Math.cos(t * 0.7) * 5.5;
      const nextY = pt.baseY + Math.sin(t * 1.9) * 1.35;
      const dx = nextX - pt.group.position.x;
      const dz = nextZ - pt.group.position.z;
      pt.group.position.set(nextX, nextY, nextZ);
      if (Math.hypot(dx, dz) > 0.001) {
        pt.group.rotation.y = Math.atan2(dx, dz);
      }
      const flap = Math.sin(elapsedTime * 7.2 + pt.phase) * 0.45;
      pt.leftWing.rotation.z = flap;
      pt.rightWing.rotation.z = -flap;

      if (isRacing && pt.canDropPoop) {
        pt.dropTimer -= dt;
        if (pt.dropTimer <= 0) {
          pt.dropTimer = pt.dropInterval * (0.85 + Math.random() * 0.35);
          const cx = getTrackCenterX(nextZ);
          const halfW = getTrackHalfWidthAtZ(nextZ, this.ctx.mapTheme);
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
          this.ctx.courseGroup.add(poopMesh);
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

      const floorY = getTrackHeightAtZ(fp.z);
      if (fp.y <= floorY + 0.16) {
        this.ctx.courseGroup.remove(fp.mesh);
        this.fallingPoops.splice(i, 1);
        this.spawnPoopPuddle(fp.x, floorY, fp.z, 9.0);
        particles.spawnHitBurst(new THREE.Vector3(fp.x, floorY + 0.25, fp.z), '#713f12', 6);
      }
    }

    // Active Poop Puddles (밟으면 느려짐 + 질척 효과음 + 💩 배지)
    for (let i = this.poopPuddles.length - 1; i >= 0; i--) {
      const puddle = this.poopPuddles[i];
      puddle.lifeLeft -= dt;
      if (puddle.lifeLeft <= 0) {
        this.ctx.courseGroup.remove(puddle.group);
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
        this.ctx.courseGroup.remove(puddle.group);
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
        if (elapsedTime - lastHit < 0.75) continue;

        const rPos = r.getPosition();
        if (Math.abs(rPos.z - pad.z) >= pad.halfL + 0.55) continue;

        const padX = getTrackCenterX(rPos.z) + pad.offsetX;
        const padY = getTrackHeightAtZ(rPos.z);
        if (Math.abs(rPos.x - padX) < pad.halfW + 0.55 && Math.abs(rPos.y - padY) < 1.9) {
          pad.hitCooldowns.set(r.id, elapsedTime);
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

      const wx = getTrackCenterX(trex.curZ) + trex.laneOffset;
      const wy = getTrackHeightAtZ(trex.curZ);

      const fadeDist = 3.5;
      const fadeRatio = Math.min(
        1,
        Math.max(0, (trex.curZ - trex.zMin) / fadeDist),
        Math.max(0, (trex.zMax - trex.curZ) / fadeDist)
      );
      const curScale = trex.scale * Math.max(0.05, fadeRatio);
      const stridePhase = elapsedTime * 11.0 + trex.phase;
      const stompLift = Math.abs(Math.sin(stridePhase)) * 0.22 * trex.scale;

      trex.group.position.set(wx, wy + stompLift, trex.curZ);
      trex.group.scale.setScalar(curScale);
      trex.leftLeg.rotation.x = Math.sin(stridePhase) * 0.6;
      trex.rightLeg.rotation.x = -Math.sin(stridePhase) * 0.6;
      trex.jawPivot.rotation.x = Math.sin(elapsedTime * 7.5 + trex.phase) * 0.22;

      trex.body.setNextKinematicTranslation({
        x: wx,
        y: fadeRatio < 0.45 ? wy - 12 : wy + 1.8 * trex.scale,
        z: trex.curZ,
      });

      if (!isRacing || fadeRatio < 0.45) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = trex.hitCooldowns.get(r.id) || 0;
        if (elapsedTime - lastHit < 0.7) continue;

        const rPos = r.getPosition();
        if (
          Math.abs(rPos.x - wx) < 1.3 * trex.scale + 0.45 &&
          Math.abs(rPos.z - trex.curZ) < 1.7 * trex.scale + 0.5 &&
          Math.abs(rPos.y - (wy + 1.3 * trex.scale)) < 2.2 * trex.scale
        ) {
          trex.hitCooldowns.set(r.id, elapsedTime);
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
        getTrackCenterX(b.curZ) + Math.sin(elapsedTime * b.laneFreq + b.phase) * b.laneAmp;
      const by = getTrackHeightAtZ(b.curZ) + b.radius;
      b.mesh.position.set(bx, by, b.curZ);
      b.mesh.rotation.x += (b.speedZ * dt) / b.radius;
      b.mesh.rotation.z += dt * 1.4;
      b.body.setNextKinematicTranslation({ x: bx, y: by, z: b.curZ });

      if (!isRacing) continue;
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = b.hitCooldowns.get(r.id) || 0;
        if (elapsedTime - lastHit < 0.65) continue;

        const rPos = r.getPosition();
        if (Math.hypot(rPos.x - bx, rPos.y - by, rPos.z - b.curZ) < b.radius + 0.85) {
          b.hitCooldowns.set(r.id, elapsedTime);
          const dirX = rPos.x >= bx ? 1 : -1;
          r.triggerRagdoll({ x: dirX * 25, y: 21, z: 10 }, undefined, 1.2);
          particles.spawnHitBurst(rPos, '#f97316', 12);
          sound.playRagdollHit(1.3);
        }
      }
    }

    // 17. Erupting Lava Geysers (용암 간헐천)
    for (const g of this.lavaGeysers) {
      const gx = getTrackCenterX(g.z) + g.offsetX;
      const gy = getTrackHeightAtZ(g.z);
      const cycle = Math.sin(elapsedTime * g.freq + g.phase);
      const isTelegraph = cycle > 0.25 && cycle <= 0.62;
      const isErupting = cycle > 0.62;

      const ringMat = g.ringMesh.material as THREE.MeshBasicMaterial;
      if (isErupting) {
        ringMat.color.setHex(0xef4444);
        g.ringMesh.scale.setScalar(1.22);
        g.plumeMesh.visible = true;
        g.plumeMesh.position.set(gx, gy + 2.6, g.z);
        g.plumeMesh.scale.set(
          1 + Math.sin(elapsedTime * 24) * 0.12,
          1,
          1 + Math.cos(elapsedTime * 24) * 0.12
        );
      } else if (isTelegraph) {
        ringMat.color.setHex(0xfacc15);
        g.ringMesh.scale.setScalar(1.0 + Math.sin(elapsedTime * 20) * 0.15);
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
        if (elapsedTime - lastHit < 0.85) continue;

        const rPos = r.getPosition();
        if (Math.hypot(rPos.x - gx, rPos.z - g.z) < g.radius + 0.5 && Math.abs(rPos.y - gy) < 3.6) {
          g.hitCooldowns.set(r.id, elapsedTime);
          r.triggerRagdoll({ x: (Math.random() - 0.5) * 18, y: 34, z: -8 }, undefined, 1.35);
          particles.spawnHitBurst(rPos, '#fb923c', 14);
          sound.playBumperBounce();
        }
      }
    }

    // 18. Scenery Giant Dinosaurs Idle Animations
    for (const anim of this.animatedDinoParts) {
      anim.part.rotation.x = anim.baseRotX + Math.sin(elapsedTime * anim.freq + anim.phase) * anim.amp;
    }
  }
}
