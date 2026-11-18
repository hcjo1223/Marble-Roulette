import * as THREE from 'three';
import type { FlickMode } from '../../types';
import type { RagdollRacer } from '../../entities/RagdollRacer';
import type { ParticleSystem } from '../../effects/ParticleSystem';
import type { SoundManager } from '../../audio/SoundManager';
import { getTrackCenterX, getTrackHeightAtZ } from '../courseMath';
import type { CourseBuildContext, GiantFlickHandData, GiantTrapKind } from '../courseTypes';
import { createPlaygroundBossCharacter } from './bossCharacterModel';
import {
  createComicFlickSprite,
  createGiantDinoChargeTrap,
  createGiantFallguysPunchTrap,
  createGiantFingerHand,
  createGiantPoolSplashTrap,
} from './giantTrapModels';

export class GiantTrapController {
  private ctx: CourseBuildContext;
  private flickMode: FlickMode;
  private onPoolImpactSplash?: (
    pos: THREE.Vector3,
    color: string,
    particles: ParticleSystem
  ) => void;

  private giantFlickHands: GiantFlickHandData[] = [];
  private flickedRacerIds: Set<string> = new Set();

  public onFinishFlick?: (racer: RagdollRacer, flickNumber: number, isManual: boolean) => void;

  constructor(
    ctx: CourseBuildContext,
    flickMode: FlickMode,
    onPoolImpactSplash?: (pos: THREE.Vector3, color: string, particles: ParticleSystem) => void
  ) {
    this.ctx = ctx;
    this.flickMode = flickMode;
    this.onPoolImpactSplash = onPoolImpactSplash;
  }

  private getGiantTrapKind(): GiantTrapKind {
    switch (this.ctx.mapTheme) {
      case 'PLAYGROUND':
        return 'BASHER';
      case 'DINOSAUR':
        return 'DINO_CHARGE';
      case 'POOL':
        return 'POOL_SPLASH';
      case 'FALLGUYS':
        return 'FALLGUYS_PUNCH';
      default:
        return 'FINGER';
    }
  }

  private getTrapBaseScale(kind: GiantTrapKind, isManual: boolean): number {
    switch (kind) {
      case 'BASHER':
        return isManual ? 1.65 : 1.95;
      case 'DINO_CHARGE':
        return 1.28;
      case 'POOL_SPLASH':
        return 1.42;
      case 'FALLGUYS_PUNCH':
        return 1.48;
      default:
        return 1.38;
    }
  }

  private resetTrapToIdlePose(hand: GiantFlickHandData): void {
    hand.middleFingerPivot.rotation.set(-1.25, 0, 0);
    hand.charBodyPivot?.rotation.set(0, 0, 0);
    hand.charLeftArmPivot?.rotation.set(0, 0, 0);
    hand.charRightArmPivot?.rotation.set(0, 0, 0);
    hand.charLeftLegPivot?.rotation.set(0, 0, 0);
    hand.charRightLegPivot?.rotation.set(0, 0, 0);
    hand.dinoBodyPivot?.rotation.set(0, 0, 0);
    if (hand.dinoLeftLeg && hand.dinoRightLeg) {
      hand.dinoLeftLeg.rotation.x = 0;
      hand.dinoRightLeg.rotation.x = 0;
    }
    hand.dinoHeadPivot?.rotation.set(0, 0, 0);
    hand.bucketPivot?.rotation.set(-0.22, 0, 0);
    if (hand.splashJetGroup) {
      hand.splashJetGroup.visible = false;
      hand.splashJetGroup.scale.setScalar(1);
      hand.splashJetGroup.rotation.set(0, 0, 0);
    }
    if (hand.springGroup) {
      hand.springGroup.scale.set(1, 1, 1);
    }
    if (hand.gloveGroup) {
      hand.gloveGroup.position.set(0, 0, 0.1);
    }
  }

  private placeTrapAtIdle(hand: GiantFlickHandData): void {
    const hoverZ = this.ctx.finishZ - 4.0;
    const baseScale = this.getTrapBaseScale(hand.trapKind, false);
    hand.root.scale.setScalar(baseScale);
    this.resetTrapToIdlePose(hand);

    if (hand.trapKind === 'BASHER') {
      const hoverCX = getTrackCenterX(hoverZ) + 6.0;
      const hoverY = getTrackHeightAtZ(hoverZ) + 0.1;
      hand.root.position.set(hoverCX, hoverY, hoverZ);
      hand.root.rotation.set(0, Math.PI + 0.48, 0);
    } else if (hand.trapKind === 'DINO_CHARGE') {
      const hoverCX = getTrackCenterX(hoverZ) + 6.6;
      const hoverY = getTrackHeightAtZ(hoverZ) + 0.08;
      hand.root.position.set(hoverCX, hoverY, hoverZ);
      hand.root.rotation.set(0, Math.PI + 0.55, 0);
    } else if (hand.trapKind === 'POOL_SPLASH') {
      const hoverCX = getTrackCenterX(hoverZ) + 4.8;
      const hoverY = getTrackHeightAtZ(hoverZ) + 6.4;
      hand.root.position.set(hoverCX, hoverY, hoverZ);
      hand.root.rotation.set(0, -0.18, 0);
    } else if (hand.trapKind === 'FALLGUYS_PUNCH') {
      const hoverCX = getTrackCenterX(hoverZ) + 5.6;
      const hoverY = getTrackHeightAtZ(hoverZ) + 4.6;
      hand.root.position.set(hoverCX, hoverY, hoverZ);
      hand.root.rotation.set(-0.22, 0.92, 0);
    } else {
      const hoverCX = getTrackCenterX(hoverZ) + 4.4;
      const hoverY = getTrackHeightAtZ(hoverZ) + 6.8;
      hand.root.position.set(hoverCX, hoverY, hoverZ);
      hand.root.rotation.set(0.16, -0.52, 0.24);
    }
  }

  private prepareTrapForWindup(
    hand: GiantFlickHandData,
    target: RagdollRacer,
    isManual: boolean
  ): void {
    hand.phase = 'WINDUP';
    hand.phaseTimer = 0;
    hand.targetRacer = target;
    hand.isManual = isManual;
    hand.root.visible = true;
    hand.shockwaveMesh.visible = false;
    hand.comicSprite.visible = false;
    this.resetTrapToIdlePose(hand);

    const side = hand.slotIndex === 0 ? 1 : -1;
    const tp = target.getPosition();
    hand.root.scale.setScalar(this.getTrapBaseScale(hand.trapKind, isManual));

    if (hand.trapKind === 'BASHER') {
      const spawnZ = tp.z + (isManual ? 2.2 : 2.8);
      const floorY = getTrackHeightAtZ(spawnZ);
      hand.root.position.set(tp.x + side * (isManual ? 3.4 : 4.2), floorY + 0.1, spawnZ);
      hand.root.rotation.set(
        0,
        Math.atan2(tp.x - hand.root.position.x, tp.z - hand.root.position.z),
        0
      );
    } else if (hand.trapKind === 'DINO_CHARGE') {
      const spawnZ = tp.z + 5.4;
      const floorY = getTrackHeightAtZ(spawnZ);
      hand.root.position.set(tp.x + side * 5.0, floorY + 0.08, spawnZ);
      hand.root.rotation.set(
        0,
        Math.atan2(tp.x - hand.root.position.x, tp.z - hand.root.position.z),
        0
      );
    } else if (hand.trapKind === 'POOL_SPLASH') {
      hand.root.position.set(tp.x + side * 1.4, tp.y + 4.5, tp.z + 1.2);
      hand.root.rotation.set(0, -side * 0.14, 0);
    } else if (hand.trapKind === 'FALLGUYS_PUNCH') {
      hand.root.position.set(tp.x + side * 4.4, tp.y + 2.45, tp.z + 2.0);
      const dx = tp.x - hand.root.position.x;
      const dy = tp.y + 0.55 - hand.root.position.y;
      const dz = tp.z - hand.root.position.z;
      const horiz = Math.max(0.01, Math.hypot(dx, dz));
      hand.root.rotation.set(Math.atan2(dy, horiz), Math.atan2(-dx, -dz), 0);
    } else {
      hand.root.scale.setScalar(1.45);
      hand.root.position.set(tp.x + side * 2.5, tp.y + 4.4, tp.z + 1.2);
      hand.root.rotation.set(0.12, -side * 0.62, side * 0.34);
    }
  }

  public build(): void {
    const trapKind = this.getGiantTrapKind();
    const isPlayground = trapKind === 'BASHER';
    const shockwaveColor =
      trapKind === 'DINO_CHARGE'
        ? 0x4ade80
        : trapKind === 'POOL_SPLASH'
        ? 0x38bdf8
        : trapKind === 'FALLGUYS_PUNCH'
        ? 0xff5fa2
        : 0xfacc15;

    for (let slotIndex = 0; slotIndex < 2; slotIndex++) {
      let root: THREE.Group;
      let middleFingerPivot = new THREE.Group();
      let charParts:
        | {
            bodyPivot: THREE.Group;
            leftArmPivot: THREE.Group;
            rightArmPivot: THREE.Group;
            leftLegPivot: THREE.Group;
            rightLegPivot: THREE.Group;
          }
        | undefined;
      let dinoParts:
        | {
            dinoBodyPivot: THREE.Group;
            dinoLeftLeg?: THREE.Mesh;
            dinoRightLeg?: THREE.Mesh;
            dinoHeadPivot?: THREE.Group;
          }
        | undefined;
      let poolParts:
        | {
            bucketPivot: THREE.Group;
            splashJetGroup: THREE.Group;
          }
        | undefined;
      let punchParts:
        | {
            springGroup: THREE.Group;
            gloveGroup: THREE.Group;
          }
        | undefined;

      if (trapKind === 'BASHER') {
        const built = createPlaygroundBossCharacter();
        root = built.root;
        charParts = built;
      } else if (trapKind === 'DINO_CHARGE') {
        const built = createGiantDinoChargeTrap();
        root = built.root;
        dinoParts = built;
      } else if (trapKind === 'POOL_SPLASH') {
        const built = createGiantPoolSplashTrap();
        root = built.root;
        poolParts = built;
      } else if (trapKind === 'FALLGUYS_PUNCH') {
        const built = createGiantFallguysPunchTrap();
        root = built.root;
        punchParts = built;
      } else {
        const built = createGiantFingerHand();
        root = built.root;
        middleFingerPivot = built.middleFingerPivot;
      }

      root.visible = slotIndex === 0 && this.flickMode !== 'OFF';
      this.ctx.courseGroup.add(root);

      const shockwaveMat = new THREE.MeshBasicMaterial({
        color: shockwaveColor,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shockwaveMesh = new THREE.Mesh(new THREE.RingGeometry(0.45, 1.4, 28), shockwaveMat);
      shockwaveMesh.visible = false;
      this.ctx.courseGroup.add(shockwaveMesh);

      const comicSprite = createComicFlickSprite(this.ctx.mapTheme);
      this.ctx.courseGroup.add(comicSprite);

      const handData: GiantFlickHandData = {
        slotIndex,
        trapKind,
        root,
        middleFingerPivot,
        shockwaveMesh,
        comicSprite,
        phase: 'IDLE',
        phaseTimer: 0,
        targetRacer: null,
        impactPos: new THREE.Vector3(),
        isManual: false,
        isCharacterBasher: isPlayground,
        charBodyPivot: charParts?.bodyPivot,
        charLeftArmPivot: charParts?.leftArmPivot,
        charRightArmPivot: charParts?.rightArmPivot,
        charLeftLegPivot: charParts?.leftLegPivot,
        charRightLegPivot: charParts?.rightLegPivot,
        dinoBodyPivot: dinoParts?.dinoBodyPivot,
        dinoLeftLeg: dinoParts?.dinoLeftLeg,
        dinoRightLeg: dinoParts?.dinoRightLeg,
        dinoHeadPivot: dinoParts?.dinoHeadPivot,
        bucketPivot: poolParts?.bucketPivot,
        splashJetGroup: poolParts?.splashJetGroup,
        springGroup: punchParts?.springGroup,
        gloveGroup: punchParts?.gloveGroup,
      };
      this.placeTrapAtIdle(handData);
      this.giantFlickHands.push(handData);
    }
  }

  public setFlickMode(mode: FlickMode): void {
    this.flickMode = mode;
    if (this.flickMode === 'OFF') {
      for (const h of this.giantFlickHands) {
        if (h.phase === 'IDLE') {
          h.root.visible = false;
        }
      }
    } else {
      const slot0 = this.giantFlickHands[0];
      if (slot0 && slot0.phase === 'IDLE') {
        slot0.root.visible = true;
      }
    }
  }

  private getMaxFlicks(totalRacers: number): number {
    if (this.flickMode === 'OFF' || totalRacers < 2) return 0;
    if (this.flickMode === 'CHAOS') return Math.min(4, totalRacers - 1);
    return Math.min(2, totalRacers - 1);
  }

  public getRemainingFinishFlicks(totalRacers: number): number {
    const maxFlicks = this.getMaxFlicks(totalRacers);
    return Math.max(0, maxFlicks - this.flickedRacerIds.size);
  }

  public hasBeenFlicked(racerId: string): boolean {
    return this.flickedRacerIds.has(racerId);
  }

  public triggerManualLeaderFlick(racers: RagdollRacer[]): RagdollRacer | null {
    const active = racers
      .filter((r) => r.state !== 'FINISHED')
      .sort((a, b) => b.getPosition().z - a.getPosition().z);
    const target = active[0];
    if (!target) return null;

    const hand =
      this.giantFlickHands.find((h) => h.phase === 'IDLE') ||
      this.giantFlickHands.find((h) => h.phase === 'DONE');
    if (!hand) return null;

    this.prepareTrapForWindup(hand, target, true);
    return target;
  }

  public reset(): void {
    this.flickedRacerIds.clear();
    for (const hand of this.giantFlickHands) {
      hand.phase = 'IDLE';
      hand.phaseTimer = 0;
      hand.targetRacer = null;
      hand.isManual = false;
      this.placeTrapAtIdle(hand);
      hand.root.visible = hand.slotIndex === 0 && this.flickMode !== 'OFF';
      hand.shockwaveMesh.visible = false;
      hand.comicSprite.visible = false;
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
    const maxFlicks = this.getMaxFlicks(racers.length);
    const triggerFlickZoneZ = this.ctx.finishZ - 5.8;

    if (isRacing && this.flickMode !== 'OFF' && this.flickedRacerIds.size < maxFlicks) {
      const candidates = racers
        .filter((r) => {
          if (r.state === 'FINISHED' || this.flickedRacerIds.has(r.id)) return false;
          const p = r.getPosition();
          return p.z >= triggerFlickZoneZ && p.z < this.ctx.finishZ - 0.8;
        })
        .sort((a, b) => b.getPosition().z - a.getPosition().z);

      for (const target of candidates) {
        if (this.flickedRacerIds.size >= maxFlicks) break;
        const freeHand = this.giantFlickHands.find((h) => h.phase === 'IDLE');
        if (!freeHand) break;

        this.flickedRacerIds.add(target.id);
        this.prepareTrapForWindup(freeHand, target, false);
      }
    }

    for (const hand of this.giantFlickHands) {
      const side = hand.slotIndex === 0 ? 1 : -1;
      if (hand.phase === 'IDLE') {
        if (
          hand.slotIndex === 0 &&
          this.flickMode !== 'OFF' &&
          this.flickedRacerIds.size < maxFlicks
        ) {
          hand.root.visible = true;
          const hoverZ = this.ctx.finishZ - 4.0;
          if (hand.trapKind === 'BASHER') {
            const hoverCX = getTrackCenterX(hoverZ) + 6.0;
            const hoverY = getTrackHeightAtZ(hoverZ) + 0.1;
            const idleBounce = Math.abs(Math.sin(elapsedTime * 3.6)) * 0.16;
            hand.root.scale.setScalar(this.getTrapBaseScale('BASHER', false));
            hand.root.position.set(hoverCX, hoverY + idleBounce, hoverZ);
            hand.root.rotation.set(0, Math.PI + 0.48 + Math.sin(elapsedTime * 1.4) * 0.14, 0);
            hand.charBodyPivot?.rotation.set(0.04, 0, Math.sin(elapsedTime * 2.4) * 0.05);
            if (hand.charLeftArmPivot && hand.charRightArmPivot) {
              hand.charLeftArmPivot.rotation.x = Math.sin(elapsedTime * 3.6) * 0.25;
              hand.charRightArmPivot.rotation.x = -Math.sin(elapsedTime * 3.6) * 0.25;
            }
            if (hand.charLeftLegPivot && hand.charRightLegPivot) {
              hand.charLeftLegPivot.rotation.x = 0;
              hand.charRightLegPivot.rotation.x = 0;
            }
          } else if (hand.trapKind === 'DINO_CHARGE') {
            const hoverCX = getTrackCenterX(hoverZ) + 6.6;
            const hoverY = getTrackHeightAtZ(hoverZ) + 0.08;
            const stompBounce = Math.abs(Math.sin(elapsedTime * 4.2)) * 0.16;
            hand.root.scale.setScalar(this.getTrapBaseScale('DINO_CHARGE', false));
            hand.root.position.set(hoverCX, hoverY + stompBounce, hoverZ);
            hand.root.rotation.set(0, Math.PI + 0.55 + Math.sin(elapsedTime * 1.3) * 0.14, 0);
            hand.dinoBodyPivot?.rotation.set(0.06, 0, Math.sin(elapsedTime * 2.8) * 0.05);
            if (hand.dinoLeftLeg && hand.dinoRightLeg) {
              const step = Math.sin(elapsedTime * 4.2) * 0.35;
              hand.dinoLeftLeg.rotation.x = step;
              hand.dinoRightLeg.rotation.x = -step;
            }
            if (hand.dinoHeadPivot) {
              hand.dinoHeadPivot.rotation.x = -0.06 + Math.sin(elapsedTime * 5.2) * 0.14;
            }
          } else if (hand.trapKind === 'POOL_SPLASH') {
            const hoverCX = getTrackCenterX(hoverZ) + 4.8;
            const hoverY = getTrackHeightAtZ(hoverZ) + 6.4 + Math.sin(elapsedTime * 2.4) * 0.32;
            hand.root.scale.setScalar(this.getTrapBaseScale('POOL_SPLASH', false));
            hand.root.position.set(hoverCX + Math.sin(elapsedTime * 1.1) * 0.9, hoverY, hoverZ);
            hand.root.rotation.set(0, -0.18 + Math.sin(elapsedTime * 1.3) * 0.08, 0);
            if (hand.bucketPivot) {
              hand.bucketPivot.rotation.x = -0.22 + Math.sin(elapsedTime * 3.1) * 0.18;
            }
            if (hand.splashJetGroup) {
              hand.splashJetGroup.visible = false;
            }
          } else if (hand.trapKind === 'FALLGUYS_PUNCH') {
            const hoverCX = getTrackCenterX(hoverZ) + 5.6;
            const hoverY = getTrackHeightAtZ(hoverZ) + 4.6 + Math.sin(elapsedTime * 2.8) * 0.36;
            hand.root.scale.setScalar(this.getTrapBaseScale('FALLGUYS_PUNCH', false));
            hand.root.position.set(hoverCX + Math.sin(elapsedTime * 1.2) * 0.8, hoverY, hoverZ);
            hand.root.rotation.set(-0.22, 0.92 + Math.sin(elapsedTime * 1.4) * 0.1, 0);
            const pulse = 1.0 + Math.sin(elapsedTime * 6.5) * 0.14;
            hand.springGroup?.scale.set(1, 1, pulse);
            hand.gloveGroup?.position.set(0, 0, 1.25 - 1.15 * pulse);
          } else {
            const hoverCX = getTrackCenterX(hoverZ) + 4.4;
            const hoverY = getTrackHeightAtZ(hoverZ) + 6.8 + Math.sin(elapsedTime * 2.6) * 0.45;
            hand.root.scale.setScalar(this.getTrapBaseScale('FINGER', false));
            hand.root.position.set(hoverCX + Math.sin(elapsedTime * 1.4) * 1.4, hoverY, hoverZ);
            hand.root.rotation.set(0.16, -0.52 + Math.sin(elapsedTime * 1.2) * 0.08, 0.24);
            hand.middleFingerPivot.rotation.x = -1.25 - Math.sin(elapsedTime * 5.0) * 0.08;
          }
        } else {
          hand.root.visible = false;
        }
      } else if (hand.phase === 'WINDUP') {
        hand.phaseTimer += dt;
        const target = hand.targetRacer;
        if (!target || target.state === 'FINISHED') {
          hand.phase =
            this.flickMode !== 'OFF' && this.flickedRacerIds.size < maxFlicks ? 'IDLE' : 'DONE';
          hand.phaseTimer = 0;
          hand.targetRacer = null;
          hand.isManual = false;
          this.resetTrapToIdlePose(hand);
          continue;
        }

        const tp = target.getPosition();
        const windupDur =
          hand.trapKind === 'DINO_CHARGE'
            ? 0.21
            : hand.trapKind === 'BASHER'
            ? 0.18
            : hand.trapKind === 'POOL_SPLASH' || hand.trapKind === 'FALLGUYS_PUNCH'
            ? 0.14
            : 0.11;
        const windRatio = Math.min(1, hand.phaseTimer / windupDur);

        if (hand.trapKind === 'BASHER') {
          const targetZ = tp.z + 1.05;
          const runHop = Math.abs(Math.sin(hand.phaseTimer * 42)) * 0.18;
          const desiredPos = new THREE.Vector3(
            tp.x + side * 0.65,
            getTrackHeightAtZ(targetZ) + 0.08 + runHop,
            targetZ
          );
          hand.root.position.lerp(desiredPos, Math.min(1, dt * 28));
          hand.root.rotation.set(
            0,
            Math.atan2(tp.x - hand.root.position.x, tp.z - hand.root.position.z),
            0
          );
          const waddleZ = Math.sin(hand.phaseTimer * 42) * 0.14;
          hand.charBodyPivot?.rotation.set(
            THREE.MathUtils.lerp(0.08, 0.28, windRatio),
            0,
            waddleZ
          );
          const stride = Math.sin(hand.phaseTimer * 42) * 0.85;
          if (hand.charLeftLegPivot && hand.charRightLegPivot) {
            hand.charLeftLegPivot.rotation.x = stride;
            hand.charRightLegPivot.rotation.x = -stride;
          }
          if (hand.charLeftArmPivot && hand.charRightArmPivot) {
            hand.charLeftArmPivot.rotation.x = -stride * 0.85;
            hand.charRightArmPivot.rotation.x = stride * 0.85;
          }
        } else if (hand.trapKind === 'DINO_CHARGE') {
          const targetZ = tp.z + 3.1;
          const runHop = Math.abs(Math.sin(hand.phaseTimer * 36)) * 0.18;
          const desiredPos = new THREE.Vector3(
            tp.x + side * 1.25,
            getTrackHeightAtZ(targetZ) + 0.08 + runHop,
            targetZ
          );
          hand.root.position.lerp(desiredPos, Math.min(1, dt * 24));
          hand.root.rotation.set(
            0,
            Math.atan2(tp.x - hand.root.position.x, tp.z - hand.root.position.z),
            0
          );
          hand.dinoBodyPivot?.rotation.set(
            THREE.MathUtils.lerp(0.08, 0.34, windRatio),
            0,
            Math.sin(hand.phaseTimer * 36) * 0.09
          );
          const stride = Math.sin(hand.phaseTimer * 36) * 0.85;
          if (hand.dinoLeftLeg && hand.dinoRightLeg) {
            hand.dinoLeftLeg.rotation.x = stride;
            hand.dinoRightLeg.rotation.x = -stride;
          }
          if (hand.dinoHeadPivot) {
            hand.dinoHeadPivot.rotation.x = THREE.MathUtils.lerp(-0.08, 0.24, windRatio);
          }
        } else if (hand.trapKind === 'POOL_SPLASH') {
          const desiredPos = new THREE.Vector3(tp.x + side * 1.2, tp.y + 4.35, tp.z + 1.1);
          hand.root.position.lerp(desiredPos, Math.min(1, dt * 36));
          hand.root.rotation.set(0, -side * 0.14, 0);
          if (hand.bucketPivot) {
            hand.bucketPivot.rotation.x = THREE.MathUtils.lerp(-0.22, 0.35, windRatio);
          }
        } else if (hand.trapKind === 'FALLGUYS_PUNCH') {
          const desiredPos = new THREE.Vector3(tp.x + side * 4.0, tp.y + 2.35, tp.z + 1.9);
          hand.root.position.lerp(desiredPos, Math.min(1, dt * 36));
          const dx = tp.x - hand.root.position.x;
          const dy = tp.y + 0.55 - hand.root.position.y;
          const dz = tp.z - hand.root.position.z;
          const horiz = Math.max(0.01, Math.hypot(dx, dz));
          hand.root.rotation.set(Math.atan2(dy, horiz), Math.atan2(-dx, -dz), 0);
          const springScale = THREE.MathUtils.lerp(1.0, 0.34, windRatio);
          hand.springGroup?.scale.set(1, 1, springScale);
          hand.gloveGroup?.position.set(0, 0, 1.25 - 1.15 * springScale);
        } else {
          // Offset hand to the side of the racer so trailing/climax cameras have an unobstructed side view of the flick
          const desiredPos = new THREE.Vector3(tp.x + side * 2.1, tp.y + 1.95, tp.z + 1.15);
          hand.root.position.lerp(desiredPos, Math.min(1, dt * 42));
          hand.root.rotation.set(0.12, -side * 0.62, side * 0.34);
          // Tightly curl middle finger against thumb before snapping
          hand.middleFingerPivot.rotation.x = THREE.MathUtils.lerp(-1.25, -1.58, windRatio);
        }

        // Execute SNAP / BASH / DINO / SPLASH / PUNCH impact at end of windup or sooner if racer nears finish line
        if (hand.phaseTimer >= windupDur || tp.z >= this.ctx.finishZ - 3.2) {
          hand.phase = 'IMPACT';
          hand.phaseTimer = 0;
          hand.impactPos.set(tp.x, tp.y + 0.6, tp.z);

          let spriteOffsetX = 0;
          let spriteOffsetY = 2.4;

          if (hand.trapKind === 'BASHER') {
            const impactZ = tp.z + 1.05;
            hand.root.position.set(
              tp.x + side * 0.72,
              getTrackHeightAtZ(impactZ) + 0.08,
              impactZ
            );
            hand.root.rotation.set(
              0,
              Math.atan2(tp.x - hand.root.position.x, tp.z - hand.root.position.z),
              0
            );
            hand.charBodyPivot?.rotation.set(0.32, side * 0.36, 0);
            if (hand.charLeftArmPivot && hand.charRightArmPivot) {
              hand.charLeftArmPivot.rotation.x = -0.65;
              hand.charRightArmPivot.rotation.x = 0.55;
            }
            particles.spawnHitBurst(hand.impactPos, '#facc15', 20);
            particles.spawnHitBurst(hand.impactPos, '#ef4444', 12);
            sound.playRagdollHit(1.75);
            sound.playFingerFlick();
            spriteOffsetX = -side * 1.4;
            spriteOffsetY = 4.3;
          } else if (hand.trapKind === 'DINO_CHARGE') {
            const impactZ = tp.z + 3.0;
            hand.root.position.set(
              tp.x + side * 1.15,
              getTrackHeightAtZ(impactZ) + 0.08,
              impactZ
            );
            hand.root.rotation.set(
              0,
              Math.atan2(tp.x - hand.root.position.x, tp.z - hand.root.position.z),
              0
            );
            hand.dinoBodyPivot?.rotation.set(0.36, side * 0.18, 0);
            if (hand.dinoHeadPivot) {
              hand.dinoHeadPivot.rotation.x = 0.28;
            }
            particles.spawnHitBurst(hand.impactPos, '#4ade80', 22);
            particles.spawnHitBurst(hand.impactPos, '#f97316', 14);
            sound.playDinoRoar();
            sound.playRagdollHit(1.75);
            spriteOffsetX = -side * 1.1;
            spriteOffsetY = 5.4;
          } else if (hand.trapKind === 'POOL_SPLASH') {
            hand.root.position.set(tp.x + side * 1.15, tp.y + 4.35, tp.z + 1.05);
            hand.root.rotation.set(0, -side * 0.12, 0);
            if (hand.bucketPivot) {
              hand.bucketPivot.rotation.x = -2.25;
            }
            if (hand.splashJetGroup) {
              hand.splashJetGroup.visible = true;
              hand.splashJetGroup.rotation.set(0.28, 0, -side * 0.24);
              hand.splashJetGroup.scale.set(1.1, 1.05, 1.1);
            }
            const floorSplash = new THREE.Vector3(tp.x, getTrackHeightAtZ(tp.z) + 0.22, tp.z);
            this.onPoolImpactSplash?.(floorSplash, '#38bdf8', particles);
            particles.spawnHitBurst(hand.impactPos, '#ffffff', 16);
            particles.spawnHitBurst(hand.impactPos, '#38bdf8', 22);
            sound.playPoopSplat();
            sound.playWhirlwind();
            sound.playRagdollHit(1.65);
            spriteOffsetY = 5.0;
          } else if (hand.trapKind === 'FALLGUYS_PUNCH') {
            hand.root.position.set(tp.x + side * 4.0, tp.y + 2.35, tp.z + 1.9);
            const dx = tp.x - hand.root.position.x;
            const dy = tp.y + 0.55 - hand.root.position.y;
            const dz = tp.z - hand.root.position.z;
            const horiz = Math.max(0.01, Math.hypot(dx, dz));
            hand.root.rotation.set(Math.atan2(dy, horiz), Math.atan2(-dx, -dz), 0);
            const strikeSpring = 2.55;
            hand.springGroup?.scale.set(1, 1, strikeSpring);
            hand.gloveGroup?.position.set(0, 0, 1.25 - 1.15 * strikeSpring);
            particles.spawnHitBurst(hand.impactPos, '#ff4fa3', 22);
            particles.spawnHitBurst(hand.impactPos, '#ffe066', 14);
            sound.playBumperBounce();
            sound.playRagdollHit(1.75);
            sound.playFingerFlick();
            spriteOffsetX = side * 0.4;
            spriteOffsetY = 4.3;
          } else {
            // Violent snap forward toward -Z!
            hand.middleFingerPivot.rotation.x = 0.85;
            hand.root.position.set(tp.x + side * 1.95, tp.y + 1.75, tp.z + 0.85);
            particles.spawnHitBurst(hand.impactPos, '#facc15', 20);
            particles.spawnHitBurst(hand.impactPos, '#ef4444', 12);
            sound.playFingerFlick();
          }

          const cx = getTrackCenterX(tp.z);
          const inwardVx = THREE.MathUtils.clamp(
            (cx - tp.x) * 1.15 + (Math.random() - 0.5) * 4.5,
            -7,
            7
          );
          // Launch all 6 ragdoll bodies backward (-Z) & high (+Y) so racer flies ~18-22m back!
          target.setAllBodiesLinvel({ x: inwardVx, y: 13.5, z: -26.5 });
          target.triggerRagdoll(
            { x: inwardVx * 1.2, y: 12, z: -20 },
            { x: -24, y: (Math.random() - 0.5) * 18, z: (Math.random() - 0.5) * 18 },
            1.75
          );

          hand.shockwaveMesh.visible = true;
          hand.shockwaveMesh.position.copy(hand.impactPos);
          hand.shockwaveMesh.scale.setScalar(0.5);
          (hand.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = 0.95;

          hand.comicSprite.visible = true;
          hand.comicSprite.position.set(tp.x + spriteOffsetX, tp.y + spriteOffsetY, tp.z);
          (hand.comicSprite.material as THREE.SpriteMaterial).opacity = 1;

          if (this.onFinishFlick) {
            this.onFinishFlick(target, this.flickedRacerIds.size, hand.isManual);
          }
        }
      } else if (hand.phase === 'IMPACT') {
        hand.phaseTimer += dt;
        const t = Math.min(1, hand.phaseTimer / 0.72);

        if (hand.trapKind === 'BASHER') {
          hand.root.position.z += dt * 1.4;
          hand.charBodyPivot?.rotation.set(
            THREE.MathUtils.lerp(0.32, 0.02, t),
            THREE.MathUtils.lerp(side * 0.36, 0, t),
            0
          );
        } else if (hand.trapKind === 'DINO_CHARGE') {
          hand.root.position.z += dt * 1.1;
          hand.dinoBodyPivot?.rotation.set(
            THREE.MathUtils.lerp(0.36, -0.06, t),
            THREE.MathUtils.lerp(side * 0.18, 0, t),
            0
          );
          if (hand.dinoHeadPivot) {
            hand.dinoHeadPivot.rotation.x =
              THREE.MathUtils.lerp(0.28, -0.34, t) +
              Math.sin(hand.phaseTimer * 28) * 0.08 * (1 - t);
          }
        } else if (hand.trapKind === 'POOL_SPLASH') {
          hand.root.position.y += dt * 0.9;
          if (hand.bucketPivot) {
            hand.bucketPivot.rotation.x = -2.25 + Math.sin(hand.phaseTimer * 24) * 0.08 * (1 - t);
          }
          if (hand.splashJetGroup) {
            hand.splashJetGroup.visible = t < 0.88;
            hand.splashJetGroup.scale.set(
              1.05 + t * 0.45,
              Math.max(0.15, 1.15 - t * 0.7),
              1.05 + t * 0.45
            );
          }
        } else if (hand.trapKind === 'FALLGUYS_PUNCH') {
          hand.root.position.y += dt * 0.9;
          const springScale =
            THREE.MathUtils.lerp(2.55, 1.15, t) +
            Math.sin(hand.phaseTimer * 34) * 0.24 * (1 - t);
          hand.springGroup?.scale.set(1, 1, springScale);
          hand.gloveGroup?.position.set(0, 0, 1.25 - 1.15 * springScale);
        } else {
          hand.root.position.y += dt * 4.2;
          hand.middleFingerPivot.rotation.x =
            0.72 + Math.sin(hand.phaseTimer * 36) * 0.14 * (1 - t);
        }

        // Shockwave ring expands rapidly and fades
        const ringScale = 0.6 + t * 4.6;
        hand.shockwaveMesh.scale.setScalar(ringScale);
        (hand.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          (1 - t) * 0.95
        );

        // Comic banner sprite pops up above character head and fades
        const spriteBaseY =
          hand.trapKind === 'DINO_CHARGE'
            ? 5.2
            : hand.trapKind === 'POOL_SPLASH'
            ? 4.8
            : hand.trapKind === 'BASHER'
            ? 4.2
            : hand.trapKind === 'FALLGUYS_PUNCH'
            ? 4.1
            : 2.1;
        hand.comicSprite.position.y = hand.impactPos.y + spriteBaseY + t * 1.8;
        const popScale = t < 0.2 ? 0.65 + (t / 0.2) * 0.48 : 1.13;
        hand.comicSprite.scale.set(5.4 * popScale, 1.98 * popScale, 1);
        (hand.comicSprite.material as THREE.SpriteMaterial).opacity =
          t > 0.65 ? Math.max(0, (1 - t) / 0.35) : 1;

        if (hand.phaseTimer >= 0.72) {
          hand.shockwaveMesh.visible = false;
          hand.comicSprite.visible = false;
          hand.targetRacer = null;
          hand.isManual = false;
          if (hand.splashJetGroup) {
            hand.splashJetGroup.visible = false;
          }
          if (
            this.flickMode !== 'OFF' &&
            (hand.slotIndex === 0 || this.flickMode === 'CHAOS') &&
            this.flickedRacerIds.size < maxFlicks
          ) {
            hand.phase = 'IDLE';
            hand.phaseTimer = 0;
            this.resetTrapToIdlePose(hand);
          } else {
            hand.phase = 'DONE';
            hand.phaseTimer = 0;
          }
        }
      } else if (hand.phase === 'DONE') {
        hand.phaseTimer += dt;
        const liftSpeed =
          hand.trapKind === 'DINO_CHARGE' || hand.trapKind === 'BASHER' ? 9 : 16;
        hand.root.position.y += dt * liftSpeed;
        const baseScale = this.getTrapBaseScale(hand.trapKind, hand.isManual);
        const shrink = Math.max(0.01, baseScale * (1 - hand.phaseTimer * 2.5));
        hand.root.scale.setScalar(shrink);
        if (hand.phaseTimer >= 0.4) {
          hand.root.visible = false;
        }
      }
    }
  }
}
