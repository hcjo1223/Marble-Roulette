import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import {
  envCollisionGroup,
  getTrackCenterX,
  getTrackHeightAtZ,
  getTrackYawAtZ,
} from '../courseMath';
import type { CourseBuildContext } from '../courseTypes';
import type { SharedObstacleSystem } from '../obstacles/SharedObstacleSystem';
import { createTaekwondoBossCharacter } from '../traps/bossCharacterModel';

export function buildTaekwondoCourse(
  ctx: CourseBuildContext,
  shared: SharedObstacleSystem
): void {
  buildZone1Dojo(ctx, shared);
  buildZone2BreakingAndPosts(ctx, shared);
  buildZone3PoomsaeAndShockwaves(ctx, shared);
  buildZone4SparringArena(ctx, shared);
  buildTaekwondoBossObstacles(ctx, shared);
}

function buildZone1Dojo(ctx: CourseBuildContext, shared: SharedObstacleSystem): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  const envGroup = envCollisionGroup();

  // 1. Standing Taekwondo Kicking Dummy Bags (청·홍 샌드백 미트)
  const bagSpots = isLight
    ? [
        { z: 17, offset: -4.8 },
        { z: 33, offset: 4.8 },
      ]
    : [
        { z: 16, offset: -5.5 },
        { z: 16, offset: 5.5 },
        { z: 25, offset: -3.0 },
        { z: 25, offset: 3.0 },
        { z: 34, offset: -6.0 },
        { z: 34, offset: 6.0 },
      ];
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
  const redBagMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
  const blueBagMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 });

  bagSpots.forEach((sp, idx) => {
    const cx = getTrackCenterX(sp.z);
    const wx = cx + sp.offset;
    const wz = sp.z;
    const wy = getTrackHeightAtZ(wz);

    const bagGroup = new THREE.Group();
    bagGroup.position.set(wx, wy, wz);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.45, 16), baseMat);
    base.position.y = 0.22;
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 1.9, 18),
      idx % 2 === 0 ? redBagMat : blueBagMat
    );
    pad.position.y = 1.35;
    pad.castShadow = true;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.26, 18), bandMat);
    ring.position.y = 1.5;
    bagGroup.add(base, pad, ring);
    ctx.courseGroup.add(bagGroup);

    const body = ctx.createBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(wx, wy + 1.1, wz)
    );
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cylinder(1.1, 0.65)
        .setRestitution(1.05)
        .setCollisionGroups(envGroup),
      body
    );
  });

  // 2. Taekwondo Vaulting Springboards (이단 앞차기 도약 발판) - launch racers over obstacles!
  if (isLight) {
    shared.createSpringboard(20.0, 0, 2.5, 1.6, 22, 25);
    shared.createSpringboard(31.5, 0, 2.5, 1.6, 22, 25);
    shared.createSlidingShield(26.5, 2.5, 0.95, 0.45, 5.2, 2.2, 0, 0xdc2626);
  } else {
    shared.createSpringboard(18.5, -2.5, 2.2, 1.6, 22, 26);
    shared.createSpringboard(18.5, 2.5, 2.2, 1.6, 22, 26);
    shared.createSpringboard(31.0, 0, 2.6, 1.6, 24, 28);

    // 3. Sliding Taekwondo Hogu / Kick Shields (좌우 왕복 타격 방패)
    shared.createSlidingShield(22.0, 2.6, 0.95, 0.45, 5.8, 2.5, 0, 0xdc2626);
    shared.createSlidingShield(28.5, 2.8, 0.95, 0.45, 5.6, 2.9, Math.PI, 0x2563eb);
    shared.createSlidingShield(37.5, 3.0, 1.0, 0.45, 5.5, 3.3, Math.PI * 0.5, 0x0f172a);
  }
}

function buildZone2BreakingAndPosts(ctx: CourseBuildContext, shared: SharedObstacleSystem): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  // 1. First Breaking Gate: 5 Pinewood Breaking Boards (송판 격파) at Z = 46
  shared.buildBreakingDoorRow(46, 5, 0, 'PINEWOOD');

  // 2. Bamboo/Wooden Wing-Chun & Taekwondo Slalom Posts + Fast 4-Blade Nunchuck Spinner (Z = 51..58)
  const postSpecs = isLight
    ? [
        { z: 54, offset: -3.6 },
        { z: 54, offset: 3.6 },
      ]
    : [
        { z: 52, offset: -5.2 },
        { z: 52, offset: 5.2 },
        { z: 54, offset: -2.2 },
        { z: 54, offset: 2.2 },
        { z: 57, offset: -4.5 },
        { z: 57, offset: 4.5 },
      ];
  shared.addPinballBumpers(postSpecs, 0xb45309);

  if (!isLight) {
    // 4-Blade Black-Belt Nunchuck Spinner in the center!
    shared.createSweeper(55, 0, 5.4, 4.2, 4, 0x0f172a);
  }

  // 3. Second Breaking Gate: 4 Black Roof-Tile Stacks (기와장 격파) at Z = 62!
  shared.buildBreakingDoorRow(62, 4, 1, 'ROOFTILE');

  if (!isLight) {
    // 4. Taegeuk Bounce Pads before Zone 3 (Z = 67..70)
    shared.createSpringboard(67.5, -4.5, 2.0, 1.5, 20, 24);
    shared.createSpringboard(67.5, 4.5, 2.0, 1.5, 20, 24);
    shared.createSlidingShield(69.5, 2.4, 0.95, 0.45, 5.4, 3.0, 0, 0xdc2626);
  }
}

function buildZone3PoomsaeAndShockwaves(
  ctx: CourseBuildContext,
  shared: SharedObstacleSystem
): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  // 1. Poomsae Rapid-Step Belts (curved strip geometry so NEVER sinks below floor!)
  shared.buildConveyorBeltsAndFans(false);

  // 2. Taekwondo War-Drum Kiai Shockwave Cannons (대북 기합 장풍 충격파!)
  const drumConfigs = isLight
    ? [{ zMin: 82.5, zMax: 89.0, side: 1, dirX: -1, freq: 1.85, phase: 1.2 }]
    : [
        { zMin: 75, zMax: 81.5, side: -1, dirX: 1, freq: 2.1, phase: 0 },
        { zMin: 82.5, zMax: 89.0, side: 1, dirX: -1, freq: 2.3, phase: 1.6 },
        { zMin: 90.0, zMax: 96.5, side: -1, dirX: 1, freq: 2.5, phase: 3.1 },
      ];

  for (const dc of drumConfigs) {
    const zMid = (dc.zMin + dc.zMax) * 0.5;
    const cx = getTrackCenterX(zMid);
    const yMid = getTrackHeightAtZ(zMid) + 1.8;
    const drumX = cx + dc.side * 9.8;

    const drumGroup = new THREE.Group();
    drumGroup.position.set(drumX, yMid, zMid);

    const drumBody = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 1.85, 1.6, 20),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 })
    );
    drumBody.rotation.z = Math.PI / 2;
    const drumSkin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.75, 1.7, 20),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 })
    );
    drumSkin.rotation.z = Math.PI / 2;
    drumGroup.add(drumBody, drumSkin);
    ctx.courseGroup.add(drumGroup);

    // Visible Golden Kiai Shockwave Ring sweeping across the track
    const waveMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.22, 10, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.88 })
    );
    waveMesh.rotation.y = Math.PI / 2;
    waveMesh.position.set(cx, yMid, zMid);
    ctx.courseGroup.add(waveMesh);

    shared.shockwaveDrums.push({
      zMin: dc.zMin,
      zMax: dc.zMax,
      side: dc.side,
      dirX: dc.dirX,
      freq: dc.freq,
      phase: dc.phase,
      drumMesh: drumGroup,
      waveMesh,
      hitCooldowns: new Map(),
    });
  }
}

function buildZone4SparringArena(ctx: CourseBuildContext, shared: SharedObstacleSystem): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  if (isLight) {
    shared.addPopupBumpers([{ z: 122.5, offset: 0, phase: 0.9, freq: 3.2 }], 0x2563eb);
    shared.addSwingingPendulums([{ z: 114, freq: 2.0, phase: 0, maxAngle: 0.82 }], true);
    return;
  }

  // 1. Pop-up Sparring Kick Launchers at entrance & exit of bridge
  shared.addPopupBumpers(
    [
      { z: 103.5, offset: -2.2, phase: 0, freq: 3.8 },
      { z: 103.5, offset: 2.2, phase: 1.9, freq: 3.8 },
      { z: 122.5, offset: 0, phase: 0.9, freq: 4.0 },
    ],
    0x2563eb
  );

  // 2. Hanging Heavy Punching Bags (Z = 108, 118)
  shared.addSwingingPendulums(
    [
      { z: 108, freq: 2.5, phase: 0, maxAngle: 0.94 },
      { z: 118, freq: 2.8, phase: Math.PI, maxAngle: 0.94 },
    ],
    true
  );

  // 3. Sliding Sparring Hogu Shield in the middle of the narrow bridge (Z = 113)
  shared.createSlidingShield(113, 1.8, 0.95, 0.42, 2.7, 3.2, 0.5, 0xdc2626);

  // 4. Master's Final 4-Blade Black-Belt Sweeper before finish (Z = 127)
  shared.createSweeper(127, 0, 5.2, 4.3, 4, 0x0f172a);
}

function buildTaekwondoBossObstacles(
  ctx: CourseBuildContext,
  shared: SharedObstacleSystem
): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  const specs = isLight
    ? [
        { z: 41.5, ampX: 5.0, freq: 1.85, phase: 0, scale: 1.45 },
        { z: 99.0, ampX: 4.2, freq: 2.05, phase: Math.PI, scale: 1.5 },
      ]
    : [
        { z: 41.5, ampX: 5.2, freq: 2.05, phase: 0, scale: 1.45 },
        { z: 72.4, ampX: 5.2, freq: 2.3, phase: 1.6, scale: 1.5 },
        { z: 99.0, ampX: 4.4, freq: 2.5, phase: 3.1, scale: 1.55 },
      ];

  for (const sp of specs) {
    createTaekwondoBossObstacle(ctx, shared, sp.z, sp.ampX, sp.freq, sp.phase, sp.scale);
  }
}

function createTaekwondoBossObstacle(
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

  const built = createTaekwondoBossCharacter();
  const group = built.root;
  group.scale.setScalar(scale);
  group.position.set(initX, y, z);
  group.rotation.y = Math.PI + trackYaw;
  group.userData.isCharacterBoss = true;
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
