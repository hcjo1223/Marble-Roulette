import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { FlickMode, MapTheme, ObstacleDensity } from '../types';
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

  private startGateBody: RAPIER.RigidBody;
  private startGateMesh: THREE.Mesh;
  private gateOpen: boolean = false;
  private gateOpenProgress: number = 0;
  private elapsedTime: number = 0;

  public onFinishFlick?: (racer: RagdollRacer, flickNumber: number, isManual: boolean) => void;
  public onPoolSplash?: (racer: RagdollRacer, kind: 'BALLOON' | 'DUCK') => void;

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
      this.onFinishFlick?.(racer, flickNumber, isManual);
    };
    this.poolCourse.onPoolSplash = (racer, kind) => {
      this.onPoolSplash?.(racer, kind);
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

    buildFinishArch(this.ctx, this.mapTheme === 'TAEKWONDO');
    this.giantTraps.build();
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

    // 19. Pool course water drops & splash rings
    this.poolCourse.update(dt, this.elapsedTime, racers, particles, sound, isRacing);

    // 20. Fall Guys course cushions, punch walls & pistons
    this.fallguysCourse.update(dt, this.elapsedTime, racers, particles, sound, isRacing);
  }
}
