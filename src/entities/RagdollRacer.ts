import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import type { MapTheme, ParticipantEntry, RacerState } from '../types';
import { hasFloorPitAtZ } from '../world/courseMath';
import {
  type FaceMode,
  type RacerBuffState,
  createRacerVisuals,
  createRideTubeAttachment,
  drawRacerBillboardLabel,
  drawRacerFaceTexture,
} from './racerVisuals';

export const GROUP_ENV = 0x0001;
export const GROUP_TORSO = 0x0002;
export const GROUP_LIMB = 0x0004;

export function makeCollisionGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

export class RagdollRacer {
  public readonly id: string;
  public readonly name: string;
  public readonly color: string;
  public readonly accentColor: string;
  public readonly isKartMode: boolean;
  public readonly isJellybean: boolean;
  private readonly mapTheme: MapTheme;
  private readonly lowCostMode: boolean;

  public state: RacerState = 'WAITING';
  public rank: number = 1;
  public finishOrder: number | null = null;
  public finishTime: number | null = null;
  public ragdollCount: number = 0;
  public isTargetRankCandidate: boolean = false;

  // Rapier Physics Bodies (6-part R6 Ragdoll)
  private world: RAPIER.World;
  public torsoBody: RAPIER.RigidBody;
  public headBody: RAPIER.RigidBody;
  public leftArmBody: RAPIER.RigidBody;
  public rightArmBody: RAPIER.RigidBody;
  public leftLegBody: RAPIER.RigidBody;
  public rightLegBody: RAPIER.RigidBody;
  private limbColliders: RAPIER.Collider[] = [];
  private limbsCollisionEnabled: boolean = true;

  // Rapier Impulse Joints
  private neckJoint: RAPIER.SphericalImpulseJoint;
  private leftShoulderJoint: RAPIER.RevoluteImpulseJoint;
  private rightShoulderJoint: RAPIER.RevoluteImpulseJoint;
  private leftHipJoint: RAPIER.RevoluteImpulseJoint;
  private rightHipJoint: RAPIER.RevoluteImpulseJoint;

  // Three.js Meshes & Sprites (created by racerVisuals.ts)
  private scene: THREE.Scene;
  public torsoMesh: THREE.Mesh;
  public headMesh: THREE.Mesh;
  public leftArmMesh: THREE.Mesh;
  public rightArmMesh: THREE.Mesh;
  public leftLegMesh: THREE.Mesh;
  public rightLegMesh: THREE.Mesh;
  public selectionRing: THREE.Mesh;
  private kartWheels: THREE.Mesh[];
  private kartFlameMesh: THREE.Mesh | null;
  private rideTubeGroup: THREE.Group | null = null;

  private faceCtx: CanvasRenderingContext2D;
  private faceTexture: THREE.CanvasTexture;
  private currentFaceMode: FaceMode | null = 'NORMAL';

  private labelCtx: CanvasRenderingContext2D;
  private labelTexture: THREE.CanvasTexture;
  public labelSprite: THREE.Sprite;
  private lastRenderedRank: number = -1;
  private lastRenderedState: RacerState = 'WAITING';
  private lastRenderedHighlight: boolean = false;
  private lastRenderedBuff: RacerBuffState = 'NONE';
  private _cachedPos: THREE.Vector3;

  // Autonomous Steering & Randomness Parameters
  private baseSpeed: number;
  private wanderPhase1: number;
  private wanderPhase2: number;
  private wanderFreq1: number;
  private wanderFreq2: number;
  private preferredLaneOffset: number;
  private runCyclePhase: number;
  private jumpCooldown: number;
  private ragdollTimer: number = 0;
  private recoverTimer: number = 0;
  private stuckTimer: number = 0;
  private lastProgressZ: number = 0;
  private elapsedTime: number = 0;
  private slowDebuffTimer: number = 0;
  private slowFactor: number = 1.0;
  private turboTimer: number = 0;
  private turboBonus: number = 0;
  private tubeRideTimer: number = 0;
  private waitingIdleTicks: number = 0;

  constructor(
    entry: ParticipantEntry,
    index: number,
    spawnPos: THREE.Vector3,
    world: RAPIER.World,
    scene: THREE.Scene,
    mapTheme: MapTheme = 'PLAYGROUND',
    lowCostMode: boolean = false
  ) {
    this.id = entry.id;
    this.name = entry.name;
    this.color = entry.color;
    this.accentColor = entry.accentColor;
    this.isKartMode = mapTheme === 'DINOSAUR';
    this.isJellybean = mapTheme === 'FALLGUYS';
    this.mapTheme = mapTheme;
    this.lowCostMode = lowCostMode;
    this.world = world;
    this.scene = scene;
    this.rank = index + 1;
    this._cachedPos = spawnPos.clone();

    // Autonomous AI individual traits (Kart mode races substantially faster!)
    this.baseSpeed = this.isKartMode
      ? 18.0 + Math.random() * 2.1
      : 10.6 + Math.random() * 1.4;
    this.wanderPhase1 = Math.random() * Math.PI * 2;
    this.wanderPhase2 = Math.random() * Math.PI * 2;
    this.wanderFreq1 = (this.isKartMode ? 1.35 : 1.1) + Math.random() * 0.9;
    this.wanderFreq2 = (this.isKartMode ? 2.6 : 2.3) + Math.random() * 1.2;
    this.preferredLaneOffset = (Math.random() - 0.5) * 8.5;
    this.runCyclePhase = Math.random() * Math.PI * 2;
    this.jumpCooldown = 1.2 + Math.random() * 2.4;

    const torsoGroup = makeCollisionGroups(GROUP_TORSO, GROUP_ENV | GROUP_TORSO);
    const limbGroup = makeCollisionGroups(GROUP_LIMB, GROUP_ENV);

    // 1. Torso RigidBody (Core body + smooth lower foot collider)
    const torsoDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
      .setLinearDamping(0.65)
      .setAngularDamping(1.8)
      .setCcdEnabled(!lowCostMode);
    this.torsoBody = world.createRigidBody(torsoDesc);

    const torsoColDesc = RAPIER.ColliderDesc.cuboid(0.38, 0.42, 0.21)
      .setMass(3.2)
      .setRestitution(0.38)
      .setFriction(0.15)
      .setCollisionGroups(torsoGroup);
    world.createCollider(torsoColDesc, this.torsoBody);

    // Lower foot sphere collider attached to torso so upright running glides smoothly
    const footSphereDesc = RAPIER.ColliderDesc.ball(0.31)
      .setTranslation(0, -0.76, 0)
      .setMass(0.8)
      .setRestitution(0.2)
      .setFriction(0.04)
      .setCollisionGroups(torsoGroup);
    world.createCollider(footSphereDesc, this.torsoBody);

    // 2. Head RigidBody
    const headDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnPos.x, spawnPos.y + 0.76, spawnPos.z)
      .setLinearDamping(0.8)
      .setAngularDamping(2.0);
    this.headBody = world.createRigidBody(headDesc);
    const headCol = RAPIER.ColliderDesc.cuboid(0.26, 0.26, 0.26)
      .setMass(0.25)
      .setRestitution(0.45)
      .setFriction(0.2)
      .setCollisionGroups(limbGroup);
    this.limbColliders.push(world.createCollider(headCol, this.headBody));

    // 3. Left & Right Arm/Leg RigidBodies
    const createLimbBody = (offsetX: number, offsetY: number, hx: number, hy: number, hz: number) => {
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x + offsetX, spawnPos.y + offsetY, spawnPos.z)
        .setLinearDamping(0.7)
        .setAngularDamping(1.8);
      const body = world.createRigidBody(desc);
      const col = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setMass(0.2)
        .setRestitution(0.35)
        .setFriction(0.2)
        .setCollisionGroups(limbGroup);
      this.limbColliders.push(world.createCollider(col, body));
      return body;
    };

    this.leftArmBody = createLimbBody(-0.56, 0.02, 0.15, 0.36, 0.15);
    this.rightArmBody = createLimbBody(0.56, 0.02, 0.15, 0.36, 0.15);
    this.leftLegBody = createLimbBody(-0.2, -0.72, 0.16, 0.34, 0.16);
    this.rightLegBody = createLimbBody(0.2, -0.72, 0.16, 0.34, 0.16);

    if (lowCostMode) {
      this.setLimbsCollisionEnabled(false);
    }

    // 4. Create Rapier ImpulseJoints connecting R6 parts
    const neckData = RAPIER.JointData.spherical(
      { x: 0, y: 0.46, z: 0 },
      { x: 0, y: -0.28, z: 0 }
    );
    this.neckJoint = world.createImpulseJoint(
      neckData,
      this.torsoBody,
      this.headBody,
      true
    ) as RAPIER.SphericalImpulseJoint;
    this.neckJoint.setContactsEnabled(false);

    const createRevoluteLimbJoint = (
      body2: RAPIER.RigidBody,
      anchor1: { x: number; y: number; z: number },
      anchor2: { x: number; y: number; z: number },
      minAngle: number,
      maxAngle: number
    ) => {
      const data = RAPIER.JointData.revolute(anchor1, anchor2, { x: 1, y: 0, z: 0 });
      const joint = world.createImpulseJoint(
        data,
        this.torsoBody,
        body2,
        true
      ) as RAPIER.RevoluteImpulseJoint;
      joint.setContactsEnabled(false);
      joint.setLimits(minAngle, maxAngle);
      return joint;
    };

    this.leftShoulderJoint = createRevoluteLimbJoint(
      this.leftArmBody,
      { x: -0.55, y: 0.3, z: 0 },
      { x: 0, y: 0.28, z: 0 },
      -2.5,
      2.5
    );
    this.rightShoulderJoint = createRevoluteLimbJoint(
      this.rightArmBody,
      { x: 0.55, y: 0.3, z: 0 },
      { x: 0, y: 0.28, z: 0 },
      -2.5,
      2.5
    );
    this.leftHipJoint = createRevoluteLimbJoint(
      this.leftLegBody,
      { x: -0.2, y: -0.43, z: 0 },
      { x: 0, y: 0.28, z: 0 },
      -1.7,
      1.7
    );
    this.rightHipJoint = createRevoluteLimbJoint(
      this.rightLegBody,
      { x: 0.2, y: -0.43, z: 0 },
      { x: 0, y: 0.28, z: 0 },
      -1.7,
      1.7
    );

    // 5. Three.js Meshes, Skin, Kart/Pool/Taekwondo Outfit & Nameplate
    const visuals = createRacerVisuals(scene, this.color, this.accentColor, mapTheme, lowCostMode);
    this.torsoMesh = visuals.torsoMesh;
    this.headMesh = visuals.headMesh;
    this.leftArmMesh = visuals.leftArmMesh;
    this.rightArmMesh = visuals.rightArmMesh;
    this.leftLegMesh = visuals.leftLegMesh;
    this.rightLegMesh = visuals.rightLegMesh;
    this.selectionRing = visuals.selectionRing;
    this.kartWheels = visuals.kartWheels;
    this.kartFlameMesh = visuals.kartFlameMesh;
    this.faceCtx = visuals.faceCtx;
    this.faceTexture = visuals.faceTexture;
    this.labelCtx = visuals.labelCtx;
    this.labelTexture = visuals.labelTexture;
    this.labelSprite = visuals.labelSprite;

    this.updateBillboardLabel(true);
    this.syncVisuals(false);
  }

  private setLimbsCollisionEnabled(enabled: boolean): void {
    if (this.limbsCollisionEnabled === enabled) return;
    this.limbsCollisionEnabled = enabled;
    const groups = makeCollisionGroups(GROUP_LIMB, enabled ? GROUP_ENV : 0);
    for (const col of this.limbColliders) {
      col.setCollisionGroups(groups);
    }
  }

  private drawFaceTexture(mode: FaceMode): void {
    if (this.currentFaceMode === mode) return;
    this.currentFaceMode = mode;
    drawRacerFaceTexture(this.faceCtx, this.faceTexture, mode, this.isJellybean);
  }

  public applySlowDebuff(duration: number = 2.4, factor: number = 0.44): void {
    if (this.state === 'FINISHED') return;
    this.slowDebuffTimer = Math.max(this.slowDebuffTimer, duration);
    this.slowFactor = Math.min(this.slowFactor, factor);
    const vel = this.torsoBody.linvel();
    this.torsoBody.setLinvel({ x: vel.x * 0.6, y: vel.y, z: vel.z * 0.55 }, true);
    this.updateBillboardLabel();
  }

  public applyTurboBoost(duration: number = 1.65, bonus: number = 13.0): void {
    if (this.state === 'FINISHED') return;
    this.turboTimer = Math.max(this.turboTimer, duration);
    this.turboBonus = Math.max(this.turboBonus, bonus);
    this.slowDebuffTimer = 0;
    this.slowFactor = 1.0;
    this.torsoBody.applyImpulse({ x: 0, y: 1.5, z: 22 }, true);
    this.updateBillboardLabel();
  }

  public mountTube(colorHex: number = 0xff5fa2, duration: number = 5.6): boolean {
    if (this.state === 'FINISHED' || this.state === 'RAGDOLL') return false;
    if (this.tubeRideTimer > 0.6) return false;
    this.tubeRideTimer = duration;
    this.slowDebuffTimer = 0;
    this.slowFactor = 1.0;

    if (!this.rideTubeGroup) {
      this.rideTubeGroup = createRideTubeAttachment(colorHex);
      this.torsoMesh.add(this.rideTubeGroup);
    } else {
      this.rideTubeGroup.visible = true;
    }

    this.torsoBody.applyImpulse({ x: 0, y: 4.5, z: 10 }, true);
    this.updateBillboardLabel();
    return true;
  }

  public dismountTube(): void {
    if (this.tubeRideTimer <= 0 && (!this.rideTubeGroup || !this.rideTubeGroup.visible)) return;
    this.tubeRideTimer = 0;
    if (this.rideTubeGroup) {
      this.rideTubeGroup.visible = false;
    }
    this.updateBillboardLabel();
  }

  public isRidingTube(): boolean {
    return this.tubeRideTimer > 0;
  }

  public applyWavePush(forceX: number, forceZ: number, isBigWave: boolean): void {
    if (this.state === 'FINISHED') return;
    if (this.isRidingTube()) {
      // Tube riders glide/surf high over waves with reduced sideways knockback
      this.torsoBody.applyImpulse(
        {
          x: forceX * 0.4,
          y: isBigWave ? 11.5 : 0,
          z: isBigWave ? 7.0 : forceZ * 0.45,
        },
        true
      );
      return;
    }
    if (isBigWave) {
      this.triggerRagdoll(
        {
          x: forceX * 0.72 + (Math.random() - 0.5) * 6,
          y: 17 + Math.random() * 5,
          z: forceZ * 0.5 - 4,
        },
        undefined,
        1.05
      );
    } else {
      this.torsoBody.applyImpulse({ x: forceX, y: 0, z: forceZ }, true);
    }
  }

  public isSlowed(): boolean {
    return this.slowDebuffTimer > 0;
  }

  public isBoosted(): boolean {
    return this.turboTimer > 0;
  }

  public updateBillboardLabel(force: boolean = false): void {
    const buffState: RacerBuffState =
      this.tubeRideTimer > 0
        ? 'TUBE'
        : this.slowDebuffTimer > 0
        ? 'SLOW'
        : this.turboTimer > 0
        ? 'TURBO'
        : 'NONE';
    if (
      !force &&
      this.lastRenderedRank === this.rank &&
      this.lastRenderedState === this.state &&
      this.lastRenderedHighlight === this.isTargetRankCandidate &&
      this.lastRenderedBuff === buffState
    ) {
      return;
    }
    this.lastRenderedRank = this.rank;
    this.lastRenderedState = this.state;
    this.lastRenderedHighlight = this.isTargetRankCandidate;
    this.lastRenderedBuff = buffState;

    drawRacerBillboardLabel(this.labelCtx, this.labelTexture, {
      name: this.name,
      color: this.color,
      rank: this.rank,
      state: this.state,
      isTargetRankCandidate: this.isTargetRankCandidate,
      buffState,
    });
  }

  public refreshCachedPosition(): THREE.Vector3 {
    const t = this.torsoBody.translation();
    this._cachedPos.set(t.x, t.y, t.z);
    return this._cachedPos;
  }

  public getPosition(): THREE.Vector3 {
    return this._cachedPos;
  }

  public triggerRagdoll(
    impulse: { x: number; y: number; z: number },
    torqueImpulse?: { x: number; y: number; z: number },
    duration: number = 1.25
  ): void {
    if (this.state === 'FINISHED') return;

    this.dismountTube();
    if (this.lowCostMode) {
      this.setLimbsCollisionEnabled(true);
    }

    if (this.state !== 'RAGDOLL') {
      this.ragdollCount++;
      this.drawFaceTexture('DIZZY');
    }

    this.state = 'RAGDOLL';
    this.ragdollTimer = Math.max(this.ragdollTimer, duration);

    this.torsoBody.applyImpulse(impulse, true);

    const tx = torqueImpulse ? torqueImpulse.x : (Math.random() - 0.5) * 14;
    const ty = torqueImpulse ? torqueImpulse.y : (Math.random() - 0.5) * 10;
    const tz = torqueImpulse ? torqueImpulse.z : (Math.random() - 0.5) * 14;
    this.torsoBody.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);

    this.configureNeckMotor(RAPIER.JointAxis.AngX, 0, 3, 0.8);
    this.configureNeckMotor(RAPIER.JointAxis.AngY, 0, 3, 0.8);
    this.configureNeckMotor(RAPIER.JointAxis.AngZ, 0, 3, 0.8);

    this.leftShoulderJoint.configureMotorPosition(0, 2, 0.4);
    this.rightShoulderJoint.configureMotorPosition(0, 2, 0.4);
    this.leftHipJoint.configureMotorPosition(0, 2, 0.4);
    this.rightHipJoint.configureMotorPosition(0, 2, 0.4);

    const flail = () => ({
      x: (Math.random() - 0.5) * 1.4,
      y: 0.4 + Math.random() * 1.2,
      z: (Math.random() - 0.5) * 1.4,
    });
    this.leftArmBody.applyImpulse(flail(), true);
    this.rightArmBody.applyImpulse(flail(), true);
    this.leftLegBody.applyImpulse(flail(), true);
    this.rightLegBody.applyImpulse(flail(), true);

    this.updateBillboardLabel();
  }

  public setAllBodiesLinvel(vel: { x: number; y: number; z: number }): void {
    this.torsoBody.setLinvel(vel, true);
    this.headBody.setLinvel(vel, true);
    this.leftArmBody.setLinvel(vel, true);
    this.rightArmBody.setLinvel(vel, true);
    this.leftLegBody.setLinvel(vel, true);
    this.rightLegBody.setLinvel(vel, true);
  }

  public teleportTo(pos: THREE.Vector3): void {
    const resetBody = (
      body: RAPIER.RigidBody,
      ox: number,
      oy: number,
      oz: number
    ) => {
      body.setTranslation({ x: pos.x + ox, y: pos.y + oy, z: pos.z + oz }, true);
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setLinvel({ x: 0, y: 0, z: 4 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };

    resetBody(this.torsoBody, 0, 0, 0);
    resetBody(this.headBody, 0, 0.76, 0);
    resetBody(this.leftArmBody, -0.56, 0.02, 0);
    resetBody(this.rightArmBody, 0.56, 0.02, 0);
    resetBody(this.leftLegBody, -0.2, -0.72, 0);
    resetBody(this.rightLegBody, 0.2, -0.72, 0);
    this._cachedPos.copy(pos);

    this.state = 'RUNNING';
    if (this.lowCostMode) {
      this.setLimbsCollisionEnabled(false);
    }
    this.ragdollTimer = 0;
    this.slowDebuffTimer = 0;
    this.slowFactor = 1.0;
    this.turboTimer = 0;
    this.turboBonus = 0;
    this.dismountTube();
    this.drawFaceTexture('NORMAL');
    this.updateBillboardLabel();
  }

  public updateAIAndPhysics(
    dt: number,
    totalRacers: number,
    trackCenterXAtZ: (z: number) => number,
    trackHalfWidthAtZ: (z: number) => number,
    trackHeightAtZ: (z: number) => number,
    onJumpCallback?: () => void,
    onRespawnCallback?: (pos: THREE.Vector3) => void,
    finishZ: number = 132
  ): void {
    this.elapsedTime += dt;
    const pos = this.torsoBody.translation();
    this._cachedPos.set(pos.x, pos.y, pos.z);
    const vel = this.torsoBody.linvel();

    if (this.slowDebuffTimer > 0) {
      this.slowDebuffTimer = Math.max(0, this.slowDebuffTimer - dt);
      if (this.slowDebuffTimer === 0) {
        this.slowFactor = 1.0;
      }
    }
    if (this.turboTimer > 0) {
      this.turboTimer = Math.max(0, this.turboTimer - dt);
      if (this.turboTimer === 0) {
        this.turboBonus = 0;
      }
    }
    if (this.tubeRideTimer > 0) {
      this.tubeRideTimer = Math.max(0, this.tubeRideTimer - dt);
      if (this.rideTubeGroup && this.rideTubeGroup.visible) {
        this.rideTubeGroup.position.y = -0.32 + Math.sin(this.elapsedTime * 8.5) * 0.06;
      }
      if (this.tubeRideTimer === 0) {
        this.dismountTube();
      }
    }

    if (this.isKartMode) {
      const wheelSpin = Math.max(0, vel.z) * dt * 3.4;
      for (const w of this.kartWheels) {
        w.rotation.x += wheelSpin;
      }
      if (this.kartFlameMesh) {
        const showFlame = this.turboTimer > 0 && this.state === 'RUNNING';
        this.kartFlameMesh.visible = showFlame;
        if (showFlame) {
          const pulse = 0.85 + Math.sin(this.elapsedTime * 32) * 0.25;
          this.kartFlameMesh.scale.set(1, pulse, 1);
        }
      }
    }

    if (this.state === 'WAITING') {
      this.waitingIdleTicks++;
      if (!this.lowCostMode || this.waitingIdleTicks < 8 || this.waitingIdleTicks % 4 === 0) {
        this.maintainUprightPose(0, dt, 0.4);
      }
      return;
    }

    if (this.state === 'FINISHED') {
      const expectedFinishY = trackHeightAtZ(pos.z);
      const trackEndZ = finishZ + 15.0;
      if (pos.y < expectedFinishY - 2.0 || pos.z > trackEndZ) {
        const safeFinishZ = finishZ + 6.0;
        const safeFinishCX = trackCenterXAtZ(safeFinishZ);
        this.teleportTo(
          new THREE.Vector3(
            safeFinishCX + (Math.random() - 0.5) * 8.0,
            trackHeightAtZ(safeFinishZ) + 1.8,
            safeFinishZ
          )
        );
        this.state = 'FINISHED';
        this.drawFaceTexture('WINNER');
        this.updateBillboardLabel(true);
        return;
      }

      this.maintainUprightPose(0, dt, 0.6);
      this.torsoBody.applyImpulse(
        {
          x: -vel.x * 2.5 * dt,
          y: 0,
          z: (pos.z > finishZ + 12.5 ? -vel.z * 5.0 - 8.0 : -vel.z * 2.8) * dt,
        },
        true
      );
      if (Math.random() < dt * 1.8 && Math.abs(vel.y) < 1.2) {
        this.torsoBody.applyImpulse({ x: 0, y: 18, z: 0 }, true);
      }
      return;
    }

    // Check out-of-bounds (sideways escape or fall) & respawn
    const centerX = trackCenterXAtZ(pos.z);
    const halfWidth = trackHalfWidthAtZ(pos.z);
    const lateralDist = Math.abs(pos.x - centerX);
    const expectedFloorY = trackHeightAtZ(pos.z);

    const lastSectionStartZ = finishZ - 34;
    const inLastSection = pos.z >= lastSectionStartZ;
    const isOffSide = lateralDist > halfWidth + 0.95;
    const isFallen = inLastSection
      ? pos.y < expectedFloorY - 2.2
      : pos.y < expectedFloorY - 8.5;

    if (isFallen || isOffSide) {
      const safeZ = inLastSection ? finishZ - 32 : Math.max(4, pos.z - 4);
      const safeCX = trackCenterXAtZ(safeZ);
      const safeSpan = Math.max(2.0, trackHalfWidthAtZ(safeZ) - 2.5);
      const respawnPos = new THREE.Vector3(
        safeCX + (Math.random() - 0.5) * safeSpan,
        trackHeightAtZ(safeZ) + 2.8,
        safeZ
      );
      this.teleportTo(respawnPos);
      if (onRespawnCallback) onRespawnCallback(respawnPos);
      return;
    }

    // Handle RAGDOLL state timer
    if (this.state === 'RAGDOLL') {
      this.ragdollTimer -= dt;
      if (this.ragdollTimer <= 0) {
        this.state = 'RECOVERING';
        this.recoverTimer = 0.42;
        if (this.lowCostMode) {
          this.setLimbsCollisionEnabled(false);
        }
        this.drawFaceTexture('NORMAL');
        this.updateBillboardLabel();
      }
      return;
    }

    // Handle RECOVERING state
    if (this.state === 'RECOVERING') {
      this.recoverTimer -= dt;
      this.maintainUprightPose(0, dt, 0.5);
      if (this.recoverTimer <= 0) {
        this.state = 'RUNNING';
        this.updateBillboardLabel();
      }
    }

    // Autonomous RUNNING Steering + Randomness along curved track!
    const lookAheadCenterX = trackCenterXAtZ(pos.z + (this.isKartMode ? 7.0 : 5.0));
    const safeHalfWidth = Math.max(2.2, halfWidth - 1.35);

    const wanderOffset =
      Math.sin(this.elapsedTime * this.wanderFreq1 + this.wanderPhase1) * 3.4 +
      Math.cos(this.elapsedTime * this.wanderFreq2 + this.wanderPhase2) * 1.9 +
      this.preferredLaneOffset * (safeHalfWidth / 8.0);

    const clampedOffset = Math.max(-safeHalfWidth, Math.min(safeHalfWidth, wanderOffset));
    const targetWorldX = lookAheadCenterX + clampedOffset;
    const lateralError = targetWorldX - pos.x;

    // Rubber-banding comeback factor (trailing racers get a subtle adrenaline boost)
    const rankRatio = totalRacers > 1 ? (this.rank - 1) / (totalRacers - 1) : 0;
    const comebackMultiplier = 1.0 + rankRatio * 0.19;
    const activeSlow = this.slowDebuffTimer > 0 ? this.slowFactor : 1.0;
    const activeTurbo = (this.turboTimer > 0 ? this.turboBonus : 0) + (this.tubeRideTimer > 0 ? 4.3 : 0);
    const desiredForwardSpeed = (this.baseSpeed * comebackMultiplier + activeTurbo) * activeSlow;
    const maxLat = this.isKartMode ? 11.0 : 8.0;
    const desiredLateralSpeed = Math.max(
      -maxLat,
      Math.min(maxLat, lateralError * (this.isKartMode ? 2.8 : 2.2))
    );

    const forceZ = (desiredForwardSpeed - vel.z) * (this.isKartMode ? 20.0 : 16.5);
    const forceX = (desiredLateralSpeed - vel.x) * (this.isKartMode ? 17.5 : 14.5);

    this.torsoBody.applyImpulse(
      {
        x: forceX * dt,
        y: 0,
        z: Math.max(-18, Math.min(this.isKartMode ? 52 : 28, forceZ)) * dt,
      },
      true
    );

    const yawAngle = Math.atan2(vel.x * 0.6, Math.max(2.0, vel.z));
    const currentSpeed = Math.hypot(vel.x, vel.z);
    this.maintainUprightPose(yawAngle, dt, currentSpeed);

    if (!this.isKartMode) {
      this.jumpCooldown -= dt;
      const floorDelta = pos.y - expectedFloorY;
      const nearGround = floorDelta > 0.2 && floorDelta < 2.15 && Math.abs(vel.y) < 2.2;
      if (this.jumpCooldown <= 0 && nearGround) {
        this.jumpCooldown = 1.4 + Math.random() * 2.4;
        const jumpImpulseY = 18 + Math.random() * 8;
        this.torsoBody.applyImpulse(
          {
            x: (Math.random() - 0.5) * 4,
            y: jumpImpulseY,
            z: 5,
          },
          true
        );
        if (onJumpCallback && Math.random() < 0.3) {
          onJumpCallback();
        }
      }
    }

    if (
      !hasFloorPitAtZ(pos.z, this.mapTheme) &&
      lateralDist <= halfWidth + 0.15 &&
      pos.y < expectedFloorY + 0.55
    ) {
      this.torsoBody.setTranslation(
        { x: pos.x, y: expectedFloorY + 1.15, z: pos.z },
        true
      );
      this._cachedPos.set(pos.x, expectedFloorY + 1.15, pos.z);
      if (vel.y < 0) {
        this.torsoBody.setLinvel({ x: vel.x, y: 2.5, z: vel.z }, true);
      }
    }

    if (Math.abs(pos.z - this.lastProgressZ) < 0.35) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.2) {
        this.stuckTimer = 0;
        const centerPull = (centerX - pos.x) * 3.2;
        this.torsoBody.applyImpulse(
          {
            x: Math.max(-18, Math.min(18, centerPull)),
            y: 25,
            z: 14,
          },
          true
        );
      }
    } else {
      this.lastProgressZ = pos.z;
      this.stuckTimer = 0;
    }
  }

  private maintainUprightPose(targetYaw: number, dt: number, speed: number): void {
    const currentRot = this.torsoBody.rotation();
    const currentQuat = new THREE.Quaternion(
      currentRot.x,
      currentRot.y,
      currentRot.z,
      currentRot.w
    );
    const forwardTilt = this.isKartMode
      ? Math.min(0.11, speed * 0.006)
      : Math.min(0.18, speed * 0.014);
    const targetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(forwardTilt, targetYaw, 0, 'YXZ')
    );
    currentQuat.slerp(targetQuat, Math.min(1, dt * 12));

    this.torsoBody.setRotation(
      {
        x: currentQuat.x,
        y: currentQuat.y,
        z: currentQuat.z,
        w: currentQuat.w,
      },
      true
    );

    const angVel = this.torsoBody.angvel();
    this.torsoBody.setAngvel(
      {
        x: angVel.x * 0.65,
        y: angVel.y * 0.65,
        z: angVel.z * 0.65,
      },
      true
    );

    this.configureNeckMotor(RAPIER.JointAxis.AngX, -forwardTilt * 0.5, 140, 14);
    this.configureNeckMotor(RAPIER.JointAxis.AngY, 0, 140, 14);
    this.configureNeckMotor(RAPIER.JointAxis.AngZ, 0, 140, 14);

    if (this.isKartMode) {
      const steerWiggle = Math.sin(this.elapsedTime * 6.0) * 0.08;
      this.leftShoulderJoint.configureMotorPosition(-0.88 + steerWiggle, 180, 18);
      this.rightShoulderJoint.configureMotorPosition(-0.88 - steerWiggle, 180, 18);
      this.leftHipJoint.configureMotorPosition(-0.48, 185, 18);
      this.rightHipJoint.configureMotorPosition(-0.48, 185, 18);
    } else {
      this.runCyclePhase += dt * (8.5 + speed * 0.65);
      const swing = Math.sin(this.runCyclePhase) * Math.min(1.15, 0.35 + speed * 0.075);

      this.leftShoulderJoint.configureMotorPosition(swing, 160, 16);
      this.rightShoulderJoint.configureMotorPosition(-swing, 160, 16);
      this.leftHipJoint.configureMotorPosition(-swing, 185, 18);
      this.rightHipJoint.configureMotorPosition(swing, 185, 18);
    }
  }

  private configureNeckMotor(
    axis: RAPIER.JointAxis,
    targetPos: number,
    stiffness: number,
    damping: number
  ): void {
    const joint = this.neckJoint as unknown as {
      configureMotorPosition?: (
        axis: RAPIER.JointAxis,
        targetPos: number,
        stiffness: number,
        damping: number
      ) => void;
      rawSet?: {
        jointConfigureMotorPosition: (
          handle: number,
          axis: RAPIER.JointAxis,
          targetPos: number,
          stiffness: number,
          damping: number
        ) => void;
      };
      handle?: number;
    };

    if (typeof joint.configureMotorPosition === 'function') {
      joint.configureMotorPosition(axis, targetPos, stiffness, damping);
    } else if (joint.rawSet && typeof joint.handle === 'number') {
      joint.rawSet.jointConfigureMotorPosition(
        joint.handle,
        axis,
        targetPos,
        stiffness,
        damping
      );
    }
  }

  public markFinished(order: number, timeSec: number): void {
    if (this.state === 'FINISHED') return;
    this.state = 'FINISHED';
    this.finishOrder = order;
    this.finishTime = timeSec;
    this.dismountTube();
    if (this.lowCostMode) {
      this.setLimbsCollisionEnabled(false);
    }
    this.drawFaceTexture('WINNER');
    this.updateBillboardLabel(true);
  }

  public syncVisuals(isFocused: boolean, cameraPos?: THREE.Vector3): void {
    const syncMeshToBody = (mesh: THREE.Mesh, body: RAPIER.RigidBody) => {
      const p = body.translation();
      const r = body.rotation();
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    };

    const torsoPos = this.torsoBody.translation();
    this._cachedPos.set(torsoPos.x, torsoPos.y, torsoPos.z);

    // Safety leash: if an extreme solver spike separates a limb > 2.2m, snap it back
    if (!this.lowCostMode || this.state === 'RAGDOLL' || this.state === 'RECOVERING') {
      const guardLimb = (body: RAPIER.RigidBody, ox: number, oy: number, oz: number) => {
        const lp = body.translation();
        const distSq =
          (lp.x - torsoPos.x) ** 2 + (lp.y - torsoPos.y) ** 2 + (lp.z - torsoPos.z) ** 2;
        if (distSq > 4.8 || Number.isNaN(lp.x)) {
          body.setTranslation(
            { x: torsoPos.x + ox, y: torsoPos.y + oy, z: torsoPos.z + oz },
            true
          );
          body.setLinvel(this.torsoBody.linvel(), true);
        }
      };

      guardLimb(this.headBody, 0, 0.76, 0);
      guardLimb(this.leftArmBody, -0.56, 0.02, 0);
      guardLimb(this.rightArmBody, 0.56, 0.02, 0);
      guardLimb(this.leftLegBody, -0.2, -0.72, 0);
      guardLimb(this.rightLegBody, 0.2, -0.72, 0);
    }

    const torsoRot = this.torsoBody.rotation();
    this.torsoMesh.position.set(torsoPos.x, torsoPos.y, torsoPos.z);
    this.torsoMesh.quaternion.set(torsoRot.x, torsoRot.y, torsoRot.z, torsoRot.w);
    syncMeshToBody(this.headMesh, this.headBody);
    syncMeshToBody(this.leftArmMesh, this.leftArmBody);
    syncMeshToBody(this.rightArmMesh, this.rightArmBody);
    syncMeshToBody(this.leftLegMesh, this.leftLegBody);
    syncMeshToBody(this.rightLegMesh, this.rightLegBody);

    const camDist = cameraPos
      ? Math.hypot(
          cameraPos.x - torsoPos.x,
          cameraPos.y - torsoPos.y,
          cameraPos.z - torsoPos.z
        )
      : 14;
    const distScale = Math.max(
      isFocused ? 0.85 : 0.45,
      Math.min(2.15, camDist / 13.2)
    );
    const labelMat = this.labelSprite.material as THREE.SpriteMaterial;
    labelMat.opacity = !isFocused && camDist < 5.2 ? Math.max(0.28, (camDist - 2.0) / 3.2) : 1.0;
    this.labelSprite.scale.set(2.3 * distScale, 0.65 * distScale, 1);
    this.labelSprite.position.set(
      torsoPos.x,
      torsoPos.y + 1.78 + distScale * 0.22,
      torsoPos.z
    );
    this.labelSprite.renderOrder =
      isFocused
        ? 1550
        : this.isTargetRankCandidate
        ? 1450
        : Math.max(100, 1200 - Math.round(camDist * 8));

    this.selectionRing.visible = isFocused || this.isTargetRankCandidate;
    if (this.selectionRing.visible) {
      this.selectionRing.position.set(torsoPos.x, torsoPos.y - 0.98, torsoPos.z);
      const ringMat = this.selectionRing.material as THREE.MeshBasicMaterial;
      ringMat.color.setHex(isFocused ? 0x38bdf8 : 0xfacc15);
    }

    this.updateBillboardLabel();
  }

  public dispose(): void {
    this.scene.remove(
      this.torsoMesh,
      this.headMesh,
      this.leftArmMesh,
      this.rightArmMesh,
      this.leftLegMesh,
      this.rightLegMesh,
      this.selectionRing,
      this.labelSprite
    );
    this.faceTexture.dispose();
    this.labelTexture.dispose();

    this.world.removeImpulseJoint(this.neckJoint, true);
    this.world.removeImpulseJoint(this.leftShoulderJoint, true);
    this.world.removeImpulseJoint(this.rightShoulderJoint, true);
    this.world.removeImpulseJoint(this.leftHipJoint, true);
    this.world.removeImpulseJoint(this.rightHipJoint, true);

    this.world.removeRigidBody(this.headBody);
    this.world.removeRigidBody(this.leftArmBody);
    this.world.removeRigidBody(this.rightArmBody);
    this.world.removeRigidBody(this.leftLegBody);
    this.world.removeRigidBody(this.rightLegBody);
    this.world.removeRigidBody(this.torsoBody);
  }
}
