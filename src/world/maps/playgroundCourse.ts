import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  envCollisionGroup,
  getTrackCenterX,
  getTrackHeightAtZ,
  getTrackYawAtZ,
} from '../courseMath';
import type { CourseBuildContext } from '../courseTypes';
import type { SharedObstacleSystem } from '../obstacles/SharedObstacleSystem';
import { createPlaygroundBossCharacter } from '../traps/bossCharacterModel';

export function buildPlaygroundCourse(
  ctx: CourseBuildContext,
  shared: SharedObstacleSystem
): void {
  buildZone1DesksAndSweepers(ctx, shared);
  buildZone2MysteryAndBumpers(ctx, shared);
  shared.buildConveyorBeltsAndFans(true);
  buildZone4Pendulums(ctx, shared);
  buildMustangBossObstacles(ctx, shared);
}

function buildMustangBossObstacles(ctx: CourseBuildContext, shared: SharedObstacleSystem): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  const specs = isLight
    ? [
        { z: 41.5, ampX: 5.0, freq: 1.85, phase: 0, scale: 1.45 },
        { z: 99.0, ampX: 4.2, freq: 2.05, phase: Math.PI, scale: 1.5 },
      ]
    : [
        { z: 41.5, ampX: 5.2, freq: 2.05, phase: 0, scale: 1.45 },
        { z: 71.2, ampX: 5.2, freq: 2.3, phase: 1.6, scale: 1.5 },
        { z: 99.0, ampX: 4.4, freq: 2.5, phase: 3.1, scale: 1.55 },
      ];

  for (const sp of specs) {
    createMustangBossObstacle(ctx, shared, sp.z, sp.ampX, sp.freq, sp.phase, sp.scale);
  }
}

function createMustangBossObstacle(
  ctx: CourseBuildContext,
  shared: SharedObstacleSystem,
  z: number,
  ampX: number,
  freq: number,
  phase: number,
  scale: number
): void {
  const cx = getTrackCenterX(z);
  const halfW = 0.85 * scale;
  const halfH = 1.45 * scale;
  const halfD = 0.65 * scale;
  const y = getTrackHeightAtZ(z) + 0.05;
  const initX = cx + Math.sin(phase) * ampX;
  const trackYaw = getTrackYawAtZ(z);

  const built = createPlaygroundBossCharacter();
  const group = built.root;
  group.scale.setScalar(scale);
  group.position.set(initX, y, z);
  group.rotation.y = Math.PI + trackYaw;
  group.userData.isMustangBoss = true;
  group.userData.trackYaw = trackYaw;
  group.userData.bodyPivot = built.bodyPivot;
  group.userData.leftArmPivot = built.leftArmPivot;
  group.userData.rightArmPivot = built.rightArmPivot;
  group.userData.leftLegPivot = built.leftLegPivot;
  group.userData.rightLegPivot = built.rightLegPivot;
  ctx.courseGroup.add(group);

  const body = ctx.createBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(initX, y + halfH, z)
  );
  ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
      .setRestitution(1.05)
      .setCollisionGroups(envCollisionGroup()),
    body
  );

  shared.slidingShields.push({
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

function buildZone1DesksAndSweepers(ctx: CourseBuildContext, shared: SharedObstacleSystem): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  const obstaclePositions = isLight
    ? [
        { z: 18, offset: -4.2 },
        { z: 26, offset: 3.8 },
        { z: 35, offset: -2.6 },
      ]
    : [
        { z: 16, offset: -5.2 },
        { z: 18, offset: 4.5 },
        { z: 22, offset: -1.5 },
        { z: 24, offset: 5.5 },
        { z: 29, offset: -5.8 },
        { z: 31, offset: 1.2 },
        { z: 36, offset: -3.2 },
        { z: 37, offset: 4.8 },
      ];

  const deskTopMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4 });
  const envGroup = envCollisionGroup();

  for (const dp of obstaclePositions) {
    const cx = getTrackCenterX(dp.z);
    const yaw = getTrackYawAtZ(dp.z);
    const wx = cx + dp.offset;
    const wz = dp.z;
    const wy = getTrackHeightAtZ(wz);

    const deskGroup = new THREE.Group();
    deskGroup.position.set(wx, wy, wz);
    deskGroup.rotation.y = yaw + (Math.random() - 0.5) * 0.35;

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.22, 1.15), deskTopMat);
    top.position.y = 0.92;
    top.castShadow = true;
    deskGroup.add(top);

    for (const lx of [-0.7, 0.7]) {
      for (const lz of [-0.42, 0.42]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), legMat);
        leg.position.set(lx, 0.45, lz);
        deskGroup.add(leg);
      }
    }
    ctx.courseGroup.add(deskGroup);

    const body = ctx.createBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(wx, wy + 0.55, wz)
    );
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.88, 0.55, 0.58)
        .setRestitution(0.75)
        .setCollisionGroups(envGroup),
      body
    );
  }

  if (isLight) {
    shared.createSweeper(28, 0, 5.2, 2.7, 2, 0x2563eb);
  } else {
    shared.createSweeper(20, -2.5, 4.6, 3.3, 3, 0x2563eb);
    shared.createSweeper(28, 2.6, 4.8, -3.6, 2, 0xf43f5e);
    shared.createSweeper(35, 0, 5.8, 3.8, 3, 0x0ea5e9);
  }
}

function buildZone2MysteryAndBumpers(
  ctx: CourseBuildContext,
  shared: SharedObstacleSystem
): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  shared.buildBreakingDoorRow(48, 5, 0, 'MYSTERY');

  const popupSpecs = isLight
    ? [
        { z: 56, offset: -3.4, phase: 0, freq: 2.8 },
        { z: 65, offset: 3.4, phase: 1.8, freq: 2.8 },
      ]
    : [
        { z: 54, offset: -4.0, phase: 0, freq: 3.4 },
        { z: 54, offset: 4.0, phase: 2.1, freq: 3.4 },
        { z: 60, offset: 0, phase: 1.0, freq: 3.9 },
        { z: 66, offset: -3.2, phase: 0.5, freq: 4.2 },
        { z: 66, offset: 3.2, phase: 2.7, freq: 4.2 },
      ];
  shared.addPopupBumpers(popupSpecs, 0x10b981);

  const pinballSpecs = isLight
    ? [
        { z: 60, offset: -4.0 },
        { z: 60, offset: 4.0 },
      ]
    : [
        { z: 57, offset: -4.8 },
        { z: 57, offset: 4.8 },
        { z: 63, offset: -2.2 },
        { z: 63, offset: 2.2 },
        { z: 69, offset: 0 },
      ];
  shared.addPinballBumpers(pinballSpecs, 0xec4899);
}

function buildZone4Pendulums(ctx: CourseBuildContext, shared: SharedObstacleSystem): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  if (isLight) {
    shared.addSwingingPendulums([{ z: 114, freq: 2.0, phase: 0, maxAngle: 0.82 }], false);
    return;
  }

  shared.addSwingingPendulums(
    [
      { z: 108, freq: 2.35, phase: 0, maxAngle: 0.92 },
      { z: 115, freq: 2.6, phase: Math.PI, maxAngle: 0.92 },
      { z: 121, freq: 2.8, phase: Math.PI * 0.5, maxAngle: 0.92 },
    ],
    false
  );
  shared.createSweeper(126, 0, 5.2, 4.0, 2, 0x3b82f6);
}
