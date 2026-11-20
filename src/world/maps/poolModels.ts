import * as THREE from 'three';
import { getTrackCenterX, getTrackHeightAtZ } from '../courseMath';
import type { CourseBuildContext } from '../courseTypes';

/** 수영장 부품: 야자수·파라솔·튜브 부표·사다리로 물놀이 분위기를 만든다 */
export function buildPoolScenery(ctx: CourseBuildContext): void {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
  const frondMats = [
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.6 }),
  ];
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.5 });

  // 1. 야자수 가로수 (모바일 드로우콜 최적화를 위해 16m 간격 & 5엽 구성)
  for (let tz = 10; tz <= 142; tz += 16) {
    const cx = getTrackCenterX(tz);
    const ty = getTrackHeightAtZ(tz) - 1.15;
    for (const side of [-1, 1]) {
      const palm = new THREE.Group();
      palm.position.set(
        cx + side * (13.0 + Math.random() * 4.5),
        ty,
        tz + (Math.random() - 0.5) * 3.5
      );
      const lean = (Math.random() - 0.5) * 0.16;
      const height = 4.6 + Math.random() * 2.2;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.52, height, 7),
        trunkMat
      );
      trunk.position.y = height * 0.5;
      trunk.rotation.z = lean;
      palm.add(trunk);

      const crown = new THREE.Group();
      crown.position.set(-Math.sin(lean) * height, height, 0);
      const frondCount = 5;
      for (let f = 0; f < frondCount; f++) {
        const a = (f / frondCount) * Math.PI * 2 + Math.random() * 0.25;
        const frond = new THREE.Mesh(
          new THREE.BoxGeometry(2.5 + Math.random() * 0.8, 0.1, 0.85),
          frondMats[f % frondMats.length]
        );
        frond.position.set(Math.cos(a) * 1.25, 0.05 - Math.random() * 0.1, Math.sin(a) * 1.25);
        frond.rotation.y = -a;
        frond.rotation.z = -0.3;
        crown.add(frond);
      }
      palm.add(crown);
      ctx.courseGroup.add(palm);
    }
  }

  // 2. 파라솔 & 선베드 (트랙 바깥 물가)
  const parasolColors = [0xf472b6, 0x22d3ee, 0xfde047, 0xa855f7];
  for (let tz = 16; tz <= 136; tz += 26) {
    const cx = getTrackCenterX(tz);
    const ty = getTrackHeightAtZ(tz) - 2.3;
    for (const side of [-1, 1]) {
      const stand = new THREE.Group();
      stand.position.set(cx + side * (11.6 + Math.random() * 2.5), ty, tz + side * 3);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6), whiteMat);
      pole.position.y = 1.7;
      stand.add(pole);

      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 0.95, 8),
        new THREE.MeshStandardMaterial({
          color: parasolColors[Math.floor(Math.random() * parasolColors.length)],
          roughness: 0.45,
        })
      );
      canopy.position.y = 3.45;
      stand.add(canopy);

      const bedMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.7 });
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 3.1), bedMat);
      bed.position.set(side * 1.1, 0.32, 0);
      bed.rotation.y = side * 0.2;
      stand.add(bed);
      ctx.courseGroup.add(stand);
    }
  }

  // 3. 물 위에 떠 있는 컬러 튜브 부표 (InstancedMesh로 드로우콜 1회로 통합)
  const floatColors = [0xf472b6, 0xfde047, 0x22d3ee, 0xa855f7, 0xfb923c, 0x4ade80];
  const floatTransforms: { x: number; y: number; z: number; rx: number; rz: number; s: number; color: number }[] = [];
  for (let tz = 12; tz <= 140; tz += 9) {
    const cx = getTrackCenterX(tz);
    const wy = getTrackHeightAtZ(tz) - 2.05;
    for (const side of [-1, 1]) {
      if (Math.random() < 0.2) continue;
      floatTransforms.push({
        x: cx + side * (10.8 + Math.random() * 7.5),
        y: wy + (Math.random() - 0.5) * 0.15,
        z: tz + (Math.random() - 0.5) * 3.0,
        rx: Math.PI / 2 + (Math.random() - 0.5) * 0.25,
        rz: Math.random() * Math.PI,
        s: 0.9 + Math.random() * 0.35,
        color: floatColors[Math.floor(Math.random() * floatColors.length)],
      });
    }
  }
  if (floatTransforms.length > 0) {
    const instRings = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.95, 0.28, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
      floatTransforms.length
    );
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    floatTransforms.forEach((ft, idx) => {
      dummy.position.set(ft.x, ft.y, ft.z);
      dummy.rotation.set(ft.rx, 0, ft.rz);
      dummy.scale.setScalar(ft.s);
      dummy.updateMatrix();
      instRings.setMatrixAt(idx, dummy.matrix);
      instRings.setColorAt(idx, col.setHex(ft.color));
    });
    instRings.instanceMatrix.needsUpdate = true;
    if (instRings.instanceColor) instRings.instanceColor.needsUpdate = true;
    ctx.courseGroup.add(instRings);
  }

  // 4. 수영장 사다리 (출발 지점 옆)
  for (const side of [-1, 1]) {
    const ladderZ = 12.5;
    const lcx = getTrackCenterX(ladderZ);
    const ly = getTrackHeightAtZ(ladderZ) - 2.4;
    const ladder = new THREE.Group();
    ladder.position.set(lcx + side * 10.4, ly, ladderZ);
    for (const rail of [-0.55, 0.55]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 6), metalMat);
      r.position.set(rail, 1.8, 0);
      ladder.add(r);
    }
    for (let lr = 0; lr < 4; lr++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), metalMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.5 + lr * 0.85, 0);
      ladder.add(rung);
    }
    ctx.courseGroup.add(ladder);
  }

  // 5. 안전요원 의자 (물벼락 존 옆)
  const chairZ = 66;
  const ccx = getTrackCenterX(chairZ);
  const chY = getTrackHeightAtZ(chairZ) - 2.35;
  const chair = new THREE.Group();
  chair.position.set(ccx + 10.6, chY, chairZ);
  const chairMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
  for (const lx of [-0.6, 0.6]) {
    for (const lz of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.0, 0.16), chairMat);
      leg.position.set(lx * 1.2, 1.5, lz * 1.2);
      chair.add(leg);
    }
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.7), whiteMat);
  seat.position.y = 3.05;
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.2, 0.18), chairMat);
  back.position.set(0, 3.7, -0.8);
  chair.add(back);
  const umbrella = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.5 })
  );
  umbrella.position.y = 5.4;
  chair.add(umbrella);
  ctx.courseGroup.add(chair);
}

/** 도넛 튜브 범퍼 메쉬 (알록달록 물놀이 튜브) */
export function createTubeBumperMesh(colorHex: number): THREE.Group {
  const group = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(1.12, 0.46, 12, 26),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 })
  );
  torus.rotation.x = Math.PI / 2;
  torus.castShadow = true;
  group.add(torus);

  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2 + Math.PI / 4;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.22), stripeMat);
    stripe.position.set(Math.cos(a) * 1.12, 0.16, Math.sin(a) * 1.12);
    group.add(stripe);
  }
  return group;
}

export function createWaterBalloonMesh(): THREE.Group {
  const group = new THREE.Group();
  const balloon = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 18, 14),
    new THREE.MeshStandardMaterial({
      color: 0xff5fa2,
      transparent: true,
      opacity: 0.92,
      roughness: 0.08,
      metalness: 0.2,
      emissive: 0xe0417f,
      emissiveIntensity: 0.35,
    })
  );
  balloon.scale.set(1, 1.12, 1);
  balloon.castShadow = true;
  group.add(balloon);

  // 하늘에서도 잘 보이도록 두른 흰색 밴딩
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.13, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
  );
  band.rotation.x = Math.PI / 2;
  group.add(band);

  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 })
  );
  shine.position.set(-0.46, 0.6, 0.84);
  group.add(shine);

  const knot = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0xe0417f, roughness: 0.3 })
  );
  knot.position.y = -1.45;
  knot.rotation.x = Math.PI;
  group.add(knot);
  return group;
}

export function createRubberDuckMesh(): THREE.Group {
  const group = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.32 });
  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), yellowMat);
  bodyMesh.scale.set(1.15, 0.9, 1.25);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 12), yellowMat);
  head.position.set(0, 0.92, 0.62);
  head.castShadow = true;
  group.add(head);

  const beak = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.22, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
  );
  beak.position.set(0, 0.82, 1.24);
  group.add(beak);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
    eye.position.set(side * 0.24, 1.1, 1.06);
    group.add(eye);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 8), yellowMat);
  tail.position.set(0, 0.35, -1.34);
  tail.rotation.x = -Math.PI * 0.42;
  group.add(tail);
  return group;
}

/** 탑승용 대형 물놀이 튜브 픽업 아이템 메쉬 */
export function createRideableTubePickupMesh(colorHex: number): THREE.Group {
  const group = new THREE.Group();
  const tubeMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.08,
    emissive: colorHex,
    emissiveIntensity: 0.22,
  });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.32, 10, 20), tubeMat);
  torus.rotation.x = Math.PI / 2;
  torus.castShadow = true;
  group.add(torus);

  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.09, 6, 20),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.26;
  group.add(stripe);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), tubeMat);
  head.position.set(0, 0.42, 0.92);
  group.add(head);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.24, 8),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
  );
  beak.rotation.x = Math.PI * 0.5;
  beak.position.set(0, 0.4, 1.2);
  group.add(beak);
  return group;
}

/** 파도 존 3D 롤링 파도 벽 + 거품 캡 메쉬 */
export function createRollingWaveCrestMesh(zSpan: number): THREE.Group {
  const group = new THREE.Group();
  const waveMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.72,
    roughness: 0.14,
    metalness: 0.18,
    emissive: 0x0284c7,
    emissiveIntensity: 0.2,
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, zSpan, 12), waveMat);
  wall.rotation.x = Math.PI / 2;
  wall.scale.set(0.85, 1, 1.35);
  group.add(wall);

  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xf0fdff,
    transparent: true,
    opacity: 0.92,
  });
  const foamCount = Math.max(4, Math.round(zSpan / 1.8));
  for (let i = 0; i < foamCount; i++) {
    const fz = -zSpan * 0.42 + (i / Math.max(1, foamCount - 1)) * (zSpan * 0.84);
    const foam = new THREE.Mesh(new THREE.SphereGeometry(0.58, 8, 6), foamMat);
    foam.position.set((i % 2 === 0 ? 1 : -1) * 0.2, 1.38, fz);
    foam.scale.set(1.1, 0.75, 1.35);
    group.add(foam);
  }
  return group;
}
