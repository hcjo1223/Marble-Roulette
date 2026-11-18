import * as THREE from 'three';
import { getTrackCenterX, getTrackHalfWidthAtZ, getTrackHeightAtZ } from '../courseMath';
import type { AnimatedDinoPart, CourseBuildContext, FlyingPterosaurData } from '../courseTypes';

export function createPteranodonMesh(): {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
} {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
  const crestMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 1.5), bodyMat);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.8), bodyMat);
  head.position.set(0, 0.2, 1.05);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 1.1), beakMat);
  beak.position.set(0, 0.12, 1.75);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.95), crestMat);
  crest.position.set(0, 0.48, 0.72);
  crest.rotation.x = 0.25;

  const wingGeo = new THREE.BoxGeometry(2.6, 0.1, 1.0);
  const leftWing = new THREE.Mesh(wingGeo, crestMat);
  leftWing.position.set(-1.6, 0.15, 0);
  const rightWing = new THREE.Mesh(wingGeo, crestMat);
  rightWing.position.set(1.6, 0.15, 0);

  group.add(body, head, beak, crest, leftWing, rightWing);
  group.scale.setScalar(1.3);
  return { group, leftWing, rightWing };
}

export function createDinosaurMesh(
  kind: 'TREX' | 'TRICERATOPS' | 'BRACHIOSAURUS' | 'STEGOSAURUS',
  scale: number = 1.0,
  registerAnim: boolean = false,
  animatedDinoParts?: AnimatedDinoPart[]
): {
  group: THREE.Group;
  leftLeg?: THREE.Mesh;
  rightLeg?: THREE.Mesh;
  headPivot?: THREE.Group;
} {
  const group = new THREE.Group();
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

  if (kind === 'TREX') {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.45 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 2.8), skinMat);
    torso.position.set(0, 2.4, 0);
    torso.castShadow = true;
    const belly = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.4), bellyMat);
    belly.position.set(0, 2.2, 1.35);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.8), skinMat);
    leftLeg.position.set(-0.65, 0.8, 0);
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.8), skinMat);
    rightLeg.position.set(0.65, 0.8, 0);
    rightLeg.castShadow = true;
    group.add(leftLeg, rightLeg);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 2.6), skinMat);
    tail.position.set(0, 1.9, -2.3);
    tail.rotation.x = 0.18;

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 3.8, 1.2);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 2.1), skinMat);
    head.position.set(0, 0.3, 0.8);
    head.castShadow = true;
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 1.4), whiteMat);
    teeth.position.set(0, -0.35, 1.0);
    for (const ex of [-0.82, 0.82]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.3), eyeMat);
      eye.position.set(ex, 0.6, 1.0);
      headPivot.add(eye);
    }
    headPivot.add(head, teeth);

    if (registerAnim && animatedDinoParts) {
      animatedDinoParts.push({
        part: headPivot,
        baseRotX: 0,
        amp: 0.16,
        freq: 2.2,
        phase: Math.random() * 4,
      });
    }

    for (const sx of [-0.95, 0.95]) {
      const tinyArm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 0.5), skinMat);
      tinyArm.position.set(sx, 2.7, 1.45);
      group.add(tinyArm);
    }

    group.add(torso, belly, tail, headPivot);
    group.scale.setScalar(scale);
    return { group, leftLeg, rightLeg, headPivot };
  } else if (kind === 'TRICERATOPS') {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45 });
    const frillMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.35, 2.4), skinMat);
    body.position.set(0, 1.25, 0);
    body.castShadow = true;

    for (const lx of [-0.6, 0.6]) {
      for (const lz of [-0.75, 0.75]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.9, 0.5), skinMat);
        leg.position.set(lx, 0.45, lz);
        leg.castShadow = true;
        group.add(leg);
      }
    }

    const frill = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.65, 0.32), frillMat);
    frill.position.set(0, 1.85, 1.15);
    frill.rotation.x = -0.22;
    frill.castShadow = true;

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.05, 1.35), skinMat);
    head.position.set(0, 1.3, 1.7);
    head.castShadow = true;

    // 3 iconic white horns!
    for (const hx of [-0.45, 0.45]) {
      const browHorn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.05, 8), whiteMat);
      browHorn.rotation.x = Math.PI * 0.42;
      browHorn.position.set(hx, 1.85, 2.35);
      group.add(browHorn);
    }
    const noseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 8), whiteMat);
    noseHorn.rotation.x = Math.PI * 0.35;
    noseHorn.position.set(0, 1.35, 2.45);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 1.3), skinMat);
    tail.position.set(0, 1.2, -1.65);

    group.add(body, frill, head, noseHorn, tail);
  } else if (kind === 'BRACHIOSAURUS') {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.45 });
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x5eead4, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 3.6), skinMat);
    body.position.set(0, 2.6, 0);
    body.castShadow = true;

    for (const lx of [-0.85, 0.85]) {
      for (const lz of [-1.2, 1.2]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.1, 0.75), skinMat);
        leg.position.set(lx, 1.05, lz);
        leg.castShadow = true;
        group.add(leg);
      }
    }

    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 3.2, 1.5);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(1.0, 5.2, 1.0), skinMat);
    neck.position.set(0, 2.5, 0.3);
    neck.rotation.x = 0.14;
    neck.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.45), spotMat);
    head.position.set(0, 5.1, 0.85);
    for (const ex of [-0.6, 0.6]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.25), eyeMat);
      eye.position.set(ex, 5.25, 1.05);
      neckPivot.add(eye);
    }
    neckPivot.add(neck, head);

    if (registerAnim && animatedDinoParts) {
      animatedDinoParts.push({
        part: neckPivot,
        baseRotX: 0,
        amp: 0.12,
        freq: 1.4,
        phase: Math.random() * 4,
      });
    }

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 2.8), skinMat);
    tail.position.set(0, 2.2, -2.8);
    tail.rotation.x = -0.15;

    group.add(body, neckPivot, tail);
  } else {
    // STEGOSAURUS
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.45 });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.15, 2.3), skinMat);
    body.position.set(0, 1.05, 0);
    body.castShadow = true;

    for (const lx of [-0.52, 0.52]) {
      for (const lz of [-0.7, 0.7]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.42), skinMat);
        leg.position.set(lx, 0.36, lz);
        group.add(leg);
      }
    }

    for (let p = 0; p < 4; p++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.52), plateMat);
      plate.position.set(0, 1.85, -0.75 + p * 0.52);
      plate.rotation.x = 0.25;
      plate.castShadow = true;
      group.add(plate);
    }

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.95), skinMat);
    head.position.set(0, 0.95, 1.45);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.3), skinMat);
    tail.position.set(0, 1.0, -1.55);
    group.add(head, tail);
  }

  group.scale.setScalar(scale);
  return { group };
}

export function buildDinosaurJungleScenery(
  ctx: CourseBuildContext,
  animatedDinoParts: AnimatedDinoPart[],
  flyingPterosaurs: FlyingPterosaurData[]
): void {
  const isLight = ctx.obstacleDensity === 'LIGHT';
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });
  const fernMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 });

  // Jungle palm trees & prehistoric ferns along both sides up to z = 238
  for (let tz = 12; tz <= 238; tz += 12) {
    const cx = getTrackCenterX(tz);
    const ty = getTrackHeightAtZ(tz) - 1.4;
    const hw = getTrackHalfWidthAtZ(tz, ctx.mapTheme);
    for (const side of [-1, 1]) {
      const palmGroup = new THREE.Group();
      const distOut = hw + 3.8 + (tz % 3) * 1.4;
      palmGroup.position.set(cx + side * distOut, ty, tz);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 5.6, 8), trunkMat);
      trunk.position.y = 2.8;
      trunk.rotation.z = -side * 0.14;
      trunk.castShadow = true;
      palmGroup.add(trunk);

      for (let b = 0; b < 5; b++) {
        const frond = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.16, 0.85), palmLeafMat);
        const ang = (b * Math.PI * 2) / 5;
        frond.position.set(-side * 0.3 + Math.cos(ang) * 1.2, 5.5, Math.sin(ang) * 1.2);
        frond.rotation.y = -ang;
        frond.rotation.z = -0.25;
        frond.castShadow = true;
        palmGroup.add(frond);
      }

      const fern = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), fernMat);
      fern.position.set(-side * 1.1, 0.8, 1.2);
      palmGroup.add(fern);
      ctx.courseGroup.add(palmGroup);
    }
  }

  // Smoking Volcanoes along the long jungle circuit
  for (const vc of [
    { z: 90, side: -1, scale: 1.2 },
    { z: 148, side: 1, scale: 1.45 },
    { z: 204, side: -1, scale: 1.3 },
  ]) {
    const cx = getTrackCenterX(vc.z);
    const vy = getTrackHeightAtZ(vc.z) - 2.0;
    const vGroup = new THREE.Group();
    vGroup.position.set(cx + vc.side * 23, vy, vc.z);
    vGroup.scale.setScalar(vc.scale);

    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(8.5, 13.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 })
    );
    mountain.position.y = 6.75;
    const lavaCap = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.7, 1.1, 10),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    lavaCap.position.y = 13.1;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 })
    );
    glow.position.y = 13.7;
    vGroup.add(mountain, lavaCap, glow);
    ctx.courseGroup.add(vGroup);
  }

  // Giant Iconic Dinosaurs guarding the course flanks
  for (const sc of [
    { kind: 'BRACHIOSAURUS' as const, z: 28, side: -1, dist: 14.5, scale: 1.45, rot: 0.65 },
    { kind: 'BRACHIOSAURUS' as const, z: 98, side: 1, dist: 15.0, scale: 1.55, rot: -0.8 },
    { kind: 'BRACHIOSAURUS' as const, z: 168, side: -1, dist: 14.5, scale: 1.5, rot: 0.7 },
    { kind: 'TREX' as const, z: 15, side: 1, dist: 13.5, scale: 1.35, rot: -0.9 },
    { kind: 'TREX' as const, z: 222, side: -1, dist: 13.0, scale: 1.75, rot: 0.75 },
  ]) {
    const dino = createDinosaurMesh(sc.kind, sc.scale, true, animatedDinoParts);
    dino.group.position.set(
      getTrackCenterX(sc.z) + sc.side * sc.dist,
      getTrackHeightAtZ(sc.z) - 1.1,
      sc.z
    );
    dino.group.rotation.y = sc.rot;
    ctx.courseGroup.add(dino.group);
  }

  // Flying Pteranodons patrolling & bombing the track with sticky Poop!
  const pteroConfigs = isLight
    ? [
        { z: 48, yOffset: 9.6, phase: 0.0, radiusX: 7.5, dropInterval: 2.5 },
        { z: 102, yOffset: 9.8, phase: 1.7, radiusX: 7.5, dropInterval: 2.4 },
        { z: 154, yOffset: 9.6, phase: 3.1, radiusX: 7.5, dropInterval: 2.3 },
        { z: 198, yOffset: 9.4, phase: 4.5, radiusX: 4.5, dropInterval: 2.5 },
      ]
    : [
        { z: 44, yOffset: 9.4, phase: 0.0, radiusX: 8.0, dropInterval: 1.55 },
        { z: 86, yOffset: 9.8, phase: 1.4, radiusX: 8.0, dropInterval: 1.45 },
        { z: 128, yOffset: 9.6, phase: 2.7, radiusX: 8.0, dropInterval: 1.45 },
        { z: 164, yOffset: 9.8, phase: 4.1, radiusX: 8.0, dropInterval: 1.4 },
        { z: 198, yOffset: 9.4, phase: 5.3, radiusX: 4.8, dropInterval: 1.5 },
      ];

  for (const pc of pteroConfigs) {
    const ptero = createPteranodonMesh();
    const cx = getTrackCenterX(pc.z);
    const y = getTrackHeightAtZ(pc.z) + pc.yOffset;
    ptero.group.position.set(cx, y, pc.z);
    ctx.courseGroup.add(ptero.group);
    flyingPterosaurs.push({
      group: ptero.group,
      leftWing: ptero.leftWing,
      rightWing: ptero.rightWing,
      baseX: cx,
      baseY: y,
      baseZ: pc.z,
      phase: pc.phase,
      radiusX: pc.radiusX,
      canDropPoop: true,
      dropTimer: 0.4 + Math.random() * pc.dropInterval,
      dropInterval: pc.dropInterval,
    });
  }
}
