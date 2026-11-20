import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d';
import type { FlickMode, MapTheme, ObstacleDensity } from '../types';
import type { CustomCourseLayout, CustomObstacleSpec } from '../editor/editorTypes';
import type { RagdollRacer } from '../entities/RagdollRacer';
import type { ParticleSystem } from '../effects/ParticleSystem';
import type { SoundManager } from '../audio/SoundManager';
import {
  DINO_FINISH_Z,
  DINO_TRACK_LENGTH,
  FINISH_Z,
  TRACK_LENGTH,
  getTrackCenterX,
  getTrackHalfWidthAtZ,
  getTrackHeightAtZ,
  getTrackYawAtZ,
  getZoneLabelAtZ,
} from './courseMath';
import type { CourseBuildContext, OverheadBannerData } from './courseTypes';
import { SharedObstacleSystem } from './obstacles/SharedObstacleSystem';
import { DinosaurCourseSystem } from './maps/DinosaurCourseSystem';
import { FallguysCourseSystem } from './maps/FallguysCourseSystem';
import { PoolCourseSystem } from './maps/PoolCourseSystem';
import { buildPlaygroundCourse } from './maps/playgroundCourse';
import { buildTaekwondoCourse } from './maps/taekwondoCourse';
import { CrowdSystem } from './track/CrowdSystem';
import { buildCurvedTrackAndScenery, buildFinishArch, buildStartGate } from './track/trackScenery';
import { GiantTrapController } from './traps/GiantTrapController';

export { TRACK_LENGTH, FINISH_Z, DINO_TRACK_LENGTH, DINO_FINISH_Z, TRACK_SLOPE } from './courseMath';

export class ObstacleCourse {
  private world: RAPIER.World;
  private scene: THREE.Scene;
  public readonly mapTheme: MapTheme;
  public readonly obstacleDensity: ObstacleDensity;
  public readonly finishZ: number;
  public readonly trackLength: number;

  private courseGroup: THREE.Group;
  private bodies: RAPIER.RigidBody[] = [];
  private overheadBanners: OverheadBannerData[] = [];
  private ctx: CourseBuildContext;

  private sharedObstacles: SharedObstacleSystem;
  private dinoCourse: DinosaurCourseSystem;
  private poolCourse: PoolCourseSystem;
  private fallguysCourse: FallguysCourseSystem;
  private giantTraps: GiantTrapController;
  private crowd: CrowdSystem;

  private startGateBody: RAPIER.RigidBody;
  private startGateMesh: THREE.Mesh;
  private gateOpen: boolean = false;
  private gateOpenProgress: number = 0;
  private elapsedTime: number = 0;

  public onFinishFlick?: (racer: RagdollRacer, flickNumber: number, isManual: boolean) => void;
  public onPoolSplash?: (racer: RagdollRacer, kind: 'BALLOON' | 'DUCK') => void;
  public onTubeMount?: (racer: RagdollRacer) => void;
  public onWaveHit?: (racer: RagdollRacer, isTubeRider: boolean) => void;

  constructor(
    world: RAPIER.World,
    scene: THREE.Scene,
    mapTheme: MapTheme = 'PLAYGROUND',
    obstacleDensity: ObstacleDensity = 'NORMAL',
    flickMode: FlickMode = 'DOUBLE',
    isMobile: boolean = false,
    customLayout: CustomCourseLayout | null = null
  ) {
    this.world = world;
    this.scene = scene;
    this.mapTheme = mapTheme;
    this.obstacleDensity = obstacleDensity;
    this.finishZ = mapTheme === 'DINOSAUR' ? DINO_FINISH_Z : FINISH_Z;
    this.trackLength = mapTheme === 'DINOSAUR' ? DINO_TRACK_LENGTH : TRACK_LENGTH;

    this.courseGroup = new THREE.Group();
    this.scene.add(this.courseGroup);

    this.ctx = {
      world: this.world,
      courseGroup: this.courseGroup,
      mapTheme: this.mapTheme,
      obstacleDensity: this.obstacleDensity,
      finishZ: this.finishZ,
      trackLength: this.trackLength,
      createBody: (desc) => this.createBody(desc),
      overheadBanners: this.overheadBanners,
    };

    this.sharedObstacles = new SharedObstacleSystem(this.ctx);
    this.dinoCourse = new DinosaurCourseSystem(this.ctx, this.sharedObstacles);
    this.poolCourse = new PoolCourseSystem(this.ctx, this.sharedObstacles);
    this.fallguysCourse = new FallguysCourseSystem(this.ctx, this.sharedObstacles);
    this.giantTraps = new GiantTrapController(this.ctx, flickMode, (pos, color, particles) =>
      this.poolCourse.spawnPoolSplash(pos, color, particles)
    );

    this.giantTraps.onFinishFlick = (racer, flickNumber, isManual) => {
      this.crowd.triggerExcitement(1.3, 2.8);
      this.onFinishFlick?.(racer, flickNumber, isManual);
    };
    this.poolCourse.onPoolSplash = (racer, kind) => {
      this.crowd.triggerExcitement(1.0, 2.2);
      this.onPoolSplash?.(racer, kind);
    };
    this.poolCourse.onTubeMount = (racer) => {
      this.crowd.triggerExcitement(0.65, 1.5);
      this.onTubeMount?.(racer);
    };
    this.poolCourse.onWaveHit = (racer, isTubeRider) => {
      this.crowd.triggerExcitement(0.85, 1.8);
      this.onWaveHit?.(racer, isTubeRider);
    };

    const sceneryBuilder =
      this.mapTheme === 'DINOSAUR'
        ? () => this.dinoCourse.buildScenery()
        : this.mapTheme === 'POOL'
        ? () => this.poolCourse.buildScenery()
        : this.mapTheme === 'FALLGUYS'
        ? () => this.fallguysCourse.buildScenery()
        : undefined;

    buildCurvedTrackAndScenery(this.ctx, sceneryBuilder);

    const startGate = buildStartGate(this.ctx);
    this.startGateMesh = startGate.startGateMesh;
    this.startGateBody = startGate.startGateBody;

    const skipBase = Boolean(customLayout?.clearBaseObstacles);
    if (!skipBase) {
      if (this.mapTheme === 'TAEKWONDO') {
        buildTaekwondoCourse(this.ctx, this.sharedObstacles);
      } else if (this.mapTheme === 'DINOSAUR') {
        this.dinoCourse.build();
      } else if (this.mapTheme === 'POOL') {
        this.poolCourse.build();
      } else if (this.mapTheme === 'FALLGUYS') {
        this.fallguysCourse.build();
      } else {
        buildPlaygroundCourse(this.ctx, this.sharedObstacles);
      }
    }

    if (customLayout && customLayout.obstacles.length > 0) {
      this.applyCustomObstacles(customLayout.obstacles);
    }

    buildFinishArch(this.ctx, this.mapTheme === 'TAEKWONDO');
    this.crowd = new CrowdSystem(this.courseGroup, this.mapTheme, this.finishZ, isMobile);
    this.giantTraps.build();
  }

  private applyCustomObstacles(obstacles: CustomObstacleSpec[]): void {
    let doorRowIdx = 10;
    obstacles.forEach((ob, idx) => {
      const z = THREE.MathUtils.clamp(ob.z, 13, this.finishZ - 5);
      const halfW = this.getTrackHalfWidthAtZ(z);
      const offsetX = THREE.MathUtils.clamp(ob.offsetX, -halfW + 1.4, halfW - 1.4);
      const scale = THREE.MathUtils.clamp(ob.scale || 1, 0.6, 1.8);
      const spd = Math.max(0.5, ob.speed || 1);
      const dir = ob.dir >= 0 ? 1 : -1;

      switch (ob.kind) {
        case 'SWEEPER':
          this.sharedObstacles.createSweeper(
            z,
            offsetX,
            4.8 * scale,
            spd * dir,
            scale > 1.25 ? 3 : 2,
            0xff5fa2
          );
          break;
        case 'POPUP_BUMPER':
          this.sharedObstacles.addPopupBumpers(
            [{ z, offset: offsetX, phase: idx * 0.8, freq: Math.max(1.5, spd) }],
            0x10b981
          );
          break;
        case 'PINBALL_BUMPER':
          this.sharedObstacles.addPinballBumpers([{ z, offset: offsetX }], 0xec4899);
          break;
        case 'SLIDING_WALL':
          this.sharedObstacles.createSlidingShield(
            z,
            2.1 * scale,
            1.1,
            0.5,
            Math.max(2.0, halfW - 2.6 * scale),
            spd,
            idx * 0.9,
            0x2bdfe8
          );
          break;
        case 'PENDULUM':
          this.sharedObstacles.addSwingingPendulums(
            [{ z, freq: Math.max(1.2, spd), phase: idx * 0.7, maxAngle: 0.9 }],
            this.mapTheme === 'TAEKWONDO'
          );
          break;
        case 'SPRINGBOARD':
          this.sharedObstacles.createSpringboard(
            z,
            offsetX,
            2.1 * scale,
            1.6 * scale,
            18 * Math.min(1.5, spd),
            24 * scale
          );
          break;
        case 'BOOST_BELT': {
          const minX = THREE.MathUtils.clamp(offsetX - 2.8 * scale, -8.5, 4.0);
          const maxX = THREE.MathUtils.clamp(minX + 5.6 * scale, -4.0, 8.5);
          this.sharedObstacles.addConveyorBelt(z - 5, z + 5, minX, maxX, Math.abs(spd), true);
          break;
        }
        case 'REVERSE_BELT': {
          const minX = THREE.MathUtils.clamp(offsetX - 2.8 * scale, -8.5, 4.0);
          const maxX = THREE.MathUtils.clamp(minX + 5.6 * scale, -4.0, 8.5);
          this.sharedObstacles.addConveyorBelt(z - 5, z + 5, minX, maxX, -Math.abs(spd), false);
          break;
        }
        case 'WIND_FAN':
          this.sharedObstacles.addWindFan(z - 4, z + 4, offsetX < 0 ? -1 : 1, Math.abs(spd));
          break;
        case 'BREAKING_DOORS': {
          const style =
            this.mapTheme === 'TAEKWONDO'
              ? 'PINEWOOD'
              : this.mapTheme === 'DINOSAUR'
              ? 'EGG'
              : 'MYSTERY';
          this.sharedObstacles.buildBreakingDoorRow(z, 5, doorRowIdx++, style);
          break;
        }
        case 'WAVE_CURRENT':
          this.poolCourse.addWaveCurrentZone(
            z - 5,
            z + 5,
            dir,
            22 * scale,
            Math.max(1.0, spd),
            idx * 0.8
          );
          break;
      }
    });
  }

  private createBody(desc: RAPIER.RigidBodyDesc): RAPIER.RigidBody {
    const body = this.world.createRigidBody(desc);
    this.bodies.push(body);
    return body;
  }

  public setFlickMode(mode: FlickMode): void {
    this.giantTraps.setFlickMode(mode);
  }

  public openStartGate(): void {
    this.gateOpen = true;
    this.crowd.triggerExcitement(1.1, 2.5);
  }

  public triggerCrowdExcitement(intensity: number = 1.0, duration: number = 2.4): void {
    this.crowd.triggerExcitement(intensity, duration);
  }

  public dispose(): void {
    for (const body of this.bodies) {
      if (this.world.bodies.contains(body.handle)) {
        this.world.removeRigidBody(body);
      }
    }
    this.bodies = [];

    this.courseGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          if (std.map) std.map.dispose();
          m.dispose();
        }
      }
    });
    this.scene.remove(this.courseGroup);
  }

  public getTrackCenterX(z: number): number {
    return getTrackCenterX(z);
  }

  public getTrackYawAtZ(z: number): number {
    return getTrackYawAtZ(z);
  }

  public getTrackHeightAtZ(z: number): number {
    return getTrackHeightAtZ(z);
  }

  public getTrackHalfWidthAtZ(z: number): number {
    return getTrackHalfWidthAtZ(z, this.mapTheme);
  }

  public getZoneLabelAtZ(z: number): string {
    return getZoneLabelAtZ(z, this.mapTheme, this.finishZ);
  }

  public getRemainingFinishFlicks(totalRacers: number): number {
    return this.giantTraps.getRemainingFinishFlicks(totalRacers);
  }

  public hasBeenFlicked(racerId: string): boolean {
    return this.giantTraps.hasBeenFlicked(racerId);
  }

  public triggerManualLeaderFlick(racers: RagdollRacer[]): RagdollRacer | null {
    return this.giantTraps.triggerManualLeaderFlick(racers);
  }

  public resetCourseState(): void {
    this.gateOpen = false;
    this.gateOpenProgress = 0;
    const z = 8.5;
    const cx = this.getTrackCenterX(z);
    const baseY = this.getTrackHeightAtZ(z) + 1.25;
    this.startGateMesh.position.set(cx, baseY, z);
    this.startGateBody.setNextKinematicTranslation({ x: cx, y: baseY, z });

    this.giantTraps.reset();
    this.dinoCourse.reset();
    this.poolCourse.reset();
    this.fallguysCourse.reset();
    this.sharedObstacles.reset();
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
        const isOccludingRange = cameraPos.z >= ob.z - 12 && cameraPos.z <= ob.z + 1.5;
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

    // 2..11. Shared course obstacles
    this.sharedObstacles.update(dt, this.elapsedTime, racers, particles, sound);

    // 12. Pre-Finish Giant Trap
    this.giantTraps.update(dt, this.elapsedTime, racers, particles, sound, isRacing);

    // 13..18. Dinosaur course mechanics & idle animations
    this.dinoCourse.update(dt, this.elapsedTime, racers, particles, sound, isRacing);

    // 19. Pool course tubes, water jets, wave currents, drops & splash rings
    this.poolCourse.update(dt, this.elapsedTime, racers, particles, sound, isRacing);

    // 20. Fall Guys course cushions, punch walls & pistons
    this.fallguysCourse.update(dt, this.elapsedTime, racers, particles, sound, isRacing);

    // 21. Cheering stadium crowd animation
    this.crowd.update(dt, this.elapsedTime);
  }
}
